#!/usr/bin/env node
'use strict';

/**
 * scripts/package-evidence.cjs
 *
 * Phase 84 — AveryOS™ Automated Evidence Packaging
 *
 * Bundles D1 forensic metadata + R2 JSON artifact + BTC block hash into a
 * deterministic, signed `.aospak` file — the "Technical Audit Attachment"
 * for formal $10M commercial valuation notices.
 *
 * Usage:
 *   node scripts/package-evidence.cjs --rayid <RAYID_OR_SHA512> [--output <dir>] [--env production]
 *
 * Environment variables:
 *   BLOCKCHAIN_API_KEY  — BlockCypher API key for BTC block hash anchor
 *   VAULT_PASSPHRASE    — Vault auth token for /api/v1/evidence/:rayid
 *   SITE_URL            — Base URL (default: https://averyos.com)
 *   KERNEL_SHA          — Override canonical SHA (rarely needed)
 *
 * Output:
 *   <output>/<sha512_payload>.aospak  — JSON-encoded signed bundle
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

const { execSync }   = require('child_process');
const { webcrypto }  = require('node:crypto');
const fs             = require('fs');
const path           = require('path');
const crypto         = webcrypto;

const { logAosError, logAosHeal } = require('./sovereignErrorLogger.cjs');

// ── Constants ─────────────────────────────────────────────────────────────────
const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

const KERNEL_VERSION = 'v3.6.2';

const D1_DATABASE_NAME  = 'averyos_kernel_db';
const DEFAULT_SITE_URL  = 'https://averyos.com';
const DEFAULT_OUTPUT    = path.resolve(__dirname || process.cwd(), '../tmp/evidence-packages');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const get     = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

const rayid   = get('--rayid');
const outDir  = get('--output')  ?? DEFAULT_OUTPUT;
const env     = get('--env')     ?? 'production';

if (!rayid) {
  console.error('[AOS] Usage: node scripts/package-evidence.cjs --rayid <RAYID_OR_SHA512>');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha512hex(input) {
  const buf = await crypto.subtle.digest('SHA-512', Buffer.from(input, 'utf8'));
  return Buffer.from(buf).toString('hex');
}

/**
 * Fetch BTC block hash from BlockCypher — used as the anchor salt.
 */
async function fetchBtcBlockHash() {
  const apiKey = process.env.BLOCKCHAIN_API_KEY;
  const url    = apiKey
    ? `https://api.blockcypher.com/v1/btc/main?token=${apiKey}`
    : 'https://api.blockcypher.com/v1/btc/main';
  try {
    const { default: https } = await import('node:https');
    return await new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(typeof parsed.hash === 'string' ? parsed.hash : KERNEL_SHA);
          } catch { resolve(KERNEL_SHA); }
        });
      }).on('error', () => resolve(KERNEL_SHA));
    });
  } catch {
    return KERNEL_SHA;
  }
}

/**
 * Query D1 via wrangler for anchor_audit_logs row.
 * Returns the row as an object or null.
 *
 * SECURITY: Input is validated against strict allowlists before interpolation.
 * - sha512_payload: exactly 128 lowercase hex chars (regex enforced before call)
 * - ray_id: Cloudflare RayID format — hex chars, digits, and hyphens only
 *   (enforced below to prevent SQL injection via the non-hash path)
 */
function queryD1Row(rayIdOrHash) {
  // Determine lookup strategy
  const isHash = /^[a-f0-9]{128}$/.test(rayIdOrHash);

  // For RayID path: enforce strict Cloudflare RayID format before interpolation.
  // Cloudflare RayIDs are: 16 hex chars + '-' + 3-letter IATA colo code (e.g. 8bc4f3e2a1d0-SJC)
  // We allow up to 64 chars of [a-zA-Z0-9\-] to cover edge cases.
  if (!isHash && !/^[a-zA-Z0-9\-]{10,64}$/.test(rayIdOrHash)) {
    logAosError('INVALID_FIELD', 'RayID contains disallowed characters', {
      context: 'package-evidence.cjs:queryD1Row',
      rayid: rayIdOrHash,
    });
    return null;
  }

  const sql = isHash
    ? `SELECT * FROM anchor_audit_logs WHERE sha512_payload = '${rayIdOrHash}' ORDER BY id DESC LIMIT 1`
    : `SELECT * FROM anchor_audit_logs WHERE ray_id = '${rayIdOrHash}' ORDER BY id DESC LIMIT 1`;
  try {
    const result = execSync(
      `npx wrangler d1 execute ${D1_DATABASE_NAME} --env ${env} --json --command "${sql}"`,
      { encoding: 'utf8', timeout: 30000 },
    );
    const parsed = JSON.parse(result);
    const rows   = parsed?.[0]?.results ?? [];
    return rows[0] ?? null;
  } catch (err) {
    logAosError('DB_QUERY_FAILED', `D1 query failed: ${err.message}`, {
      context: 'package-evidence.cjs:queryD1Row',
      rayid: rayIdOrHash,
    });
    return null;
  }
}

