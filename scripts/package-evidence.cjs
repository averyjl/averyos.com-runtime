#!/usr/bin/env node
/**
 * scripts/package-evidence.cjs
 *
 * AveryOS™ Evidence Packaging Automation — Sovereign Forensic Bundle Builder
 *
 * Triggered by Cloudflare Cron (every 5 minutes) via the /api/v1/cron/package-evidence
 * endpoint, which calls this logic.  Also runnable standalone as a Node.js script.
 *
 * Workflow:
 *   1. Fetch unpackaged LEGAL_SCAN events from D1 sovereign_audit_logs
 *      (events with no corresponding R2 evidence bundle).
 *   2. For each event, build a forensic JSON bundle anchored to KERNEL_SHA.
 *   3. Store bundle in R2 under evidence/<sha512>.json.
 *   4. Record the bundle_id in D1 anchor_audit_logs for immutable traceability.
 *   5. Log each packaged event as a FORENSIC accomplishment via autoTrackAccomplishment.
 *
 * Usage:
 *   node scripts/package-evidence.cjs [--limit=50] [--dry-run]
 *
 * Environment variables (from .env.local or Cloudflare secrets):
 *   CLOUDFLARE_ACCOUNT_ID   — CF account ID
 *   CLOUDFLARE_API_TOKEN    — API token with D1:Read + R2:Write permissions
 *   D1_DATABASE_ID          — D1 database ID (averyos_kernel_db)
 *   VAULT_R2_BUCKET         — R2 bucket name for forensic evidence
 *   KERNEL_SHA              — Root0 SHA-512 anchor (imported from sovereignConstants)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');
const https  = require('https');
const crypto = require('crypto');

// ── Sovereign constants (mirror lib/sovereignConstants.ts) ────────────────────
const KERNEL_SHA     = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT   = (() => {
  const flag = args.find(a => a.startsWith('--limit='));
  return flag ? parseInt(flag.split('=')[1], 10) : 50;
})();

// ── Env config ────────────────────────────────────────────────────────────────
const CF_ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID  ?? '';
const CF_API_TOKEN   = process.env.CLOUDFLARE_API_TOKEN   ?? '';
const D1_DATABASE_ID = process.env.D1_DATABASE_ID         ?? '';
const VAULT_BUCKET   = process.env.VAULT_R2_BUCKET        ?? 'averyos-evidence';
const SITE_URL       = process.env.SITE_URL               ?? 'https://averyos.com';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Execute a D1 SQL query via the Cloudflare REST API.
 * @param {string} sql       — Parameterised SQL statement
 * @param {unknown[]} params — Bound parameters
 * @returns {Promise<unknown[]>} — Array of result rows
 */
async function d1Query(sql, params = []) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !D1_DATABASE_ID) {
    throw new Error('Missing Cloudflare credentials: set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID');
  }
  const body = JSON.stringify({ sql, params });
  const url  = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  const resp = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  const data = await resp.json();
  if (!data.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
  }
  return data.result?.[0]?.results ?? [];
}

/**
 * Store a forensic evidence bundle in R2 via the Cloudflare REST API.
 * @param {string} key     — R2 object key (e.g. "evidence/abc123.json")
 * @param {string} content — JSON string to store
 */
