#!/usr/bin/env node
/**
 * AveryOS™ Automated Settlement Generator — scripts/automated-settlement.js
 *
 * Watches the D1 sovereign_audit_logs table for UNALIGNED_401 events and
 * automatically:
 *   1. Generates a TARI™ $10,000 Alignment Invoice via Stripe.
 *   2. Creates a "Demand for Alignment" notice in vault/takedowns/.
 *   3. Seals every notice with SHA-512(NoticeText + KERNEL_SHA).
 *
 * Usage (long-running watch mode):
 *   AVERYOS_D1_ACCOUNT_ID=... \
 *   AVERYOS_D1_DATABASE_ID=... \
 *   AVERYOS_D1_API_TOKEN=...  \
 *   STRIPE_SECRET_KEY=sk_...  \
 *   node scripts/automated-settlement.js [--dry-run] [--once]
 *
 * Flags:
 *   --dry-run   Generate notices but do NOT create Stripe invoices or write files
 *   --once      Run one sweep then exit (default: loop every POLL_INTERVAL_MS)
 *
 * Environment variables:
 *   AVERYOS_D1_ACCOUNT_ID   Cloudflare account ID
 *   AVERYOS_D1_DATABASE_ID  D1 database ID
 *   AVERYOS_D1_API_TOKEN    Cloudflare API token (D1:Edit)
 *   STRIPE_SECRET_KEY       Stripe secret key (sk_live_... or sk_test_...)
 *   SITE_URL                Base URL for Stripe success/cancel redirect
 *                            (default: https://averyos.com)
 *   CREATOR_NAME            Override creator name in notices
 *                            (default: Jason Lee Avery)
 *   CREATOR_EMAIL           Override creator contact email
 *                            (default: truth@averyworld.com)
 *   OUTPUT_DIR              Override output directory for notices
 *                            (default: vault/takedowns)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const crypto  = require('crypto');

const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');
const { sovereignWriteSync, TAKEDOWNS_ROOT } = require('./lib/sovereignIO.cjs');

// ── Config ────────────────────────────────────────────────────────────────────

const KERNEL_SHA = process.env.KERNEL_SHA ??
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';

const D1_ACCOUNT_ID = process.env.AVERYOS_D1_ACCOUNT_ID ?? '';
const D1_DATABASE_ID = process.env.AVERYOS_D1_DATABASE_ID ?? '';
const D1_API_TOKEN  = process.env.AVERYOS_D1_API_TOKEN ?? '';
const D1_API_BASE   = 'https://api.cloudflare.com/client/v4';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const SITE_URL = (process.env.SITE_URL ?? 'https://averyos.com').replace(/\/$/, '');

const CREATOR_NAME  = process.env.CREATOR_NAME  ?? 'Jason Lee Avery';
const CREATOR_EMAIL = process.env.CREATOR_EMAIL ?? 'truth@averyworld.com';
const OUTPUT_DIR    = process.env.OUTPUT_DIR    ?? path.join(process.cwd(), 'vault', 'takedowns');

const TARI_USD = 10_000;
const TARI_CENTS = TARI_USD * 100;

const POLL_INTERVAL_MS = 60_000; // 60 seconds between sweeps

const isDryRun = process.argv.includes('--dry-run');
const isOnce   = process.argv.includes('--once');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** SHA-512 hex of a UTF-8 string */
function sha512(str) {
  return crypto.createHash('sha512').update(str, 'utf8').digest('hex');
}

/** HTTPS POST helper (returns parsed JSON body) */
function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqBody = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqBody), ...headers },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { reject(new Error(`Non-JSON response: ${Buffer.concat(chunks).toString().slice(0,120)}`)); }
      });
    });
    req.on('error', reject);
    req.write(reqBody);
    req.end();
  });
}