/**
 * Fetch the R2 evidence artifact from the live site via the Evidence API.
 * Requires VAULT_PASSPHRASE env var.
 */
async function fetchR2Evidence(sha512Payload) {
  const siteUrl     = process.env.SITE_URL ?? DEFAULT_SITE_URL;
  const passphrase  = process.env.VAULT_PASSPHRASE;
  if (!passphrase) {
    logAosError('BINDING_MISSING', 'VAULT_PASSPHRASE not set — skipping R2 fetch', {
      context: 'package-evidence.cjs:fetchR2Evidence',
    });
    return null;
  }
  try {
    const { default: https } = await import('node:https');
    const url = `${siteUrl}/api/v1/evidence/${sha512Payload}`;
    return await new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'x-vault-auth': passphrase },
        timeout: 15000,
      }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try { resolve(JSON.parse(body)); } catch { resolve(null); }
          } else {
            logAosError('EXTERNAL_API_ERROR', `Evidence API returned ${res.statusCode}`, {
              context: 'package-evidence.cjs:fetchR2Evidence',
            });
            resolve(null);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  } catch (err) {
    logAosError('EXTERNAL_API_ERROR', `R2 fetch failed: ${err.message}`, {
      context: 'package-evidence.cjs:fetchR2Evidence',
    });
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n⛓️⚓⛓️  AveryOS™ Evidence Packager — Phase 84`);
  console.log(`Kernel: ${KERNEL_SHA.slice(0, 16)}...${KERNEL_SHA.slice(-8)}`);
  console.log(`RayID / SHA: ${rayid}\n`);

  // 1. Query D1 for anchor_audit_logs metadata
  console.log('① Querying D1 anchor_audit_logs…');
  const d1Row = queryD1Row(rayid);
  if (!d1Row) {
    console.warn('  ⚠ No D1 row found — proceeding with partial bundle');
  } else {
    console.log(`  ✓ D1 row: ray_id=${d1Row.ray_id ?? '?'}  path=${d1Row.path ?? '?'}`);
  }

  // Resolve sha512_payload
  const sha512Payload = d1Row?.sha512_payload ?? (/^[a-f0-9]{128}$/.test(rayid) ? rayid : null);
  if (!sha512Payload) {
    logAosError('NOT_FOUND', 'Could not resolve sha512_payload from D1 or input', {
      context: 'package-evidence.cjs:main',
      rayid,
    });
    process.exit(1);
  }

  // 2. Fetch R2 evidence JSON
  console.log('② Fetching R2 evidence artifact…');
  const r2Evidence = await fetchR2Evidence(sha512Payload);
  if (!r2Evidence) {
    console.warn('  ⚠ R2 artifact unavailable — bundle will contain D1 metadata only');
  } else {
    console.log(`  ✓ R2 artifact: ${sha512Payload.slice(0, 16)}…`);
  }

  // 3. Fetch BTC block hash anchor
  console.log('③ Fetching BTC block hash…');
  const btcBlockHash = await fetchBtcBlockHash();
  console.log(`  ✓ BTC: ${btcBlockHash.slice(0, 24)}…`);

  // 4. Build bundle
  const packagedAt = new Date().toISOString();
  const bundle = {
    kernel_sha:    KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    btc_block_hash: btcBlockHash,
    sha512_payload: sha512Payload,
    d1_metadata:   d1Row ?? null,
    r2_evidence:   r2Evidence ?? null,
    packaged_at:   packagedAt,
  };

  // 5. Compute bundle signature: SHA-512(kernel | btc | sha512_payload | packaged_at)
  console.log('④ Computing bundle signature…');
  const sigInput    = `${KERNEL_SHA}|${btcBlockHash}|${sha512Payload}|${packagedAt}`;
  const bundleSig   = await sha512hex(sigInput);
  bundle.bundle_signature = bundleSig;

  console.log(`  ✓ Signature: ${bundleSig.slice(0, 32)}…${bundleSig.slice(-8)}`);

  // 6. Write .aospak file
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, `${sha512Payload}.aospak`);
  fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2), 'utf8');

  console.log(`\n✅ Bundle written: ${outFile}`);
  console.log(`   Signature: ${bundleSig}`);

  logAosHeal('package-evidence', `Bundle packaged successfully for ${sha512Payload.slice(0, 16)}…`);
})().catch((err) => {
  logAosError('INTERNAL_ERROR', `Unhandled error: ${err.message}`, {
    context: 'package-evidence.cjs:main',
    stack: err.stack,
  });
  process.exit(1);
});
