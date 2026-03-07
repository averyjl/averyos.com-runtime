/**
 * generateInvoices.cjs
 * AveryOS TARI Invoice Generator — integrates with licenseGate.cjs AI gateway logs
 * and the Cloudflare D1 `anchor_audit_logs` table (ASN-based forensic scanning).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... node scripts/generateInvoices.cjs
 *
 * Data source (in priority order):
 *   1. Cloudflare D1 `anchor_audit_logs` — ASN-based forensic scan (ASNs 36459, 211590, 43037)
 *   2. capsule_logs/ai_gateway_logs.json — Cloudflare AI Gateway export (fallback)
 * Milestone trigger: only proceed when the total request count exceeds MILESTONE_TRIGGER_TOTAL_REQUESTS.
 * Pricing:     $10,000 (Base BSU) + ($0.01 × request_count) per corporate org_id
 * Metadata:    CapsuleID: AveryOS_TARI_v1.1
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const Stripe = require('stripe');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Config ────────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY;
const SITE_URL             = (process.env.SITE_URL ?? 'https://averyos.com').replace(/\/$/, '');
const VAULT_PASSPHRASE     = process.env.VAULT_PASSPHRASE ?? '';
const LOG_PATH             = process.env.AI_GATEWAY_LOG_PATH
  || path.join(process.cwd(), 'capsule_logs', 'ai_gateway_logs.json');
const BASE_BSU_CENTS       = 1_000_000;   // $10,000 in cents
const PER_REQUEST_CENTS    = 1;           // $0.01 in cents
const TOP_N                = 10;
const CAPSULE_ID_META      = 'AveryOS_TARI_v1.1';
// Only process orgs whose total liability meets or exceeds this threshold.
// Orgs below the threshold are logged but skipped.
const TARI_THRESHOLD_CENTS = 1_000_000;   // $10,000 in cents

// ── 135k Milestone trigger ────────────────────────────────────────────────────
// Invoice generation only proceeds once total site requests exceed this threshold.
// Set SKIP_MILESTONE_CHECK=1 to bypass (e.g. for testing).
const MILESTONE_TRIGGER_TOTAL_REQUESTS = 135_000;

// ── Forensic ASN list ─────────────────────────────────────────────────────────
// ASNs whose traffic is scanned from `anchor_audit_logs` for TARI™ liability.
//   36459 — GitHub, Inc. (AI scraping pipelines)
//   211590 — AS211590 France (flagged research entity)
//   43037 — Seznam a.s. (Czech Republic)
const FORENSIC_ASNS = ['36459', '211590', '43037'];

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

// ── D1 Forensic ASN Scanner ───────────────────────────────────────────────────

/**
 * ASN → canonical org_id mapping for forensic invoicing.
 * These are the three primary ASNs audited by the AveryOS™ Sovereign Kernel.
 *
 * @type {Record<string, string>}
 */
const ASN_ORG_MAP = {
  '36459':  'GitHub_ASN36459',
  '211590': 'AS211590_France',
  '43037':  'Seznam_ASN43037',
};

/**
 * Query the `/api/v1/compliance/usage-report` endpoint to fetch the total
 * request count seen by the site.  Used to evaluate the 135k milestone trigger.
 *
 * Returns 0 if the endpoint is unreachable or returns an unexpected payload.
 *
 * @returns {Promise<number>}
 */
