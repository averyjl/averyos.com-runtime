#!/usr/bin/env node
/**
 * scripts/generate-stripe-packet.cjs
 *
 * Phase 97 / Gate 5 — Nightly Stripe Evidence Packet Generator
 *
 * Queries D1 for all unpackaged KAAS_BREACH and LEGAL_SCAN events from the
 * past 24 hours, generates a SHA-512-signed evidence packet per event, and
 * writes a nightly bundle to R2 under evidence/nightly/<date>/.
 *
 * When STRIPE_SECRET_KEY is set, the script creates a Stripe InvoiceItem for
 * each Tier-9/10 KAAS_BREACH event so invoices can be issued to the responsible
 * entity during the next billing cycle.
 *
 * Usage:
 *   node scripts/generate-stripe-packet.cjs [--dry-run] [--date YYYY-MM-DD]
 *
 * Required environment variables:
 *   AVERYOS_D1_ACCOUNT_ID   — Cloudflare account ID
 *   AVERYOS_D1_DATABASE_ID  — D1 database ID
 *   AVERYOS_D1_API_TOKEN    — Cloudflare API token (D1:Read)
 *
 * Optional environment variables:
 *   STRIPE_SECRET_KEY        — Stripe secret key for InvoiceItem creation
 *   STRIPE_CUSTOMER_ID       — Default Stripe customer ID (overridden per org if known)
 *   AVERYOS_R2_BUCKET        — R2 bucket name (defaults to "averyos-vault")
 *   AVERYOS_R2_API_TOKEN     — Cloudflare API token with R2:Write
 *   BTC_RPC_URL              — Optional Bitcoin RPC URL for live anchor
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const crypto = require('crypto');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const { logAosError, logAosHeal } = require('./sovereignErrorLogger.cjs');

// ── Sovereign Kernel Anchor ───────────────────────────────────────────────────
const KERNEL_SHA     = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';
const CREATOR_LOCK   = 'Jason Lee Avery (ROOT0) 🤛🏻';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DATE_ARG = (() => {
  const idx = args.indexOf('--date');
  return idx !== -1 ? args[idx + 1] : null;
})();

// ── Env ───────────────────────────────────────────────────────────────────────
const D1_ACCOUNT_ID  = process.env.AVERYOS_D1_ACCOUNT_ID;
const D1_DATABASE_ID = process.env.AVERYOS_D1_DATABASE_ID;
const D1_API_TOKEN   = process.env.AVERYOS_D1_API_TOKEN;
const STRIPE_KEY     = process.env.STRIPE_SECRET_KEY;
const STRIPE_CUST    = process.env.STRIPE_CUSTOMER_ID;
const R2_BUCKET      = process.env.AVERYOS_R2_BUCKET ?? 'averyos-vault';
const R2_API_TOKEN   = process.env.AVERYOS_R2_API_TOKEN ?? D1_API_TOKEN;

// ── Logging ───────────────────────────────────────────────────────────────────
function log(level, msg) {
  const prefix = level === 'INFO' ? '  ✓' : level === 'WARN' ? '  ⚠' : '  ✗';
  console.log(`${prefix} [${new Date().toISOString()}] [${level}] ${msg}`);
}

// ── SHA-512 helper ────────────────────────────────────────────────────────────
function sha512(input) {
  return crypto.createHash('sha512').update(input, 'utf8').digest('hex');
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path:     u.pathname + u.search,
        method:   options.method ?? 'GET',
        headers:  options.headers ?? {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── D1 query ──────────────────────────────────────────────────────────────────
async function queryD1(sql, params = []) {
  if (!D1_ACCOUNT_ID || !D1_DATABASE_ID || !D1_API_TOKEN) {
    throw new Error('D1 credentials missing: set AVERYOS_D1_ACCOUNT_ID, AVERYOS_D1_DATABASE_ID, AVERYOS_D1_API_TOKEN');
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  const res = await httpRequest(url, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${D1_API_TOKEN}`,
      'Content-Type':  'application/json',
    },
  }, { sql, params });
  if (!res.body?.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(res.body?.errors ?? res.body)}`);
  }
  return res.body.result?.[0]?.results ?? [];
}

// ── R2 upload ─────────────────────────────────────────────────────────────────
async function uploadToR2(key, content) {
  if (!D1_ACCOUNT_ID || !R2_API_TOKEN) {
    log('WARN', `R2 upload skipped (no credentials): ${key}`);
    return;
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${key}`;
  const res = await httpRequest(url, {
    method:  'PUT',
    headers: {
      'Authorization': `Bearer ${R2_API_TOKEN}`,
      'Content-Type':  'application/json',
    },
  }, content);
  if (res.status !== 200) {
    throw new Error(`R2 upload failed (status ${res.status}): ${key}`);
  }
}

// ── Stripe InvoiceItem creation ───────────────────────────────────────────────
async function createStripeInvoiceItem(row, feeCents, description) {
  if (!STRIPE_KEY) return null;
  const customerId = STRIPE_CUST;
  if (!customerId) {
    log('WARN', `No STRIPE_CUSTOMER_ID set — skipping Stripe InvoiceItem for ASN ${row.asn ?? 'unknown'}`);
    return null;
  }
  const params = new URLSearchParams({
    customer:    customerId,
    amount:      String(feeCents),
    currency:    'usd',
    description: description.slice(0, 500),
    'metadata[ray_id]':        row.ray_id  ?? row.id ?? '',
    'metadata[asn]':           row.asn     ?? '',
    'metadata[kernel_sha]':    KERNEL_SHA.slice(0, 16),
    'metadata[kernel_version]': KERNEL_VERSION,
    'metadata[event_type]':    row.event_type ?? 'KAAS_BREACH',
  });
  const res = await httpRequest('https://api.stripe.com/v1/invoiceitems', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_KEY}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
  }, params.toString());
  if (res.status !== 200) {
    log('WARN', `Stripe InvoiceItem creation failed (${res.status}): ${JSON.stringify(res.body)}`);
    return null;
  }
  return res.body?.id ?? null;
}

// ── KaaS fee schedule (mirrors lib/kaas/pricing.ts) ──────────────────────────
const ENTERPRISE_ASN_TIERS = {
  '8075': 10, '15169': 9, '36459': 8, '16509': 8, '14618': 8,
  '396982': 7, '19527': 7, '32934': 7, '63293': 7, '714': 7,
  '6185': 7, '15133': 7, '20940': 7, '211590': 7, '43037': 7,
};
function getAsnTier(asn) {
  return ENTERPRISE_ASN_TIERS[String(asn).replace(/^AS/i, '').trim()] ?? 1;
}
function getAsnFeeCents(asn) {
  const tier = getAsnTier(asn);
  if (tier >= 9) return 1_000_000_000; // $10,000,000
  if (tier >= 7) return 101_700_000;   // $1,017,000
  return 101_700;                       // $1,017
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const date       = DATE_ARG ?? new Date().toISOString().slice(0, 10);
  const windowStart = `${date}T00:00:00Z`;
  // Use the start of the next day as the exclusive upper bound to capture
  // all events on `date`, including those with microsecond-precision timestamps.
  const nextDay     = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
  const windowEnd   = `${nextDay}T00:00:00Z`;

  console.log(`\n⛓️⚓⛓️  AveryOS™ Nightly Stripe Evidence Packet Generator`);
  console.log(`   Date:        ${date}`);
  console.log(`   Kernel:      ${KERNEL_VERSION} | ${KERNEL_SHA.slice(0, 16)}…`);
  console.log(`   Creator:     ${CREATOR_LOCK}`);
  console.log(`   Dry-run:     ${DRY_RUN ? 'YES' : 'NO'}\n`);

  if (!D1_ACCOUNT_ID || !D1_DATABASE_ID || !D1_API_TOKEN) {
    logAosError('SCRIPT_EXECUTION_FAILURE', 'D1 credentials not set — set AVERYOS_D1_ACCOUNT_ID, AVERYOS_D1_DATABASE_ID, AVERYOS_D1_API_TOKEN');
    process.exit(1);
  }

  // ── 1. Query unpackaged KAAS_BREACH + LEGAL_SCAN events ───────────────────
  let rows = [];
  try {
    rows = await queryD1(
      `SELECT id, event_type, ip_address, target_path, threat_level, tari_liability_usd,
              pulse_hash, timestamp_ns, asn, city, client_country
       FROM sovereign_audit_logs
       WHERE event_type IN ('KAAS_BREACH', 'LEGAL_SCAN')
         AND timestamp_ns >= ?
         AND timestamp_ns <= ?
       ORDER BY tari_liability_usd DESC, threat_level DESC
       LIMIT 500`,
      [windowStart, windowEnd],
    );
    logAosHeal('generate-stripe-packet', `D1 query returned ${rows.length} events for ${date}`);
  } catch (err) {
    logAosError('D1_QUERY_ERROR', `Failed to query sovereign_audit_logs: ${err.message}`);
    process.exit(1);
  }

  if (rows.length === 0) {
    log('INFO', `No KAAS_BREACH / LEGAL_SCAN events found for ${date} — no packet needed.`);
    return;
  }

  // ── 2. Also pull kaas_valuations for Tier-9/10 enrichment ─────────────────
  let kaasRows = [];
  try {
    kaasRows = await queryD1(
      `SELECT ray_id, asn, org_name, tier, valuation_usd, fee_name, settlement_status, path, created_at
       FROM kaas_valuations
       WHERE tier >= 9
         AND created_at >= ?
         AND created_at <= ?
         AND settlement_status = 'PENDING'
       ORDER BY valuation_usd DESC
       LIMIT 200`,
      [windowStart, windowEnd],
    );
    log('INFO', `kaas_valuations: ${kaasRows.length} Tier-9/10 PENDING rows found`);
  } catch (err) {
    // kaas_valuations may not be populated yet — non-fatal
    log('WARN', `kaas_valuations query failed (non-fatal): ${err.message}`);
  }

  // ── 3. Build nightly packet ────────────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const packetId    = `NIGHTLY-${date}-${sha512(date + KERNEL_SHA).slice(0, 12).toUpperCase()}`;

  const totalLiability  = rows.reduce((s, r) => s + (Number(r.tari_liability_usd) || 0), 0);
  const kaasTotal       = kaasRows.reduce((s, r) => s + (Number(r.valuation_usd) || 0), 0);

  const packet = {
    packet_id:         packetId,
    date,
    generated_at:      generatedAt,
    kernel_sha:        KERNEL_SHA,
    kernel_version:    KERNEL_VERSION,
    creator_lock:      CREATOR_LOCK,
    sovereign_anchor:  '⛓️⚓⛓️',
    window_start:      windowStart,
    window_end:        windowEnd,
    event_count:       rows.length,
    total_tari_usd:    totalLiability,
    kaas_valuation_usd: kaasTotal,
    grand_total_usd:   totalLiability + kaasTotal,
    events: rows.map((r) => ({
      id:              r.id,
      event_type:      r.event_type,
      ip_address:      r.ip_address,
      target_path:     r.target_path,
      threat_level:    r.threat_level,
      tari_liability:  r.tari_liability_usd,
      pulse_hash:      r.pulse_hash?.slice(0, 32),
      timestamp:       r.timestamp_ns,
      asn:             r.asn,
      country:         r.client_country,
    })),
    kaas_valuations: kaasRows.map((r) => ({
      ray_id:    r.ray_id?.slice(0, 32),
      asn:       r.asn,
      org_name:  r.org_name,
      tier:      r.tier,
      valuation: r.valuation_usd,
      fee_name:  r.fee_name,
      status:    r.settlement_status,
    })),
  };

  // Double-lock SHA-512 signature
  const sigInput = `${KERNEL_SHA}:${packetId}:${generatedAt}:${totalLiability + kaasTotal}`;
  packet.packet_sha = sha512(sigInput);

  log('INFO', `Packet ${packetId}: ${rows.length} events | TARI™ $${totalLiability.toLocaleString()} | KaaS™ $${kaasTotal.toLocaleString()}`);

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Packet preview:\n', JSON.stringify(packet, null, 2));
    log('INFO', 'Dry-run complete — no R2 upload or Stripe calls made.');
    return;
  }

  // ── 4. Upload to R2 ───────────────────────────────────────────────────────
  const r2Key = `evidence/nightly/${date}/${packetId}.json`;
  try {
    await uploadToR2(r2Key, JSON.stringify(packet, null, 2));
    logAosHeal('generate-stripe-packet', `R2 upload OK: ${r2Key}`);
  } catch (err) {
    log('WARN', `R2 upload failed (non-fatal): ${err.message}`);
  }

  // ── 5. Stripe InvoiceItems for Tier-9/10 KAAS_BREACH events ──────────────
  if (STRIPE_KEY) {
    let stripeCount = 0;
    for (const row of rows) {
      if (row.event_type !== 'KAAS_BREACH') continue;
      const asn  = row.asn ?? '';
      const tier = getAsnTier(asn);
      if (tier < 9) continue;
      const feeCents = getAsnFeeCents(asn);
      const desc = `KaaS™ Tier-${tier} KAAS_BREACH — ASN ${asn} | IP ${row.ip_address} | Path ${(row.target_path ?? '').slice(0, 60)} | ${date} | ${KERNEL_VERSION}`;
      const itemId = await createStripeInvoiceItem(
        { ...row, ray_id: row.pulse_hash?.slice(0, 16) ?? String(row.id) },
        feeCents,
        desc,
      );
      if (itemId) {
        stripeCount++;
        log('INFO', `Stripe InvoiceItem created: ${itemId} for ASN ${asn} (${desc.slice(0, 60)}…)`);
      }
    }
    log('INFO', `Stripe: ${stripeCount} InvoiceItem(s) created for ${date}`);
  } else {
    log('WARN', 'STRIPE_SECRET_KEY not set — Stripe InvoiceItems skipped.');
  }

  // ── 6. Write local summary ────────────────────────────────────────────────
  const outDir = path.join(process.cwd(), 'evidence-packets');
  fs.mkdirSync(outDir, { recursive: true });
  const localFile = path.join(outDir, `${packetId}.json`);
  const fdPacket = fs.openSync(localFile, 'w');
  try { fs.writeSync(fdPacket, JSON.stringify(packet, null, 2)); } finally { fs.closeSync(fdPacket); }
  log('INFO', `Local summary: ${localFile}`);

  console.log(`\n✅ Packet ${packetId} complete.\n`);
}

main().catch((err) => {
  logAosError('SCRIPT_EXECUTION_FAILURE', `Fatal: ${err.message}`);
  process.exit(1);
});