async function r2Put(key, content) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('Missing Cloudflare credentials for R2 upload');
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${VAULT_BUCKET}/objects/${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method:  'PUT',
    headers: {
      Authorization:  `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: content,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`R2 PUT failed (${resp.status}): ${text}`);
  }
}

/**
 * Compute a SHA-512 fingerprint of an evidence bundle payload.
 * @param {string} payload — stringified bundle JSON
 * @returns {string} hex SHA-512
 */
function sha512Sync(payload) {
  return crypto.createHash('sha512').update(payload).digest('hex');
}

/**
 * Build a canonical forensic evidence bundle for a LEGAL_SCAN event.
 * @param {object} row — sovereign_audit_logs row
 * @returns {{ bundleId: string, sha512: string, content: string }}
 */
function buildBundle(row) {
  const now      = new Date().toISOString();
  const bundleId = `EVIDENCE_BUNDLE_${row.id}_${Date.now()}`;
  const bundle   = {
    CapsuleID:       bundleId,
    CapsuleType:     'LEGAL_SCAN_EVIDENCE',
    EventType:       row.event_type ?? 'LEGAL_SCAN',
    EventId:         row.id,
    TargetIP:        row.ip_address ?? 'UNKNOWN',
    UserAgent:       row.user_agent ?? 'UNKNOWN',
    GeoLocation:     row.geo_location ?? 'UNKNOWN',
    TargetPath:      row.target_path ?? '/',
    ThreatLevel:     row.threat_level ?? 10,
    TimestampNs:     row.timestamp_ns,
    PackagedAt:      now,
    KernelAnchor:    KERNEL_SHA,
    KernelVersion:   KERNEL_VERSION,
    SovereignAnchor: '⛓️⚓⛓️',
    CreatorLock:     '🤛🏻 Jason Lee Avery (ROOT0)',
    LicenseUrl:      `${SITE_URL}/licensing`,
  };
  const content = JSON.stringify(bundle, null, 2);
  const sha512  = sha512Sync(content);
  return { bundleId, sha512, content };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n⛓️⚓⛓️  AveryOS™ Evidence Packaging Automation — Phase 82`);
  console.log(`   Kernel: ${KERNEL_SHA.slice(0, 16)}…`);
  console.log(`   Limit:  ${LIMIT} events${DRY_RUN ? '  [DRY-RUN]' : ''}\n`);

  // 1. Fetch unpackaged LEGAL_SCAN events
  let rows;
  try {
    rows = await d1Query(
      `SELECT id, event_type, ip_address, user_agent, geo_location,
              target_path, timestamp_ns, threat_level
       FROM sovereign_audit_logs
       WHERE event_type = 'LEGAL_SCAN'
         AND id NOT IN (
           SELECT DISTINCT CAST(
             CASE WHEN SUBSTR(event_type, 1, 11) = 'LEGAL_SCAN_'
                  THEN SUBSTR(event_type, 12)
                  ELSE '0'
             END AS INTEGER
           )
           FROM anchor_audit_logs
           WHERE event_type LIKE 'LEGAL_SCAN_%'
             AND SUBSTR(event_type, 12) GLOB '[0-9]*'
         )
       ORDER BY id DESC
       LIMIT ?`,
      [LIMIT]
    );
  } catch (err) {
    logAosError(AOS_ERROR.DB_QUERY_FAILED, `Failed to fetch LEGAL_SCAN events: ${err.message}`, err);
    process.exit(1);
  }

  console.log(`   Found ${rows.length} unpackaged LEGAL_SCAN event(s).\n`);

  let packaged = 0;
  let failed   = 0;

  for (const row of rows) {
    try {
      const { bundleId, sha512, content } = buildBundle(row);
      const r2Key = `evidence/${sha512}.json`;

      console.log(`   → Packaging event #${row.id} (IP: ${row.ip_address ?? 'UNKNOWN'})`);
      console.log(`     Bundle: ${bundleId}`);
      console.log(`     SHA-512: ${sha512.slice(0, 32)}…`);
      console.log(`     R2 Key: ${r2Key}`);

      if (!DRY_RUN) {
        // Store in R2
        await r2Put(r2Key, content);

        // Anchor in D1 anchor_audit_logs
        await d1Query(
          `INSERT INTO anchor_audit_logs
             (anchored_at, sha512, event_type, kernel_sha, timestamp, ray_id, ip_address, path, asn)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            new Date().toISOString(),
            sha512,
            `LEGAL_SCAN_${row.id}`,
            KERNEL_SHA.slice(0, 32) + '…',
            new Date().toISOString(),
            bundleId,
            row.ip_address ?? 'UNKNOWN',
            row.target_path ?? '/',
            row.geo_location ?? 'UNKNOWN',
          ]
        );

        logAosHeal(AOS_ERROR.NOT_FOUND, `Evidence bundle packaged and stored in R2: ${r2Key}`);
      }

      packaged++;
      console.log(`     ✅ Packaged${DRY_RUN ? ' (dry-run)' : ''}\n`);
    } catch (err) {
      failed++;
      logAosError(AOS_ERROR.EXTERNAL_API_ERROR, `Failed to package event #${row.id}: ${err.message}`, err);
    }
  }

  console.log(`\n   Summary: ${packaged} packaged, ${failed} failed.\n`);
  console.log('   ⛓️⚓⛓️  Evidence packaging complete.\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, `Unhandled error in package-evidence.cjs: ${err.message}`, err);
  process.exit(1);
});

module.exports = { buildBundle, sha512Sync };