async function fetchTotalRequestCount() {
  return new Promise((resolve) => {
    const isSecure = SITE_URL.startsWith('https');
    let url;
    try { url = new URL(`${SITE_URL}/api/v1/compliance/usage-report`); }
    catch (e) {
      logAosHeal(AOS_ERROR.NETWORK_ERROR, `Invalid SITE_URL for usage-report: ${SITE_URL} — ${e instanceof Error ? e.message : String(e)}`);
      resolve(0); return;
    }
    const opts = {
      hostname: url.hostname,
      port:     url.port || (isSecure ? 443 : 80),
      path:     url.pathname,
      method:   'GET',
      headers:  { 'Accept': 'application/json' },
    };
    const req = (isSecure ? https : http).request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // The usage-report endpoint returns { interaction_count, ... }
          const count = Number(json.interaction_count ?? json.request_count ?? 0);
          resolve(Number.isFinite(count) ? count : 0);
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
 * Query the `/api/v1/audit-alert` endpoint to retrieve anchor_audit_logs rows
 * for a specific ASN.  Returns an array of log entries.
 *
 * Falls back to an empty array if the endpoint is unavailable or unauthorised.
 *
 * @param {string} asn  — e.g. '36459'
 * @returns {Promise<Array<{ip_address: string, request_count?: number}>>}
 */
async function fetchAsnAuditRows(asn) {
  return new Promise((resolve) => {
    if (!VAULT_PASSPHRASE) { resolve([]); return; }
    const isSecure = SITE_URL.startsWith('https');
    let url;
    try { url = new URL(`${SITE_URL}/api/v1/audit-alert?asn=${encodeURIComponent(asn)}&limit=1000`); }
    catch (e) {
      logAosHeal(AOS_ERROR.NETWORK_ERROR, `Invalid SITE_URL for audit-alert ASN ${asn}: ${SITE_URL} — ${e instanceof Error ? e.message : String(e)}`);
      resolve([]); return;
    }
    const opts = {
      hostname: url.hostname,
      port:     url.port || (isSecure ? 443 : 80),
      path:     `${url.pathname}${url.search}`,
      method:   'GET',
      headers:  {
        'Accept':        'application/json',
        'Authorization': `Bearer ${VAULT_PASSPHRASE}`,
      },
    };
    const req = (isSecure ? https : http).request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(Array.isArray(json.rows) ? json.rows : Array.isArray(json) ? json : []);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

/**
 * Scan anchor_audit_logs for all FORENSIC_ASNS and return an org map
 * suitable for invoice generation.
 *
 * Each ASN is mapped to a canonical org_id (see ASN_ORG_MAP).  Total request
 * counts are derived from the number of log rows returned per ASN.
 *
 * @returns {Promise<Map<string, {org_id: string, request_count: number}>>}
 */
async function scanForensicAsns() {
  const map = new Map();
  for (const asn of FORENSIC_ASNS) {
    const rows = await fetchAsnAuditRows(asn);
    if (rows.length === 0) continue;
    const orgId = ASN_ORG_MAP[asn] ?? `ASN_${asn}`;
    const totalRequests = rows.reduce((sum, r) => sum + Number(r.request_count ?? 1), 0);
    if (map.has(orgId)) {
      map.get(orgId).request_count += totalRequests;
    } else {
      map.set(orgId, { org_id: orgId, request_count: totalRequests });
    }
    console.log(`  🔍  ASN ${asn} (${orgId}): ${rows.length} audit rows, ${totalRequests.toLocaleString()} total requests`);
  }
  return map;
}

/**
 * Merge two org maps, summing request_count for shared org_ids.
 *
 * @param {Map} a
 * @param {Map} b
 * @returns {Map}
 */
function mergeOrgMaps(a, b) {
  const merged = new Map(a);
  for (const [key, val] of b) {
    if (merged.has(key)) {
      merged.get(key).request_count += val.request_count;
    } else {
      merged.set(key, { ...val });
    }
  }
  return merged;
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!STRIPE_SECRET_KEY) {
    logAosError(AOS_ERROR.VAULT_NOT_CONFIGURED, 'STRIPE_SECRET_KEY environment variable is not set.');
    process.exit(1);
  }

  const stripe = Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });

  console.log('⛓️⚓⛓️  AveryOS TARI Invoice Generator');
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
    results.push({
      org_id:        org.org_id,
      request_count: org.request_count,
      debt_usd:      debtUsd,
      invoice_url:   invoiceUrl,
      checkout_url:  checkoutUrl,
      error:         invoiceUrl ? undefined : 'Draft invoice creation failed',
    });
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('✅  Draft Invoice URLs (Sovereign Administrator approval required before sending):');
  console.log('──────────────────────────────────────────────────────────────\n');
  for (const r of results) {
    if (r.invoice_url) {
      console.log(`  ${r.org_id}  →  ${r.invoice_url}`);
    } else {
      console.log(`  ${r.org_id}  →  ❌ ERROR: ${r.error}`);
    }
    if (r.checkout_url) {
      console.log(`             ⚡ Checkout: ${r.checkout_url}`);
    }
  }
  console.log('\n⛓️⚓⛓️  CapsuleID: AveryOS_TARI_v1.1 | All invoices in DRAFT state.\n');
}

main().catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, err instanceof Error ? err.message : String(err), err);
  process.exit(1);
});
