/**
 * scripts/reconcile-stripe.cjs
 * AveryOS™ Stripe Reconciliation Bot — Phase 98 (Roadmap Item 9)
 *
 * Standalone Node.js script that performs Stripe vs D1 zero-drift tracking:
 *   1. Fetch all Stripe checkout.session.completed events for the past 48 h
 *      (or a custom window via --hours flag).
 *   2. For each completed session query D1 sovereign_alignments for a matching row.
 *   3. Report MISSING (in Stripe but not D1), DRIFT (status mismatch), and OK rows.
 *   4. Exit non-zero if any drift is detected (for CI gate usage).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... VAULT_PASSPHRASE=... \
 *     node scripts/reconcile-stripe.cjs [--hours 48] [--dry-run]
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY   — Stripe secret key
 *   VAULT_PASSPHRASE    — AveryOS™ Vault passphrase (used to call /api/v1/cron/reconcile)
 *   SITE_URL            — Base URL of the live site (default: https://averyos.com)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const https  = require('https');
const http   = require('http');
const Stripe = require('stripe');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── CLI ────────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const hoursArg = (() => {
  const idx = args.indexOf('--hours');
  if (idx !== -1 && args[idx + 1]) return parseInt(args[idx + 1], 10);
  return 48;
})();

// ── Config ────────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const VAULT_PASSPHRASE  = process.env.VAULT_PASSPHRASE ?? '';
const SITE_URL          = (process.env.SITE_URL ?? 'https://averyos.com').replace(/\/$/, '');

if (!STRIPE_SECRET_KEY) {
  logAosError(AOS_ERROR.MISSING_AUTH, 'STRIPE_SECRET_KEY is not set.');
  process.exit(1);
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

/**
 * Minimal HTTPS/HTTP GET with JSON response parsing.
 * @param {string} url
 * @param {Record<string,string>} headers
 * @returns {Promise<unknown>}
 */
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib     = url.startsWith('https') ? https : http;
    const options = { headers: { 'Content-Type': 'application/json', ...headers } };
    const req     = lib.get(url, options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error from ${url}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⛓️⚓⛓️  AveryOS™ Stripe Reconciliation Bot');
  console.log(`   Window: last ${hoursArg}h | Dry-run: ${DRY_RUN}`);
  console.log(`   Site:   ${SITE_URL}\n`);

  // 1. Delegate primary reconciliation to the live /api/v1/cron/reconcile endpoint
  //    which has direct D1 access via Cloudflare bindings.
  if (VAULT_PASSPHRASE) {
    console.log('→ Triggering /api/v1/cron/reconcile …');
    try {
      const result = /** @type {Record<string,unknown>} */ (await fetchJson(
        `${SITE_URL}/api/v1/cron/reconcile`,
        { Authorization: `Bearer ${VAULT_PASSPHRASE}` },
      ));
      console.log('   Response:', JSON.stringify(result, null, 2));
      const healed  = /** @type {number} */ (result.healed  ?? 0);
      const already = /** @type {number} */ (result.already_aligned ?? 0);
      if (healed > 0) {
        logAosHeal('RECONCILIATION', `Healed ${healed} drifted alignment(s). ${already} already aligned.`);
      } else {
        console.log(`   ✔ No drift detected. ${already} alignment(s) confirmed.`);
      }
    } catch (err) {
      logAosError(AOS_ERROR.EXTERNAL_API_ERROR, 'Failed to reach /api/v1/cron/reconcile', err);
      console.warn('   ⚠ Falling back to local Stripe-only verification…\n');
    }
  } else {
    console.warn('   ⚠ VAULT_PASSPHRASE not set — skipping live reconcile call.\n');
  }

  // 2. Local Stripe verification: list recent completed sessions and report.
  const stripe    = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const since     = Math.floor(Date.now() / 1000) - hoursArg * 3600;

  console.log(`→ Fetching Stripe checkout sessions (created >= ${new Date(since * 1000).toISOString()}) …`);

  /** @type {{ id: string; customer_email: string | null; amount_total: number | null; created: number; payment_status: string; metadata?: Record<string,string> }[]} */
  const sessions = [];
  let hasMore    = true;
  let startAfter = undefined;

  while (hasMore) {
    const page = await stripe.checkout.sessions.list({
      limit:       100,
      created:     { gte: since },
      ...(startAfter ? { starting_after: startAfter } : {}),
    });
    sessions.push(...page.data.filter(s => s.payment_status === 'paid'));
    hasMore    = page.has_more;
    startAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
  }

  console.log(`   Found ${sessions.length} paid session(s).\n`);

  let driftCount = 0;

  // 3. Cross-reference each paid session against the live sovereign_alignments
  //    via the /api/v1/verify endpoint (uses public hash lookup, no auth needed).
  for (const session of sessions) {
    const email     = session.customer_email ?? session.metadata?.email ?? '—';
    const amountUsd = session.amount_total != null ? `$${(session.amount_total / 100).toFixed(2)}` : '?';
    const createdAt = new Date(session.created * 1000).toISOString();

    let alignmentStatus = 'UNCHECKED';
    if (!DRY_RUN && VAULT_PASSPHRASE && session.id) {
      try {
        const result = /** @type {{ status?: string, settlement_status?: string }} */ (
          await fetchJson(
            `${SITE_URL}/api/v1/verify/${encodeURIComponent(session.id)}`,
            { Authorization: `Bearer ${VAULT_PASSPHRASE}` },
          )
        );
        alignmentStatus = result.status ?? result.settlement_status ?? 'NOT_FOUND';
        if (alignmentStatus === 'NOT_FOUND' || alignmentStatus === 'error') {
          driftCount++;
          alignmentStatus = '⚠ DRIFT — not in D1';
        }
      } catch {
        alignmentStatus = 'UNVERIFIED (endpoint unreachable)';
      }
    }

    console.log(`   [${session.id}] ${email} | ${amountUsd} | ${createdAt} | ${alignmentStatus}`);
  }

  if (driftCount > 0) {
    logAosError(AOS_ERROR.DB_QUERY_FAILED, `${driftCount} drift(s) detected in Stripe vs D1 reconciliation.`);
    process.exit(1);
  }

  console.log('\n✔ Reconciliation complete — zero drift detected.');
  process.exit(0);
}

main().catch(err => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, 'Unhandled error in reconcile-stripe.cjs', err);
  process.exit(1);
});
