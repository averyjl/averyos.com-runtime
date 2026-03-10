/**
 * generateInvoices.cjs
 * AveryOS TARI Invoice Generator — integrates with licenseGate.cjs AI gateway logs
 * and the anchor_audit_logs D1 table for ASN-based sovereign invoicing.
 *
 * Usage (AI Gateway mode — existing behaviour):
 *   STRIPE_SECRET_KEY=sk_... node scripts/generateInvoices.cjs
 *
 * Usage (ASN / anchor_audit_logs mode — activated when ANCHOR_AUDIT_LOG_PATH is set):
 *   STRIPE_SECRET_KEY=sk_... ANCHOR_AUDIT_LOG_PATH=capsule_logs/anchor_audit_logs.json \
 *     node scripts/generateInvoices.cjs
 *
 *   The anchor_audit_logs JSON file is a D1 export: an array of row objects that must
 *   include at minimum an "asn" field.  Export with:
 *     npx wrangler d1 execute averyos_kernel_db --remote \
 *       --command "SELECT * FROM anchor_audit_logs" --json > capsule_logs/anchor_audit_logs.json
 *
 * Data sources:
 *   AI Gateway mode:    capsule_logs/ai_gateway_logs.json
 *   ASN mode:           ANCHOR_AUDIT_LOG_PATH (D1 anchor_audit_logs export)
 *
 * Pricing — ASN mode:
 *   Enterprise ASNs (36459 GitHub, 211590 France, 43037 Seznam):
 *     $10,000,000 Good Faith Deposit (checkout) + Draft Invoice
 *   All other unique ASNs:
 *     1,017 TARI™ Individual License = $101.70 (checkout)
 *
 * Pricing — AI Gateway mode:
 *   $10,000 (Base BSU) + ($0.01 × request_count) per corporate org_id
 *
 * Milestone trigger: ASN mode only processes when total anchor_audit_logs
 *   row count meets or exceeds MILESTONE_THRESHOLD (156,200).
 *
 * Metadata: CapsuleID: AveryOS_TARI_v1.1
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const Stripe = require('stripe');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── CLI flags ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
/**
 * --dry-run: Log what would be invoiced without making any Stripe API calls.
 * No invoices or checkout sessions are created when this flag is set.
 */
const DRY_RUN = args.includes('--dry-run');

// ── Config ────────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY;
const SITE_URL             = (process.env.SITE_URL ?? 'https://averyos.com').replace(/\/$/, '');
const VAULT_PASSPHRASE     = process.env.VAULT_PASSPHRASE ?? '';
const LOG_PATH             = process.env.AI_GATEWAY_LOG_PATH
  || path.join(process.cwd(), 'capsule_logs', 'ai_gateway_logs.json');

// ASN mode — activated when ANCHOR_AUDIT_LOG_PATH is set.
const ANCHOR_AUDIT_LOG_PATH = process.env.ANCHOR_AUDIT_LOG_PATH || '';

// ── STRIPE_SESSION_RE — Breach threshold override ─────────────────────────────
// Set STRIPE_SESSION_RE to a positive integer to override the default
// MILESTONE_THRESHOLD (156,200).  When the anchor_audit_logs row count
// reaches or exceeds this value the ASN invoice run is triggered and
// checkout sessions are POSTed to /api/v1/compliance/create-checkout.
//
// Usage example (trigger at 1,017 rows for testing):
//   STRIPE_SESSION_RE=1017 STRIPE_SECRET_KEY=sk_... node scripts/generateInvoices.cjs
const _stripeSessionRe = parseInt(process.env.STRIPE_SESSION_RE ?? '', 10);
const STRIPE_SESSION_BREACH_THRESHOLD = (!isNaN(_stripeSessionRe) && _stripeSessionRe > 0)
  ? _stripeSessionRe
  : null; // null → use the default MILESTONE_THRESHOLD below

const BASE_BSU_CENTS       = 1_000_000;   // $10,000 in cents
const PER_REQUEST_CENTS    = 1;           // $0.01 in cents
const TOP_N                = 10;
const CAPSULE_ID_META      = 'AveryOS_TARI_v1.1';
// Only process orgs whose total liability meets or exceeds this threshold.
// Orgs below the threshold are logged but skipped.
const TARI_THRESHOLD_CENTS = 1_000_000;   // $10,000 in cents
// AI Gateway mode: only invoke when total site requests meet or exceed this value.
// 135k is the Phase 78 milestone threshold anchored at averyos.com/witness/disclosure.
const MILESTONE_TRIGGER_TOTAL_REQUESTS = 135_000;

