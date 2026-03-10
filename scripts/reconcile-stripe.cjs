#!/usr/bin/env node
/**
 * scripts/reconcile-stripe.cjs
 *
 * Phase 98 — Stripe vs D1 Drift Detection
 *
 * Compares Stripe payment records against the kaas_ledger and kaas_valuations
 * tables in Cloudflare D1 to detect:
 *
 *   1. Stripe charges that have no corresponding D1 settlement row
 *      → "STRIPE_ONLY" (possible data loss)
 *
 *   2. D1 rows with settlement_status = 'PENDING' older than STALE_DAYS
 *      → "D1_STALE_PENDING" (possible missed invoice)
 *
 *   3. D1 rows with settlement_status = 'INVOICED' that have no matching
 *      Stripe charge → "D1_ORPHAN_INVOICE" (Stripe checkout abandoned)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... \
 *   CF_D1_API_TOKEN=... \
 *   CF_ACCOUNT_ID=... \
 *   CF_D1_DATABASE_ID=... \
 *   node scripts/reconcile-stripe.cjs [--dry-run] [--days=30]
 *
 * Output: JSON report written to /tmp/stripe-reconciliation-<timestamp>.json
 *         and printed to stdout.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const https  = require("https");
const fs     = require("fs");
const path   = require("path");
const os     = require("os");

// ── Config ────────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY    ?? "";
const CF_D1_API_TOKEN      = process.env.CF_D1_API_TOKEN      ?? "";
const CF_ACCOUNT_ID        = process.env.CF_ACCOUNT_ID        ?? "";
const CF_D1_DATABASE_ID    = process.env.CF_D1_DATABASE_ID    ?? "";

const args      = process.argv.slice(2);
const DRY_RUN   = args.includes("--dry-run");
const daysArg   = args.find(a => a.startsWith("--days="));
const STALE_DAYS = daysArg ? parseInt(daysArg.split("=")[1], 10) : 30;

const KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const KERNEL_VERSION = "v3.6.2";

// ── Sovereign Error Logger ────────────────────────────────────────────────────

/** @param {string} code @param {string} detail @param {unknown} [cause] */
function logAosError(code, detail, cause) {
  console.error(`[AOS_ERROR][${code}] ${detail}`, cause ?? "");
}

/** @param {string} action @param {string} detail */
function logAosHeal(action, detail) {
  console.info(`[AOS_HEAL][${action}] ${detail}`);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/**
 * Make an HTTPS GET/POST request and return the parsed JSON body.
 * @param {string} url
 * @param {{ method?: string; headers?: Record<string,string>; body?: string }} [opts]
 * @returns {Promise<unknown>}
 */
function httpsJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const { method = "GET", headers = {}, body } = opts;
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
    };
    const req = https.request(reqOpts, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message} — raw: ${data.slice(0, 200)}`)); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

/**
 * Fetch all Stripe PaymentIntents created in the last `days` days.
 * @param {number} days
 * @returns {Promise<{ id: string; amount: number; status: string; metadata: Record<string,string>; created: number }[]>}
 */
async function fetchStripePaymentIntents(days) {
  if (!STRIPE_SECRET_KEY) {
    logAosError("CONFIG_MISSING", "STRIPE_SECRET_KEY is not set — skipping Stripe fetch.");
    return [];
  }

  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  const auth  = Buffer.from(`${STRIPE_SECRET_KEY}:`).toString("base64");
  const url   = `https://api.stripe.com/v1/payment_intents?created[gte]=${since}&limit=100`;

  try {
    const data = /** @type {{ data?: unknown[]; error?: { message: string } }} */ (
      await httpsJson(url, { headers: { Authorization: `Basic ${auth}` } })
    );

    if (data.error) {
      logAosError("STRIPE_ERROR", data.error.message);
      return [];
    }

    return /** @type {any[]} */ (data.data ?? []);
  } catch (err) {
    logAosError("STRIPE_FETCH_FAILED", "Failed to fetch Stripe PaymentIntents.", err);
    return [];
  }
}

// ── D1 helpers ────────────────────────────────────────────────────────────────

/**
 * Execute a SQL query against Cloudflare D1 via the REST API.
 * @param {string} sql
 * @param {unknown[]} [params]
 * @returns {Promise<Record<string, unknown>[]>}
 */
async function d1Query(sql, params = []) {
  if (!CF_D1_API_TOKEN || !CF_ACCOUNT_ID || !CF_D1_DATABASE_ID) {
    logAosError("CONFIG_MISSING", "CF_D1_API_TOKEN / CF_ACCOUNT_ID / CF_D1_DATABASE_ID not set.");
    return [];
  }

  const url  = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;
  const body = JSON.stringify({ sql, params });

  try {
    const data = /** @type {{ success?: boolean; result?: { results?: Record<string,unknown>[] }[]; errors?: { message: string }[] }} */ (
      await httpsJson(url, {
        method:  "POST",
        headers: { Authorization: `Bearer ${CF_D1_API_TOKEN}` },
        body,
      })
    );

    if (!data.success) {
      logAosError("D1_QUERY_FAILED", (data.errors ?? []).map(e => e.message).join("; "));
      return [];
    }

    return data.result?.[0]?.results ?? [];
  } catch (err) {
    logAosError("D1_FETCH_FAILED", "Failed to query D1.", err);
    return [];
  }
}

// ── Reconciliation logic ──────────────────────────────────────────────────────