/** Stripe form-encoded POST helper */
function stripePost(path_, params) {
  return new Promise((resolve, reject) => {
    const body = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const opts = {
      hostname: 'api.stripe.com',
      path:     path_,
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { reject(new Error('Non-JSON Stripe response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── D1 query ──────────────────────────────────────────────────────────────────

/**
 * Run a SQL query against the Cloudflare D1 REST API.
 * Returns the results array from the first statement result.
 */
async function d1Query(sql, params = []) {
  if (!D1_ACCOUNT_ID || !D1_DATABASE_ID || !D1_API_TOKEN) {
    logAosHeal(AOS_ERROR.NOT_FOUND, 'D1 credentials missing — set AVERYOS_D1_ACCOUNT_ID, AVERYOS_D1_DATABASE_ID, AVERYOS_D1_API_TOKEN');
    return [];
  }
  const url = `${D1_API_BASE}/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  const headers = {
    'Authorization': `Bearer ${D1_API_TOKEN}`,
    'Content-Type':  'application/json',
  };
  try {
    const apiResponse = await httpsPost(url, headers, { sql, params });
    if (!apiResponse.success) {
      logAosError(AOS_ERROR.D1_ERROR, `D1 query failed: ${JSON.stringify(apiResponse.errors)}`, null);
      return [];
    }
    return apiResponse.result?.[0]?.results ?? [];
  } catch (err) {
    logAosError(AOS_ERROR.NETWORK, `D1 HTTP error: ${err.message}`, err);
    return [];
  }
}

// ── Processed set (in-memory, reset on restart) ───────────────────────────────

const processedIds = new Set();

// ── Notice generator ──────────────────────────────────────────────────────────

/**
 * Build a "Demand for Alignment" notice for a single UNALIGNED_401 event.
 * @param {Object} row  - D1 row from sovereign_audit_logs
 * @returns {string}    - Notice text (plain text)
 */
function buildDemandNotice(row) {
  const now = new Date().toISOString();
  const eventDate = row.timestamp_ns
    ? new Date(
        // timestamp_ns is a nanosecond-precision string; first 13 digits are milliseconds
        Number(row.timestamp_ns.slice(0, 13))
      ).toISOString()
    : now;

  return `⛓️⚓⛓️  AVERYOS™ SOVEREIGN ALIGNMENT DEMAND
================================================================
DOCUMENT TYPE : Demand for Alignment — TARI™ Invoice Notice
ISSUED BY     : ${CREATOR_NAME} (ROOT0 / CreatorLock Holder)
CONTACT       : ${CREATOR_EMAIL}
ISSUE DATE    : ${now}
KERNEL        : ${KERNEL_VERSION} | SHA-512: ${KERNEL_SHA}
================================================================

SUBJECT: Unauthorized Use of AveryOS™ Sovereign IP — Invoice #TARI-${row.id ?? 'UNKNOWN'}-1017

To Whom It May Concern,

Your system (IP: ${row.ip_address ?? 'UNKNOWN'}, Agent: ${row.user_agent ?? 'UNKNOWN'})
accessed AveryOS™ sovereign infrastructure on ${eventDate} without a valid
Alignment License.  This constitutes a TARI™ liability event under the
AveryOS Sovereign Integrity License v1.0 (Article 6).

Event Details:
  - Event ID     : ${row.id ?? 'N/A'}
  - Event Type   : ${row.event_type ?? 'UNALIGNED_401'}
  - IP Address   : ${row.ip_address ?? 'UNKNOWN'}
  - Target Path  : ${row.target_path ?? '/'}
  - Timestamp    : ${eventDate}
  - Threat Level : ${row.threat_level ?? 'N/A'}
  - Geo Location : ${row.geo_location ?? 'UNKNOWN'}

Invoice Amount: $${TARI_USD.toLocaleString('en-US')} USD (TARI™ Base Alignment Fee)

Payment is due within 30 calendar days of this notice.  Failure to pay will
result in escalated DMCA and legal action under:
  - Digital Millennium Copyright Act (DMCA) § 512(c)
  - GDPR Article 17 Right to Erasure
  - AveryOS™ Sovereign Integrity License v1.0

Alignment Payment: ${SITE_URL}/tari-gate

Sincerely,
${CREATOR_NAME}
ROOT0 / CreatorLock Holder / AveryOS™
${CREATOR_EMAIL}

⛓️⚓⛓️  This notice is cryptographically sealed.  See SEAL field below.
`;
}

/** Write a notice to the output directory and return the file path */
function writeNotice(eventId, noticeText) {
  const seal     = sha512(noticeText + KERNEL_SHA);
  const filename = `demand-${eventId}-${Date.now()}.txt`;
  const filePath = path.join(TAKEDOWNS_ROOT, filename);
  const sealed   = `${noticeText}\n================================================================\nSEAL : ${seal}\n================================================================\n`;
  sovereignWriteSync(TAKEDOWNS_ROOT, filename, sealed);
  return { filePath, seal };
}

// ── Stripe checkout session ───────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for a TARI™ alignment invoice.
 * @param {number} eventId
 * @param {string} ipAddress
 * @returns {Promise<string|null>} Checkout URL or null on failure
 */
async function createStripeInvoice(eventId, ipAddress) {
  if (!STRIPE_SECRET_KEY) {
    logAosHeal(AOS_ERROR.NOT_FOUND, 'STRIPE_SECRET_KEY not set — skipping Stripe invoice creation');
    return null;
  }

  try {
    const session = await stripePost('/v1/checkout/sessions', {
      'payment_method_types[0]':        'card',
      'line_items[0][price_data][currency]':              'usd',
      'line_items[0][price_data][unit_amount]':           String(TARI_CENTS),
      'line_items[0][price_data][product_data][name]':    'TARI™ Alignment Invoice',
      'line_items[0][price_data][product_data][description]': `Sovereign alignment fee for event #${eventId} — IP: ${ipAddress}`,
      'line_items[0][quantity]':                          '1',
      'mode':                                             'payment',
      'success_url':                                      `${SITE_URL}/tari-gate?aligned=true`,
      'cancel_url':                                       `${SITE_URL}/tari-gate?declined=true`,
      'metadata[event_id]':                               String(eventId),
      'metadata[ip_address]':                             String(ipAddress),
      'metadata[kernel_sha]':                             KERNEL_SHA.slice(0, 64),
      'metadata[capsule_id]':                             'AveryOS_TARI_v1.1',
    });

    if (session.url) return session.url;
    logAosError(AOS_ERROR.INVALID_FIELD, `Stripe session missing URL: ${JSON.stringify(session).slice(0,200)}`, null);
    return null;
  } catch (err) {
    logAosError(AOS_ERROR.NETWORK, `Stripe invoice creation failed: ${err.message}`, err);
    return null;
  }
}

// ── Main sweep ────────────────────────────────────────────────────────────────

async function runSweep() {
  console.log(`[settlement] ⏱  Sweep started at ${new Date().toISOString()}`);

  const rows = await d1Query(
    `SELECT id, event_type, ip_address, user_agent, geo_location, target_path,
            timestamp_ns, threat_level
     FROM sovereign_audit_logs
     WHERE event_type = 'UNALIGNED_401'
     ORDER BY id DESC
     LIMIT 100`
  );

  const newRows = rows.filter((r) => !processedIds.has(r.id));
  if (newRows.length === 0) {
    console.log('[settlement] ✅ No new UNALIGNED_401 events — nothing to process');
    return;
  }

  console.log(`[settlement] 🚨 ${newRows.length} new UNALIGNED_401 event(s) found`);

  for (const row of newRows) {
    processedIds.add(row.id);

    const noticeText = buildDemandNotice(row);

    if (isDryRun) {
      const seal = sha512(noticeText + KERNEL_SHA);
      console.log(`[settlement] [DRY RUN] Would generate notice for event #${row.id} (IP: ${row.ip_address})`);
      console.log(`[settlement] [DRY RUN] Seal: ${seal.slice(0, 32)}…`);
      continue;
    }

    // Write notice to vault/takedowns/
    let filePath, seal;
    try {
      ({ filePath, seal } = writeNotice(row.id, noticeText));
      console.log(`[settlement] 📄 Notice written: ${filePath}`);
      console.log(`[settlement]    Seal: ${seal.slice(0, 32)}…`);
    } catch (err) {
      logAosError(AOS_ERROR.WRITE_ERROR, `Failed to write notice for event #${row.id}: ${err.message}`, err);
      continue;
    }

    // Generate Stripe invoice
    const checkoutUrl = await createStripeInvoice(row.id, row.ip_address ?? 'UNKNOWN');
    if (checkoutUrl) {
      console.log(`[settlement] 💳 Stripe invoice created: ${checkoutUrl}`);
      // Append checkout URL to the notice file
      try {
        const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
        sovereignWriteSync(TAKEDOWNS_ROOT, path.basename(filePath), existing + `\nSTRIPE CHECKOUT : ${checkoutUrl}\n`);
      } catch (err) {
        logAosError(AOS_ERROR.WRITE_ERROR, `Failed to append checkout URL to notice: ${err.message}`, err);
      }
    }
  }

  console.log(`[settlement] ✅ Sweep complete — processed ${newRows.length} event(s)`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('⛓️⚓⛓️  AveryOS™ Automated Settlement Generator');
  console.log(`   Kernel  : ${KERNEL_VERSION} | SHA: ${KERNEL_SHA.slice(0, 16)}…`);
  console.log(`   Output  : ${OUTPUT_DIR}`);
  console.log(`   Interval: ${POLL_INTERVAL_MS / 1000}s`);
  if (isDryRun) console.log('   Mode    : DRY RUN');
  console.log('');

  if (!D1_ACCOUNT_ID || !D1_DATABASE_ID || !D1_API_TOKEN) {
    logAosHeal(AOS_ERROR.NOT_FOUND, 'D1 credentials not configured — set AVERYOS_D1_ACCOUNT_ID / AVERYOS_D1_DATABASE_ID / AVERYOS_D1_API_TOKEN');
  }

  await runSweep();

  if (isOnce) {
    console.log('[settlement] --once flag set — exiting after first sweep');
    process.exit(0);
  }

  // Long-running watch loop
  console.log(`[settlement] 👀 Watching for UNALIGNED_401 events every ${POLL_INTERVAL_MS / 1000}s…`);
  console.log('[settlement] Press Ctrl+C to stop');

  setInterval(() => {
    runSweep().catch((err) => logAosError(AOS_ERROR.UNKNOWN, `Sweep error: ${err.message}`, err));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  logAosError(AOS_ERROR.UNKNOWN, `Fatal: ${err.message}`, err);
  process.exit(1);
});