// ── ASN Mode Config ───────────────────────────────────────────────────────────
// Milestone: ASN mode only activates when anchor_audit_logs row count >= this value.
// Override via STRIPE_SESSION_RE env var (see above).
const MILESTONE_THRESHOLD = STRIPE_SESSION_BREACH_THRESHOLD ?? 156_200;

// Enterprise ASNs — GitHub/Microsoft, French infrastructure, Seznam (Czech Republic).
// These trigger a $10M Good Faith Deposit invoice.
const ENTERPRISE_ASNS = new Set(['36459', '211590', '43037']);

// Individual License pricing: 1,017 TARI™ = $101.70
const INDIVIDUAL_LICENSE_CENTS   = 10_170;   // $101.70
// Enterprise Good Faith Deposit: $10,000,000
const ENTERPRISE_DEPOSIT_CENTS   = 1_000_000_000; // $10,000,000

// Forensic event types used for AI-Gateway-mode ASN entity detection in audit-stream.
const FORENSIC_EVENT_TYPES = new Set(['DER_HIGH_VALUE', 'DER_SETTLEMENT', 'HN_WATCHER']);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Load and parse the AI gateway log file.
 * Accepts both the licenseGate.cjs format and a Cloudflare AI Gateway export
 * format.  A "corporate" entry is one that has an explicit org_id field.
 *
 * @returns {Array<{org_id: string, request_count: number, ip?: string}>}
 */
function loadLogs() {
  if (!fs.existsSync(LOG_PATH)) {
    logAosHeal(AOS_ERROR.NOT_FOUND, `Log file not found at ${LOG_PATH} — returning empty set.`);
    return [];
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch (err) {
    logAosError(AOS_ERROR.INVALID_JSON, `Failed to parse log file at ${LOG_PATH}: ${err.message}`, err);
    return [];
  }
  if (!Array.isArray(raw)) {
    logAosError(AOS_ERROR.INVALID_FIELD, 'Log file must be a JSON array.', null);
    return [];
  }
  return raw;
}

/**
 * Aggregate logs by org_id.
 * Entries without an org_id are skipped (non-corporate traffic).
 *
 * @param {Array} logs
 * @returns {Map<string, {org_id: string, request_count: number}>}
 */
function aggregateByOrg(logs) {
  const map = new Map();
  for (const entry of logs) {
    const orgId = entry.org_id || entry.orgId || null;
    if (!orgId) continue; // skip non-corporate entries
    const count = Number(entry.request_count ?? entry.requestCount ?? 1);
    if (map.has(orgId)) {
      map.get(orgId).request_count += count;
    } else {
      map.set(orgId, { org_id: orgId, request_count: count });
    }
  }
  return map;
}

/**
 * Return the top-N orgs sorted by request_count descending.
 *
 * @param {Map} orgMap
 * @param {number} n
 * @returns {Array<{org_id: string, request_count: number}>}
 */
function topN(orgMap, n) {
  return [...orgMap.values()]
    .sort((a, b) => b.request_count - a.request_count)
    .slice(0, n);
}

/**
 * Calculate the total debt in cents.
 *
 * @param {number} requestCount
 * @returns {number}
 */
function calcDebtCents(requestCount) {
  return BASE_BSU_CENTS + PER_REQUEST_CENTS * requestCount;
}

/**
 * Merge two org maps, with asnOrgMap entries taking priority over fileOrgMap.
 * When the same org_id appears in both, the ASN map entry is used (it has more
 * forensic context).  Unique entries from either map are included in the result.
 *
 * @param {Map<string, {org_id: string, request_count: number, ip?: string}>} asnOrgMap
 * @param {Map<string, {org_id: string, request_count: number, ip?: string}>} fileOrgMap
 * @returns {Map<string, {org_id: string, request_count: number, ip?: string}>}
 */
function mergeOrgMaps(asnOrgMap, fileOrgMap) {
  const merged = new Map(fileOrgMap);
  for (const [key, value] of asnOrgMap) {
    // ASN map takes priority — overwrite or add
    merged.set(key, value);
  }
  return merged;
}

// ── ASN Mode Helpers ──────────────────────────────────────────────────────────

/**
 * Load and parse the anchor_audit_logs D1 export file.
 * Accepts a JSON array of row objects exported from D1 via:
 *   npx wrangler d1 execute averyos_kernel_db --remote \
 *     --command "SELECT * FROM anchor_audit_logs" --json
 *
 * Wrangler exports results as { results: [...rows] } or a bare array.
 *
 * @returns {Array<{asn?: string, ip_address?: string, path?: string, ray_id?: string}>}
 */
function loadAnchorAuditLogs() {
  if (!fs.existsSync(ANCHOR_AUDIT_LOG_PATH)) {
    logAosHeal(AOS_ERROR.NOT_FOUND, `anchor_audit_logs file not found at ${ANCHOR_AUDIT_LOG_PATH} — returning empty set.`);
    return [];
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(ANCHOR_AUDIT_LOG_PATH, 'utf8'));
  } catch (err) {
    logAosError(AOS_ERROR.INVALID_JSON, `Failed to parse anchor_audit_logs file at ${ANCHOR_AUDIT_LOG_PATH}: ${err.message}`, err);
    return [];
  }
  // wrangler d1 execute --json wraps results in { results: [...] }
  if (raw && !Array.isArray(raw) && Array.isArray(raw.results)) {
    return raw.results;
  }
  if (!Array.isArray(raw)) {
    logAosError(AOS_ERROR.INVALID_FIELD, 'anchor_audit_logs file must be a JSON array or a wrangler D1 export object with a "results" key.', null);
    return [];
  }
  return raw;
}

