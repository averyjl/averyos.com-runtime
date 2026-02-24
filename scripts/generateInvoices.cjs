/**
 * generateInvoices.cjs
 * AveryOS TARI Invoice Generator — integrates with licenseGate.cjs AI gateway logs.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... node scripts/generateInvoices.cjs
 *
 * Data source: capsule_logs/ai_gateway_logs.json (Cloudflare AI Gateway export)
 * Pricing:     $10,000 (Base BSU) + ($0.01 × request_count) per corporate org_id
 * Metadata:    CapsuleID: AveryOS_TARI_v1.1
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const Stripe = require('stripe');

// ── Config ────────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY;
const LOG_PATH             = process.env.AI_GATEWAY_LOG_PATH
  || path.join(process.cwd(), 'capsule_logs', 'ai_gateway_logs.json');
const BASE_BSU_CENTS       = 1_000_000;   // $10,000 in cents
const PER_REQUEST_CENTS    = 1;           // $0.01 in cents
const TOP_N                = 10;
const CAPSULE_ID_META      = 'AveryOS_TARI_v1.1';

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
    console.error(`⚠️  Log file not found: ${LOG_PATH}`);
    return [];
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch (err) {
    console.error(`⚠️  Failed to parse log file: ${err.message}`);
    return [];
  }
  if (!Array.isArray(raw)) {
    console.error('⚠️  Log file must be a JSON array.');
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!STRIPE_SECRET_KEY) {
    console.error('❌  STRIPE_SECRET_KEY environment variable is not set.');
    process.exit(1);
  }

  const stripe = Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });

  console.log('⛓️⚓⛓️  AveryOS TARI Invoice Generator');
  console.log(`📂  Log file: ${LOG_PATH}`);

  const logs   = loadLogs();
  const orgMap = aggregateByOrg(logs);

  if (orgMap.size === 0) {
    console.warn('⚠️  No corporate org entries found in the log file.  Ensure entries include an "org_id" field.');
    process.exit(0);
  }

  const debtors = topN(orgMap, TOP_N);
  console.log(`\n🏢  Found ${orgMap.size} unique corporate org(s). Processing top ${debtors.length}:\n`);

  const results = [];
  for (const org of debtors) {
    const debtUsd = (calcDebtCents(org.request_count) / 100).toFixed(2);
    console.log(`▶  ${org.org_id}  (${org.request_count.toLocaleString()} requests → $${debtUsd})`);
    try {
      const url = await createDraftInvoice(stripe, org);
      results.push({ org_id: org.org_id, request_count: org.request_count, debt_usd: debtUsd, invoice_url: url });
    } catch (err) {
      console.error(`   ❌ Failed to create invoice for ${org.org_id}: ${err.message}`);
      results.push({ org_id: org.org_id, request_count: org.request_count, debt_usd: debtUsd, invoice_url: null, error: err.message });
    }
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
  }
  console.log('\n⛓️⚓⛓️  CapsuleID: AveryOS_TARI_v1.1 | All invoices in DRAFT state.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
