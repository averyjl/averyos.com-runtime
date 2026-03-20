#!/usr/bin/env node
/**
 * scripts/package-evidence.cjs
 *
 * Phase 84 — Automated Evidence Packaging
 *
 * Bundles Cloudflare D1 audit metadata + R2 JSON telemetry + BTC Block Hash
 * into a signed forensic proof bundle (.aospak) for a given RayID.
 *
 * Usage:
 *   node scripts/package-evidence.cjs --rayid <RAYID> [--out <output-dir>] [--dry-run]
 *
 * Required environment variables:
 *   AVERYOS_D1_ACCOUNT_ID   — Cloudflare account ID
 *   AVERYOS_D1_DATABASE_ID  — D1 database ID
 *   AVERYOS_D1_API_TOKEN    — Cloudflare API token (D1:Read + R2:Read)
 *   AVERYOS_R2_BUCKET       — R2 bucket name (defaults to "averyos-vault")
 *   AVERYOS_R2_API_TOKEN    — Cloudflare API token with R2:Read (defaults to D1 token)
 *   BTC_RPC_URL             — Optional: Bitcoin node JSON-RPC URL for live BTC anchor
 *                             Falls back to mempool.space public API.
 *
 * Output: <out>/<rayid>.aospak  (JSON file with kernel_sha signature)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const https  = require('https');
const path   = require('path');

// ── Sovereign Kernel Anchor ───────────────────────────────────────────────────
const KERNEL_SHA     = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';
const CREATOR_LOCK   = 'Jason Lee Avery (ROOT0) 🤛🏻';

// ── CLI Args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
}
const rayId  = getArg('--rayid');
const outDir = getArg('--out') ?? './evidence-packages';
const dryRun = args.includes('--dry-run');

if (!rayId || !/^[a-zA-Z0-9]{8,64}$/.test(rayId)) {
  console.error('[AOS] ERROR: --rayid <rayid> is required (8–64 alphanumeric characters)');
  process.exit(1);
}

// ── Env ───────────────────────────────────────────────────────────────────────
const D1_ACCOUNT_ID  = process.env.AVERYOS_D1_ACCOUNT_ID;
const D1_DATABASE_ID = process.env.AVERYOS_D1_DATABASE_ID;
const D1_API_TOKEN   = process.env.AVERYOS_D1_API_TOKEN;
const R2_BUCKET      = process.env.AVERYOS_R2_BUCKET ?? 'averyos-vault';
const R2_API_TOKEN   = process.env.AVERYOS_R2_API_TOKEN ?? D1_API_TOKEN;
const BTC_RPC_URL    = process.env.BTC_RPC_URL;

// ── Logging ───────────────────────────────────────────────────────────────────
function log(level, msg) {
  const prefix = level === 'INFO' ? '  ✓' : level === 'WARN' ? '  ⚠' : '  ✗';
  console.log(`${prefix} [${new Date().toISOString()}] [${level}] ${msg}`);
}

// ── SHA-512 helper ────────────────────────────────────────────────────────────
function sha512(input) {
  return crypto.createHash('sha512').update(input, 'utf8').digest('hex');
}

// ── HTTP GET helper ───────────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'GET',
      headers,
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── HTTP POST helper ──────────────────────────────────────────────────────────
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u       = new URL(url);
    const payload = JSON.stringify(body);
    const opts = {
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── D1 Query ──────────────────────────────────────────────────────────────────
async function queryD1(sql, params = []) {
  if (!D1_ACCOUNT_ID || !D1_DATABASE_ID || !D1_API_TOKEN) {
    log('WARN', 'D1 credentials not configured — skipping D1 query.');
    return null;
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  const res = await httpPost(url, { sql, params }, { Authorization: `Bearer ${D1_API_TOKEN}` });
  if (!res.data?.success) {
    log('WARN', `D1 query failed: ${JSON.stringify(res.data?.errors ?? res.data)}`);
    return null;
  }
  return res.data.result?.[0]?.results ?? null;
}

// ── R2 Object Fetch ───────────────────────────────────────────────────────────
async function fetchR2Object(key) {
  if (!D1_ACCOUNT_ID || !R2_API_TOKEN) {
    log('WARN', 'R2 credentials not configured — skipping R2 fetch.');
    return null;
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${key}`;
  const res = await httpGet(url, { Authorization: `Bearer ${R2_API_TOKEN}` });
  if (res.status !== 200) {
    log('WARN', `R2 object not found: ${key} (status ${res.status})`);
    return null;
  }
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
}

// ── BTC Block Hash ────────────────────────────────────────────────────────────
async function fetchBtcAnchor() {
  try {
    if (BTC_RPC_URL) {
      const res = await httpPost(BTC_RPC_URL, {
        jsonrpc: '1.0', id: 'aos', method: 'getbestblockhash', params: [],
      });
      if (res.data?.result) {
        log('INFO', `BTC anchor (local node): ${res.data.result.substring(0, 16)}…`);
        return { hash: res.data.result, source: 'local_node' };
      }
    }
  } catch {
    log('WARN', 'Local BTC node unavailable — falling back to mempool.space');
  }

  try {
    const tipRes = await httpGet('https://mempool.space/api/blocks/tip/hash');
    const hash = typeof tipRes.data === 'string' ? tipRes.data.trim() : null;
    if (hash && /^[a-f0-9]{64}$/.test(hash)) {
      log('INFO', `BTC anchor (mempool.space): ${hash.substring(0, 16)}…`);
      return { hash, source: 'mempool.space' };
    }
  } catch {
    log('WARN', 'mempool.space BTC anchor unavailable');
  }

  return { hash: null, source: 'unavailable' };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async function main() {
  console.log('\n⛓️⚓⛓️  AveryOS™ Evidence Packager — Phase 84');
  console.log(`   RayID:        ${rayId}`);
  console.log(`   Kernel:       ${KERNEL_VERSION} | ${KERNEL_SHA.substring(0, 16)}…`);
  console.log(`   Output:       ${outDir}`);
  if (dryRun) console.log('   Mode:         DRY RUN — no files written\n');
  else console.log();

  const packagedAt = new Date().toISOString();

  // 1. Fetch D1 audit metadata
  log('INFO', 'Fetching D1 anchor_audit_logs for RayID…');
  const d1Rows = await queryD1(
    'SELECT * FROM anchor_audit_logs WHERE ray_id = ? LIMIT 10',
    [rayId]
  );
  if (d1Rows?.length) {
    log('INFO', `D1: found ${d1Rows.length} anchor_audit_log row(s)`);
  } else {
    log('WARN', 'D1: no anchor_audit_log rows found for this RayID');
  }

  log('INFO', 'Fetching D1 sovereign_audit_logs for RayID…');
  const d1SovRows = await queryD1(
    'SELECT * FROM sovereign_audit_logs WHERE ip_address = (SELECT ip_address FROM anchor_audit_logs WHERE ray_id = ? LIMIT 1) LIMIT 10',
    [rayId]
  );
  if (d1SovRows?.length) {
    log('INFO', `D1: found ${d1SovRows.length} sovereign_audit_log row(s)`);
  } else {
    log('WARN', 'D1: no sovereign_audit_log rows found for this RayID');
  }

  // 2. Fetch R2 evidence JSON
  log('INFO', `Fetching R2 evidence bundle: evidence/${rayId}.json…`);
  const r2Raw = await fetchR2Object(`evidence/${rayId}.json`);
  const r2Evidence = r2Raw ? JSON.parse(r2Raw) : null;
  if (r2Evidence) {
    log('INFO', 'R2 evidence bundle retrieved');
  } else {
    log('WARN', 'R2 evidence bundle not found — bundle will note absence');
  }

  // 3. BTC anchor
  log('INFO', 'Fetching BTC block anchor…');
  const btcAnchor = await fetchBtcAnchor();

  // 4. Compose bundle
  const bundlePayload = {
    ray_id:        rayId,
    packaged_at:   packagedAt,
    creator_lock:  CREATOR_LOCK,
    kernel_sha:    KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    btc_anchor: {
      block_hash: btcAnchor.hash,
      source:     btcAnchor.source,
      anchored_at: packagedAt,
    },
    d1_anchor_audit_logs:    d1Rows ?? [],
    d1_sovereign_audit_logs: d1SovRows ?? [],
    r2_evidence:             r2Evidence,
    r2_key:                  `evidence/${rayId}.json`,
  };

  // 5. Double-lock signature: SHA-512(KERNEL_SHA + BTC_HASH + rayId + packagedAt)
  const sigInput = `${KERNEL_SHA}:${btcAnchor.hash ?? 'UNAVAILABLE'}:${rayId}:${packagedAt}`;
  const bundleSig = sha512(sigInput);
  const finalBundle = {
    ...bundlePayload,
    double_lock_sig: bundleSig,
    sig_input_preview: `${KERNEL_SHA.substring(0, 16)}…:${(btcAnchor.hash ?? 'UNAVAILABLE').substring(0, 16)}…:${rayId}:${packagedAt}`,
  };

  log('INFO', `Double-lock signature: ${bundleSig.substring(0, 32)}…`);

  if (dryRun) {
    console.log('\n[DRY RUN] .aospak bundle preview:');
    console.log(JSON.stringify(finalBundle, null, 2));
    console.log('\n[DRY RUN] No files written.');
    return;
  }

  // 6. Write .aospak file
  fs.mkdirSync(outDir, { recursive: true });
  // codeql[js/file-system-race]
  const outPath = path.resolve(outDir, path.basename(`${rayId}.aospak`));
  const fdPak = fs.openSync(outPath, 'w');
  try { fs.writeSync(fdPak, JSON.stringify(finalBundle, null, 2)); } finally { fs.closeSync(fdPak); }
  log('INFO', `Evidence bundle written: ${outPath}`);

  console.log('\n⛓️⚓⛓️  Evidence package complete.');
  console.log(`   Bundle:      ${outPath}`);
  console.log(`   Signature:   ${bundleSig.substring(0, 32)}…`);
  console.log(`   Kernel:      ${KERNEL_SHA.substring(0, 16)}…`);
  console.log(`   BTC Anchor:  ${btcAnchor.hash?.substring(0, 16) ?? 'UNAVAILABLE'}…`);
  console.log();
})().catch((err) => {
  console.error('[AOS] FATAL:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