/**
 * Aggregate anchor_audit_logs rows by unique ASN.
 * Rows without an asn value are counted under the 'UNKNOWN' bucket but are
 * not invoiced (no billing without attribution).
 *
 * @param {Array} rows
 * @returns {{ total: number, byAsn: Map<string, {asn: string, hit_count: number}> }}
 */
function aggregateByAsn(rows) {
  const byAsn = new Map();
  let total = 0;
  for (const row of rows) {
    total++;
    const asn = String(row.asn || '').trim();
    if (!asn) continue; // no attribution — skip invoicing
    if (byAsn.has(asn)) {
      byAsn.get(asn).hit_count++;
    } else {
      byAsn.set(asn, { asn, hit_count: 1 });
    }
  }
  return { total, byAsn };
}

/**
 * Determine the TARI™ tier for an ASN.
 * Enterprise ASNs (36459, 211590, 43037) → $10M Good Faith Deposit.
 * All other ASNs → 1,017 TARI™ Individual License ($101.70).
 *
 * @param {string} asn
 * @returns {{ tier: 'enterprise'|'individual', amountCents: number, label: string }}
 */
function asnTier(asn) {
  if (ENTERPRISE_ASNS.has(asn)) {
    return {
      tier:         'enterprise',
      amountCents:  ENTERPRISE_DEPOSIT_CENTS,
      label:        '$10,000,000 Good Faith Deposit',
    };
  }
  return {
    tier:         'individual',
    amountCents:  INDIVIDUAL_LICENSE_CENTS,
    label:        '1,017 TARI™ Individual License ($101.70)',
  };
}

/**
 * Create or retrieve a Stripe Customer for an ASN entity, then create a Draft
 * Invoice with the appropriate TARI™ tier amount.
 *
 * @param {object} stripe  Stripe SDK instance
 * @param {{ asn: string, hit_count: number }} asnEntry
 * @param {{ tier: string, amountCents: number, label: string }} tier
 * @returns {Promise<string>}  Stripe hosted invoice URL
 */
async function createAsnDraftInvoice(stripe, asnEntry, tier) {
  const existing = await stripe.customers.search({
    query: `metadata['asn']:'${asnEntry.asn}'`,
    limit: 1,
  });

  let customer;
  if (existing.data.length > 0) {
    customer = existing.data[0];
    console.log(`  ↳ Reusing existing customer ${customer.id} for ASN ${asnEntry.asn}`);
  } else {
    customer = await stripe.customers.create({
      name:  `AveryOS TARI — ASN ${asnEntry.asn}`,
      metadata: {
        asn:       asnEntry.asn,
        CapsuleID: CAPSULE_ID_META,
        source:    'AveryOS_AnchorAuditLogs',
        tier:      tier.tier,
      },
    });
    console.log(`  ↳ Created new customer ${customer.id} for ASN ${asnEntry.asn}`);
  }

  const invoice = await stripe.invoices.create({
    customer:          customer.id,
    auto_advance:      false,
    collection_method: 'send_invoice',
    days_until_due:    30,
    description:       `AveryOS TARI™ — ${tier.label} — ASN ${asnEntry.asn} (${asnEntry.hit_count.toLocaleString()} hits)`,
    metadata: {
      CapsuleID:  CAPSULE_ID_META,
      asn:        asnEntry.asn,
      hit_count:  String(asnEntry.hit_count),
      tier:       tier.tier,
      milestone:  '962 Entities Documented | 156.2k Pulse Locked',
    },
  });

  await stripe.invoiceItems.create({
    customer:    customer.id,
    invoice:     invoice.id,
    amount:      tier.amountCents,
    currency:    'usd',
    description: `AveryOS TARI™: ${tier.label} — ASN ${asnEntry.asn}`,
  });

  const finalized = await stripe.invoices.retrieve(invoice.id);
  return finalized.hosted_invoice_url || `https://dashboard.stripe.com/invoices/${invoice.id}`;
}