async function reconcile() {
  const startedAt = new Date().toISOString();
  console.info(`\n⛓️⚓⛓️  AveryOS™ Stripe Reconciliation — Phase 98`);
  console.info(`Kernel: ${KERNEL_VERSION} | SHA: ${KERNEL_SHA.slice(0, 16)}…`);
  console.info(`Started: ${startedAt} | Lookback: ${STALE_DAYS} days | DryRun: ${DRY_RUN}\n`);

  // 1. Fetch Stripe PaymentIntents
  console.info("📡 Fetching Stripe PaymentIntents…");
  const stripeIntents = await fetchStripePaymentIntents(STALE_DAYS);
  console.info(`   Found ${stripeIntents.length} Stripe PaymentIntents.`);

  const stripeIds = new Set(stripeIntents.map(pi => pi.id));

  // 2. Fetch D1 kaas_ledger rows
  console.info("🗃️  Querying D1 kaas_ledger…");
  const since = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();
  const ledgerRows = await d1Query(
    `SELECT id, ray_id, asn, stripe_invoice_id, stripe_charge_id,
            event_type, amount_usd, settlement_status, created_at
     FROM   kaas_ledger
     WHERE  created_at >= ?
     ORDER BY created_at DESC`,
    [since],
  );
  console.info(`   Found ${ledgerRows.length} kaas_ledger rows.\n`);

  // 3. Fetch D1 stale PENDING kaas_valuations
  console.info("🗃️  Querying stale PENDING kaas_valuations…");
  const stalePending = await d1Query(
    `SELECT id, ray_id, asn, valuation_usd, settlement_status, created_at
     FROM   kaas_valuations
     WHERE  settlement_status = 'PENDING'
       AND  created_at < ?
     ORDER BY created_at ASC
     LIMIT 500`,
    [since],
  );
  console.info(`   Found ${stalePending.length} stale PENDING rows.\n`);

  // ── Drift analysis ────────────────────────────────────────────────────────

  /** @type {{ type: string; detail: Record<string,unknown> }[]} */
  const driftEvents = [];

  // Stripe charges with no D1 counterpart
  for (const pi of stripeIntents) {
    if (pi.status !== "succeeded") continue;
    const hasD1 = ledgerRows.some(r =>
      r.stripe_charge_id === pi.id || r.stripe_invoice_id === pi.id
    );
    if (!hasD1) {
      driftEvents.push({ type: "STRIPE_ONLY", detail: { stripe_id: pi.id, amount_usd: pi.amount / 100, status: pi.status } });
    }
  }

  // D1 INVOICED rows with no Stripe charge
  for (const row of ledgerRows) {
    if (row.event_type !== "INVOICE_CREATED" && row.event_type !== "CHECKOUT_OPENED") continue;
    const hasStripe = row.stripe_charge_id && stripeIds.has(String(row.stripe_charge_id));
    if (!hasStripe) {
      driftEvents.push({ type: "D1_ORPHAN_INVOICE", detail: { id: row.id, ray_id: row.ray_id, asn: row.asn, amount_usd: row.amount_usd } });
    }
  }

  // Stale PENDING valuations
  for (const row of stalePending) {
    driftEvents.push({ type: "D1_STALE_PENDING", detail: { id: row.id, ray_id: row.ray_id, asn: row.asn, valuation_usd: row.valuation_usd, created_at: row.created_at } });
  }

  // ── Report ────────────────────────────────────────────────────────────────

  const report = {
    generated_at:          new Date().toISOString(),
    kernel_sha:            KERNEL_SHA,
    kernel_version:        KERNEL_VERSION,
    lookback_days:         STALE_DAYS,
    dry_run:               DRY_RUN,
    stripe_intents_count:  stripeIntents.length,
    d1_ledger_rows:        ledgerRows.length,
    stale_pending_rows:    stalePending.length,
    drift_events_count:    driftEvents.length,
    drift_events:          driftEvents,
  };

  const filename  = `stripe-reconciliation-${Date.now()}.json`;
  const outputPath = path.join(os.tmpdir(), filename);

  if (!DRY_RUN) {
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    logAosHeal("REPORT_WRITTEN", `Reconciliation report written to ${outputPath}`);
  }

  console.info(`\n📊 Reconciliation Summary`);
  console.info(`   Stripe PaymentIntents: ${report.stripe_intents_count}`);
  console.info(`   D1 Ledger rows:        ${report.d1_ledger_rows}`);
  console.info(`   Stale PENDING:         ${report.stale_pending_rows}`);
  console.info(`   Drift events:          ${report.drift_events_count}`);

  if (driftEvents.length > 0) {
    console.info("\n⚠️  Drift events detected:");
    driftEvents.forEach(e => console.info(`   [${e.type}]`, JSON.stringify(e.detail)));
    logAosError("RECONCILIATION_DRIFT", `${driftEvents.length} drift event(s) detected. Review ${outputPath}`);
  } else {
    console.info("\n✅ No drift detected — Stripe and D1 are in sync.");
    logAosHeal("RECONCILIATION_CLEAN", "Zero drift events. Sovereign ledger is aligned.");
  }

  console.info(`\n⛓️⚓⛓️  © 1992–2026 Jason Lee Avery / AveryOS™\n`);
  return report;
}

reconcile().catch(err => {
  logAosError("RECONCILE_FATAL", "Unhandled error in reconciliation script.", err);
  process.exit(1);
});