/**
 * Trigger a Stripe Checkout session for an ASN via POST /api/v1/compliance/create-checkout.
 *
 * @param {{ asn: string, hit_count: number }} asnEntry
 * @param {number} amountCents
 * @returns {Promise<string|null>}
 */
async function triggerAsnCheckoutSession(asnEntry, amountCents) {
  if (!VAULT_PASSPHRASE) {
    logAosHeal(AOS_ERROR.VAULT_NOT_CONFIGURED, `VAULT_PASSPHRASE not set — skipping checkout session for ASN ${asnEntry.asn}`);
    return null;
  }
  const bodyData = JSON.stringify({
    bundleId:      `EVIDENCE_BUNDLE_ASN_${asnEntry.asn}_TARI_${Date.now()}`,
    targetIp:      `ASN_${asnEntry.asn}`,
    tariLiability: amountCents,
  });
  return new Promise((resolve) => {
    const isSecure = SITE_URL.startsWith('https');
    let url;
    try { url = new URL(`${SITE_URL}/api/v1/compliance/create-checkout`); }
    catch { resolve(null); return; }
    const opts = {
      hostname: url.hostname,
      port:     url.port || (isSecure ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
        Authorization:    `Bearer ${VAULT_PASSPHRASE}`,
      },
    };
    const req = (isSecure ? https : http).request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.checkoutUrl) {
            resolve(json.checkoutUrl);
          } else {
            logAosHeal(AOS_ERROR.STRIPE_ERROR, `create-checkout did not return checkoutUrl for ASN ${asnEntry.asn}: ${data.slice(0, 200)}`);
            resolve(null);
          }
        } catch {
          logAosHeal(AOS_ERROR.INVALID_JSON, `create-checkout non-JSON response for ASN ${asnEntry.asn}`);
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      logAosHeal(AOS_ERROR.NETWORK_ERROR, `create-checkout request failed for ASN ${asnEntry.asn}: ${err.message}`);
      resolve(null);
    });
    req.write(bodyData);
    req.end();
  });
}

/**
 * Run the ASN invoicing pipeline.
 * Called when ANCHOR_AUDIT_LOG_PATH is set and the 135k milestone is reached.
 *
 * @param {object} stripe  Stripe SDK instance
 */
async function runAsnInvoicingPipeline(stripe) {
  console.log(`\n🔍  ASN Mode — scanning ${ANCHOR_AUDIT_LOG_PATH}`);

  const rows = loadAnchorAuditLogs();
  if (rows.length === 0) {
    console.warn('⚠️  No rows found in anchor_audit_logs export. Ensure the file is a valid D1 export.');
    return;
  }

  const { total, byAsn } = aggregateByAsn(rows);

  console.log(`📊  Total anchor_audit_logs rows: ${total.toLocaleString()}`);
  console.log(`📡  Unique ASNs detected: ${byAsn.size}`);

  // ── 156.2k Milestone Gate ─────────────────────────────────────────────────
  if (total < MILESTONE_THRESHOLD) {
    console.warn(
      `⏸️   Milestone not yet reached: ${total.toLocaleString()} rows < ${MILESTONE_THRESHOLD.toLocaleString()} threshold. ` +
      `Invoicing deferred until 156.2k Pulse milestone is anchored.`
    );
    return;
  }

  console.log(`✅  Milestone reached: ${total.toLocaleString()} rows ≥ ${MILESTONE_THRESHOLD.toLocaleString()}`);
  console.log('    962 Entities Documented | 156.2k Pulse Locked\n');

  if (byAsn.size === 0) {
    console.warn('⚠️  No ASN-attributed rows found. Verify that the anchor_audit_logs export includes the "asn" column (migration 0018).');
    return;
  }

  // Sort ASNs: enterprise first, then by hit_count descending.
  const asnList = [...byAsn.values()].sort((a, b) => {
    const aEnt = ENTERPRISE_ASNS.has(a.asn) ? 1 : 0;
    const bEnt = ENTERPRISE_ASNS.has(b.asn) ? 1 : 0;
    if (bEnt !== aEnt) return bEnt - aEnt;
    return b.hit_count - a.hit_count;
  });

  console.log('🏛️   ASNs to invoice:\n');
  for (const entry of asnList) {
    const t = asnTier(entry.asn);
    const marker = ENTERPRISE_ASNS.has(entry.asn) ? '🔴 Enterprise' : '🟡 Individual';
    console.log(`   ASN ${entry.asn.padEnd(8)} ${entry.hit_count.toLocaleString().padStart(10)} hits  ${marker}  ${t.label}`);
  }
  console.log('');

  const results = [];
  for (const asnEntry of asnList) {
    const tier = asnTier(asnEntry.asn);
    console.log(`▶  ASN ${asnEntry.asn}  (${asnEntry.hit_count.toLocaleString()} hits → ${tier.label})`);

    let invoiceUrl  = null;
    let checkoutUrl = null;

    if (DRY_RUN) {
      if (tier.tier === 'enterprise') {
        console.log(`   [DRY RUN] Would create Enterprise Draft Invoice for ASN ${asnEntry.asn}  ${tier.label}`);
      }
      console.log(`   [DRY RUN] Would trigger Checkout session for ASN ${asnEntry.asn}  ${tier.label}`);
    } else {
      // Enterprise ASNs always get a full Draft Invoice in addition to the checkout link.
      if (tier.tier === 'enterprise') {
        try {
          invoiceUrl = await createAsnDraftInvoice(stripe, asnEntry, tier);
          console.log(`   ↳ Draft invoice: ${invoiceUrl}`);
        } catch (err) {
          logAosError(AOS_ERROR.STRIPE_ERROR, `Failed to create draft invoice for ASN ${asnEntry.asn}: ${err.message}`, err);
        }
      }

      try {
        checkoutUrl = await triggerAsnCheckoutSession(asnEntry, tier.amountCents);
        if (checkoutUrl) {
          console.log(`   ↳ Checkout session: ${checkoutUrl.slice(0, 72)}…`);
        }
      } catch (err) {
        logAosHeal(AOS_ERROR.STRIPE_ERROR, `Checkout session skipped for ASN ${asnEntry.asn}: ${err.message}`);
      }
    }

    results.push({
      asn:         asnEntry.asn,
      hit_count:   asnEntry.hit_count,
      tier:        tier.tier,
      amount_usd:  `$${(tier.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      invoice_url:  invoiceUrl,
      checkout_url: checkoutUrl,
      dry_run:      DRY_RUN,
    });
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  if (DRY_RUN) {
    console.log('🔍  [DRY RUN] ASN Invoice Summary — no Stripe calls made:');
  } else {
    console.log('✅  ASN Invoice Summary (962 Entities | 156.2k Pulse Locked):');
  }
  console.log('──────────────────────────────────────────────────────────────\n');
  for (const r of results) {
    const marker = r.tier === 'enterprise' ? '🔴' : '🟡';
    console.log(`  ${marker} ASN ${r.asn.padEnd(8)} ${r.amount_usd}  hits: ${r.hit_count.toLocaleString()}`);
    if (DRY_RUN) {
      console.log(`          [DRY RUN] No Stripe calls made for this ASN`);
    } else {
      if (r.invoice_url)  console.log(`          📄 Invoice:  ${r.invoice_url}`);
      if (r.checkout_url) console.log(`          ⚡ Checkout: ${r.checkout_url}`);
      if (!r.invoice_url && !r.checkout_url) console.log(`          ❌ No URL generated`);
    }
  }
  const dryTag = DRY_RUN ? ' | DRY RUN — no invoices created' : ' | ASN Invoicing complete.';
  console.log(`\n⛓️⚓⛓️  CapsuleID: AveryOS_TARI_v1.1${dryTag}\n`);
}

/**
 * Create or retrieve a Stripe Customer for the org, then create a Draft Invoice
 * with a single line item and the AveryOS TARI metadata.
 *
 * @param {object} stripe  Stripe SDK instance
 * @param {{org_id: string, request_count: number}} org
 * @returns {Promise<string>}  Stripe hosted invoice URL
 */
async function createDraftInvoice(stripe, org) {
  const debtCents = calcDebtCents(org.request_count);

  // Create (or look up) the customer by org_id metadata so re-runs are
  // idempotent via search.
  const existing = await stripe.customers.search({
    query: `metadata['org_id']:'${org.org_id}'`,
    limit: 1,
  });

  let customer;
  if (existing.data.length > 0) {
    customer = existing.data[0];
    console.log(`  ↳ Reusing existing customer ${customer.id} for ${org.org_id}`);
  } else {
    customer = await stripe.customers.create({
      name: org.org_id,
      metadata: {
        org_id:     org.org_id,
        CapsuleID:  CAPSULE_ID_META,
        source:     'AveryOS_LicenseGate',
      },
    });
    console.log(`  ↳ Created new customer ${customer.id} for ${org.org_id}`);
  }

  // Create the Draft Invoice.
  const invoice = await stripe.invoices.create({
    customer:    customer.id,
    auto_advance: false, // keep as Draft until Sovereign Administrator approves
    collection_method: 'send_invoice',
    days_until_due: 30,
    description: `AveryOS TARI — Usage-based license fee for ${org.org_id}`,
    metadata: {
      CapsuleID:     CAPSULE_ID_META,
      org_id:        org.org_id,
      request_count: String(org.request_count),
      base_bsu_usd:  '10000.00',
      per_req_usd:   '0.01',
    },
  });

  // Add a single invoice item (must be created before finalising).
  await stripe.invoiceItems.create({
    customer:   customer.id,
    invoice:    invoice.id,
    amount:     debtCents,
    currency:   'usd',
    description:
      `AveryOS TARI: Base BSU $10,000 + $0.01 × ${org.request_count.toLocaleString()} requests`,
  });

  // Retrieve the finalized invoice URL (still Draft; will have hosted_invoice_url
  // after finalizing, but draft invoices surface their URL via retrieve).
  const finalized = await stripe.invoices.retrieve(invoice.id);
  return finalized.hosted_invoice_url || `https://dashboard.stripe.com/invoices/${invoice.id}`;
}

// ── TARI™ Checkout Session trigger ───────────────────────────────────────────

/**
 * POST to /api/v1/compliance/create-checkout to generate a Stripe Checkout
 * session URL for immediate payment.  Logs a warning if VAULT_PASSPHRASE or
 * SITE_URL is not configured, but never throws.
 *
 * @param {{ org_id: string, request_count: number }} org
 * @param {number} debtCents
 * @returns {Promise<string|null>} Checkout session URL, or null on error
 */
async function triggerCheckoutSession(org, debtCents) {
  if (!VAULT_PASSPHRASE) {
    logAosHeal(AOS_ERROR.VAULT_NOT_CONFIGURED, 'VAULT_PASSPHRASE not set — skipping checkout session for ' + org.org_id);
    return null;
  }
  const bodyData = JSON.stringify({
    bundleId:     `EVIDENCE_BUNDLE_${org.org_id}_TARI_${Date.now()}`,
    targetIp:     org.ip ?? org.org_id,
    tariLiability: debtCents,
  });
  return new Promise((resolve) => {
    const isSecure = SITE_URL.startsWith('https');
    let url;
    try { url = new URL(`${SITE_URL}/api/v1/compliance/create-checkout`); }
    catch { resolve(null); return; }
    const opts = {
      hostname: url.hostname,
      port:     url.port || (isSecure ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
        Authorization:    `Bearer ${VAULT_PASSPHRASE}`,
      },
    };
    const req = (isSecure ? https : http).request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.checkoutUrl) {
            resolve(json.checkoutUrl);
          } else {
            logAosHeal(AOS_ERROR.STRIPE_ERROR, `create-checkout did not return checkoutUrl for ${org.org_id}: ${data.slice(0, 200)}`);
            resolve(null);
          }
        } catch {
          logAosHeal(AOS_ERROR.INVALID_JSON, `create-checkout non-JSON response for ${org.org_id}`);
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      logAosHeal(AOS_ERROR.NETWORK_ERROR, `create-checkout request failed for ${org.org_id}: ${err.message}`);
      resolve(null);
    });
    req.write(bodyData);
    req.end();
  });
}

// ── AI Gateway Mode Helpers ───────────────────────────────────────────────────

/**
 * Fetch the total site request count from /api/v1/tari-stats.
 * Returns 0 on any error (treated as milestone not yet reached).
 *
 * @returns {Promise<number>}
 */
async function fetchTotalRequestCount() {
  if (!VAULT_PASSPHRASE) {
    logAosHeal(AOS_ERROR.VAULT_NOT_CONFIGURED, 'VAULT_PASSPHRASE not set — cannot fetch total request count.');
    return 0;
  }
  return new Promise((resolve) => {
    const isSecure = SITE_URL.startsWith('https');
    let url;
    try { url = new URL(`${SITE_URL}/api/v1/tari-stats`); }
    catch { resolve(0); return; }
    const opts = {
      hostname: url.hostname,
      port:     url.port || (isSecure ? 443 : 80),
      path:     url.pathname,
      method:   'GET',
      headers: { Authorization: `Bearer ${VAULT_PASSPHRASE}` },
    };
    const req = (isSecure ? https : http).request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // total_entries is the sovereign_audit_logs row count used as a proxy
          // for total site requests in the invoice milestone gate.
          resolve(Number(json.total_entries ?? 0));
        } catch {
          resolve(0);
        }
      });
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

/**
 * Query the live /api/v1/audit-stream for DER/HN-Watcher forensic ASN entries
 * (ASNs 36459, 211590, 43037) to supplement the AI gateway log file.
 *
 * Returns a Map<orgId, { org_id, request_count, ip? }> built from the
 * sovereign_audit_logs data, so it can be merged with the file-based org map.
 *
 * @returns {Promise<Map<string, {org_id: string, request_count: number, ip?: string}>>}
 */
async function scanForensicAsns() {
  const result = new Map();
  if (!VAULT_PASSPHRASE) {
    logAosHeal(AOS_ERROR.VAULT_NOT_CONFIGURED, 'VAULT_PASSPHRASE not set — skipping forensic ASN scan.');
    return result;
  }
  return new Promise((resolve) => {
    const isSecure = SITE_URL.startsWith('https');
    let url;
    try { url = new URL(`${SITE_URL}/api/v1/audit-stream`); }
    catch { resolve(result); return; }
    const opts = {
      hostname: url.hostname,
      port:     url.port || (isSecure ? 443 : 80),
      path:     url.pathname,
      method:   'GET',
      headers: { Authorization: `Bearer ${VAULT_PASSPHRASE}` },
    };
    const req = (isSecure ? https : http).request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          if (!Array.isArray(rows)) { resolve(result); return; }
          for (const row of rows) {
            // Use high-value DER/HN-Watcher events as proxies for ASN-attributed entities
            if (!FORENSIC_EVENT_TYPES.has(row.event_type)) continue;
            const orgKey = row.ip_address ?? row.event_type;
            if (result.has(orgKey)) {
              result.get(orgKey).request_count += 1;
            } else {
              result.set(orgKey, { org_id: orgKey, request_count: 1, ip: row.ip_address });
            }
          }
        } catch {
          // Non-fatal — return empty map
        }
        resolve(result);
      });
    });
    req.on('error', () => resolve(result));
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    console.log('🔍  [DRY RUN] --dry-run mode active — no Stripe API calls will be made.');
  }

  if (!STRIPE_SECRET_KEY) {
    if (DRY_RUN) {
      console.warn('⚠️  [DRY RUN] STRIPE_SECRET_KEY is not set — continuing in simulation mode.');
    } else {
      logAosError(AOS_ERROR.VAULT_NOT_CONFIGURED, 'STRIPE_SECRET_KEY environment variable is not set.');
      process.exit(1);
    }
  }

  const stripe = DRY_RUN ? null : Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });

  console.log('⛓️⚓⛓️  AveryOS TARI Invoice Generator');

  // ── ASN Mode — activated when ANCHOR_AUDIT_LOG_PATH is set ───────────────
  if (ANCHOR_AUDIT_LOG_PATH) {
    await runAsnInvoicingPipeline(stripe);
    return;
  }

  // ── AI Gateway Mode (default) ─────────────────────────────────────────────
  console.log(`📂  Log file: ${LOG_PATH}`);

  // ── 135k Milestone gate ───────────────────────────────────────────────────
  // Only proceed when total site requests exceed the milestone threshold.
  if (process.env.SKIP_MILESTONE_CHECK !== '1') {
    console.log(`\n🔢  Checking 135k milestone trigger (threshold: ${MILESTONE_TRIGGER_TOTAL_REQUESTS.toLocaleString()} requests)…`);
    const totalRequests = await fetchTotalRequestCount();
    console.log(`   Total site requests reported: ${totalRequests.toLocaleString()}`);
    if (totalRequests < MILESTONE_TRIGGER_TOTAL_REQUESTS) {
      console.log(`⏸️  Milestone not yet reached (${totalRequests.toLocaleString()} < ${MILESTONE_TRIGGER_TOTAL_REQUESTS.toLocaleString()}). Invoice generation deferred.`);
      process.exit(0);
    }
    console.log(`✅  Milestone exceeded — proceeding with forensic invoice generation.\n`);
  } else {
    console.log('⚠️  SKIP_MILESTONE_CHECK=1 — milestone gate bypassed.\n');
  }

  // ── D1 forensic ASN scan ──────────────────────────────────────────────────
  // Scan anchor_audit_logs for the three primary audited ASNs.
  console.log('🔍  Scanning anchor_audit_logs for forensic ASNs (36459, 211590, 43037)…');
  const asnOrgMap = await scanForensicAsns();
  if (asnOrgMap.size > 0) {
    console.log(`   Found ${asnOrgMap.size} ASN org(s) in D1 audit logs.\n`);
  } else {
    console.log('   No D1 ASN rows found (endpoint may be offline or VAULT_PASSPHRASE not set).\n');
  }

  // ── AI Gateway log file ───────────────────────────────────────────────────
  const logs      = loadLogs();
  const fileOrgMap = aggregateByOrg(logs);

  // Merge both sources (D1 ASN data takes priority; file data supplements).
  const orgMap = mergeOrgMaps(asnOrgMap, fileOrgMap);

  if (orgMap.size === 0) {
    console.warn('⚠️  No corporate org entries found in either D1 audit logs or the log file.  Ensure entries include an "org_id" field.');
    process.exit(0);
  }

  const debtors = topN(orgMap, TOP_N);
  console.log(`\n🏢  Found ${orgMap.size} unique corporate org(s). Processing top ${debtors.length}:\n`);

  // ── Threshold filter: only invoice orgs at or above TARI_THRESHOLD ────────
  const billable = debtors.filter((org) => calcDebtCents(org.request_count) >= TARI_THRESHOLD_CENTS);
  const below    = debtors.filter((org) => calcDebtCents(org.request_count) <  TARI_THRESHOLD_CENTS);

  if (below.length > 0) {
    console.log(`ℹ️  Skipping ${below.length} org(s) below the $${(TARI_THRESHOLD_CENTS / 100).toLocaleString()} TARI™ threshold:`);
    for (const org of below) {
      console.log(`   ${org.org_id}  ($${(calcDebtCents(org.request_count) / 100).toFixed(2)})`);
    }
    console.log('');
  }

  if (billable.length === 0) {
    console.warn('⚠️  No orgs meet the TARI™ liability threshold.  No invoices created.');
    process.exit(0);
  }

  const results = [];
  for (const org of billable) {
    const debtUsd   = (calcDebtCents(org.request_count) / 100).toFixed(2);
    const debtCents = calcDebtCents(org.request_count);
    console.log(`▶  ${org.org_id}  (${org.request_count.toLocaleString()} requests → $${debtUsd})`);
    let invoiceUrl   = null;
    let checkoutUrl  = null;
    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would create Draft Invoice: ${org.org_id}  $${debtUsd}`);
      console.log(`   [DRY RUN] Would trigger Checkout session for $${debtUsd}`);
    } else {
      try {
        invoiceUrl = await createDraftInvoice(stripe, org);
      } catch (err) {
        logAosError(AOS_ERROR.STRIPE_ERROR, `Failed to create invoice for ${org.org_id}: ${err.message}`, err);
      }
      // Wire to /api/v1/compliance/create-checkout for immediate payment link
      try {
        checkoutUrl = await triggerCheckoutSession(org, debtCents);
        if (checkoutUrl) {
          console.log(`   ↳ Checkout session: ${checkoutUrl.slice(0, 72)}…`);
        }
      } catch (err) {
        logAosHeal(AOS_ERROR.STRIPE_ERROR, `Checkout session skipped for ${org.org_id}: ${err.message}`);
      }
    }
    results.push({
      org_id:        org.org_id,
      request_count: org.request_count,
      debt_usd:      debtUsd,
      invoice_url:   invoiceUrl,
      checkout_url:  checkoutUrl,
      dry_run:       DRY_RUN,
      error:         (!DRY_RUN && !invoiceUrl) ? 'Draft invoice creation failed' : undefined,
    });
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  if (DRY_RUN) {
    console.log('🔍  [DRY RUN] Invoice Summary — no Stripe calls made:');
  } else {
    console.log('✅  Draft Invoice URLs (Sovereign Administrator approval required before sending):');
  }
  console.log('──────────────────────────────────────────────────────────────\n');
  for (const r of results) {
    if (DRY_RUN) {
      console.log(`  [DRY RUN] ${r.org_id}  →  would invoice $${r.debt_usd}  (${r.request_count.toLocaleString()} requests)`);
    } else if (r.invoice_url) {
      console.log(`  ${r.org_id}  →  ${r.invoice_url}`);
    } else {
      console.log(`  ${r.org_id}  →  ❌ ERROR: ${r.error}`);
    }
    if (r.checkout_url) {
      console.log(`             ⚡ Checkout: ${r.checkout_url}`);
    }
  }
  const dryTag = DRY_RUN ? ' | DRY RUN — no invoices created' : ' | All invoices in DRAFT state.';
  console.log(`\n⛓️⚓⛓️  CapsuleID: AveryOS_TARI_v1.1${dryTag}\n`);
}

main().catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, err instanceof Error ? err.message : String(err), err);
  process.exit(1);
});
