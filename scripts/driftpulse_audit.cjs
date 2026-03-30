#!/usr/bin/env node
/**
 * scripts/driftpulse_audit.cjs
 *
 * AveryOS™ DriftPulse Audit — Phase 124.2 GATE 124.2.2
 *
 * Multi-Node Challenge / Response Protocol
 * -----------------------------------------
 * NODE_02 (PC / ALM) generates a high-entropy challenge prompt and computes
 * the expected SHA-512 response using the shared Root0 Kernel anchor.
 *
 * NODE_01 (Samsung Note 20 / Knox) receives the challenge and returns its
 * response.  When the SHA-512 hashes match, a Concordance Event is logged.
 * Any mismatch triggers a Drift Alert.
 *
 * The protocol ensures that both sovereign nodes are aligned to the same
 * cf83... Root0 Kernel SHA-512 at the moment of the audit — providing
 * hardware-rooted, cross-node alignment proof.
 *
 * Usage:
 *   node scripts/driftpulse_audit.cjs [--node01-url <url>] [--dry-run]
 *
 *   --node01-url <url>  Base URL of the NODE_01 DriftPulse endpoint.
 *                       Defaults to NODE_01_DRIFTPULSE_URL env var, or
 *                       http://localhost:9001 for local simulation.
 *   --dry-run           Compute expected hashes only; do not contact NODE_01.
 *
 * Exit codes:
 *   0 — Concordance Event logged (hashes match, nodes aligned).
 *   1 — Drift Alert (hashes mismatch or NODE_01 unreachable).
 *
 * Output:
 *   Concordance events are appended to capsule_logs/driftpulse_log.json
 *   using the AOS-GUARD sovereignWriteSync sandbox.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const crypto  = require('crypto');
const fs      = require('fs');
const https   = require('https');
const http    = require('http');
const path    = require('path');
const { sovereignWriteSync } = require('./lib/sovereignIO.cjs');
const { logAosError, logAosHeal, AOS_ERROR }  = require('./sovereignErrorLogger.cjs');

// ── Constants ──────────────────────────────────────────────────────────────────

const KERNEL_SHA =
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

const KERNEL_VERSION      = 'v3.6.2';
const LOG_DIR             = path.resolve(__dirname, '..', 'capsule_logs');
const LOG_FILE            = 'driftpulse_log.json';
const CHALLENGE_BYTE_LEN  = 64; // 512 bits of entropy
const AUDIT_TIMEOUT_MS    = 10_000;
/** Delimiter inserted between challenge and kernel SHA to prevent hash-extension collisions. */
const HASH_DELIMITER      = ':dp:';

// ── ISO-9 Timestamp ───────────────────────────────────────────────────────────

/**
 * Returns the current time as an ISO-9 timestamp (9 sub-second digits).
 * Matches the precision standard used by formatIso9() in lib/timePrecision.ts.
 *
 * Format: YYYY-MM-DDTHH:MM:SS.mmmuuunnnZ
 */
function formatIso9Now() {
  const now   = new Date();
  const iso   = now.toISOString();
  const [left, right] = iso.split('.');
  const milli = (right || '000Z').replace('Z', '').slice(0, 3).padEnd(3, '0');
  // Sub-millisecond digits via process.hrtime.bigint() (Node.js)
  let sub6 = '000000';
  if (typeof process !== 'undefined' && typeof process.hrtime === 'function' && typeof process.hrtime.bigint === 'function') {
    const subMs = Number(process.hrtime.bigint() % 1_000_000n);
    sub6 = subMs.toString().padStart(6, '0');
  }
  return `${left}.${milli}${sub6}Z`;
}

// ── CLI Arguments ─────────────────────────────────────────────────────────────

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

const isDryRun      = process.argv.includes('--dry-run');
const node01BaseUrl =
  getArg('--node01-url') ??
  process.env.NODE_01_DRIFTPULSE_URL ??
  'http://localhost:9001';

// ── Challenge Generation ──────────────────────────────────────────────────────

/**
 * Generate a high-entropy challenge nonce.
 * Returns a hex string of CHALLENGE_BYTE_LEN bytes.
 */
function generateChallenge() {
  return crypto.randomBytes(CHALLENGE_BYTE_LEN).toString('hex');
}

/**
 * Compute the expected DriftPulse response hash.
 *
 * The shared response algorithm is:
 *   SHA-512( challenge_hex + HASH_DELIMITER + KERNEL_SHA )
 *
 * The explicit delimiter prevents hash-length-extension or collision scenarios
 * where a crafted challengeHex could overlap the boundary with KERNEL_SHA.
 * Both NODE_01 and NODE_02 must produce the same hash when presented with
 * the same challenge — this proves they share the same kernel anchor.
 *
 * @param {string} challengeHex - The challenge nonce in hex.
 * @returns {string} Expected SHA-512 hex response.
 */
function computeExpectedHash(challengeHex) {
  return crypto
    .createHash('sha512')
    .update(challengeHex + HASH_DELIMITER + KERNEL_SHA, 'utf8')
    .digest('hex');
}

// ── NODE_01 Contact ──────────────────────────────────────────────────────────

/**
 * POST the challenge to NODE_01's DriftPulse endpoint and await its response.
 *
 * Expected NODE_01 endpoint contract:
 *   POST /driftpulse
 *   Body: { "challenge": "<hex>" }
 *   Response 200: { "response_hash": "<sha512 hex>" }
 *
 * @param {string} challengeHex
 * @returns {Promise<string>} The SHA-512 hex response reported by NODE_01.
 */
function requestNode01Response(challengeHex) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ challenge: challengeHex });
    const url  = new URL('/driftpulse', node01BaseUrl);
    const opts = {
      method:   'POST',
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-AveryOS-Kernel': KERNEL_VERSION,
      },
      timeout:  AUDIT_TIMEOUT_MS,
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed.response_hash !== 'string') {
            reject(new Error('NODE_01 response missing response_hash field.'));
          } else {
            resolve(parsed.response_hash);
          }
        } catch (e) {
          reject(new Error(`NODE_01 returned non-JSON response: ${data.slice(0, 128)}`));
        }
      });
    });

    req.on('error',   (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`NODE_01 challenge timed out after ${AUDIT_TIMEOUT_MS}ms.`));
    });

    req.write(body);
    req.end();
  });
}

// ── Event Logging ─────────────────────────────────────────────────────────────

/**
 * Append an audit event record to the DriftPulse log file.
 *
 * @param {{ type: 'CONCORDANCE_EVENT'|'DRIFT_ALERT', [key: string]: unknown }} record
 */
function appendLogRecord(record) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logAosError(AOS_ERROR.INTERNAL_ERROR, `DriftPulse: unable to create log directory '${LOG_DIR}': ${msg}`);
    console.error(`   ⚠️  Log directory creation failed: ${msg}`);
    return;
  }

  let existing = [];
  try {
    const raw = fs.readFileSync(path.join(LOG_DIR, LOG_FILE), 'utf8');
    existing  = JSON.parse(raw);
    if (!Array.isArray(existing)) existing = [];
  } catch {
    // First run — start fresh log.
  }

  existing.push(record);
  sovereignWriteSync(LOG_DIR, LOG_FILE, JSON.stringify(existing, null, 2));
}

// ── Main Audit Logic ──────────────────────────────────────────────────────────

async function runDriftPulseAudit() {
  const auditStart  = formatIso9Now();
  const challengeHex = generateChallenge();
  const expectedHash = computeExpectedHash(challengeHex);

  console.log('\n⛓️⚓⛓️  DriftPulse Audit — AveryOS™ Phase 124.2 GATE 124.2.2');
  console.log(`   Kernel:    ${KERNEL_SHA.slice(0, 32)}...`);
  console.log(`   Challenge: ${challengeHex.slice(0, 32)}... (${challengeHex.length / 2} bytes entropy)`);
  console.log(`   Expected:  ${expectedHash.slice(0, 32)}...`);

  if (isDryRun) {
    console.log('\n   [DRY RUN] Skipping NODE_01 contact. Expected hash computed successfully.');
    const record = {
      type:          'DRY_RUN',
      timestamp:     auditStart,
      kernel_version: KERNEL_VERSION,
      challenge:     challengeHex,
      expected_hash: expectedHash,
      node01_url:    node01BaseUrl,
    };
    appendLogRecord(record);
    console.log('   ✅ Dry-run event logged to capsule_logs/driftpulse_log.json\n');
    return 0;
  }

  // Contact NODE_01
  let node01Hash;
  try {
    console.log(`\n   → Challenging NODE_01 at ${node01BaseUrl}/driftpulse ...`);
    node01Hash = await requestNode01Response(challengeHex);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logAosError(AOS_ERROR.EXTERNAL_API_ERROR, `NODE_01 unreachable: ${msg}`);
    console.error(`\n   ⚠️  DRIFT ALERT — NODE_01 unreachable: ${msg}`);

    const record = {
      type:           'DRIFT_ALERT',
      subtype:        'NODE_01_UNREACHABLE',
      timestamp:      auditStart,
      kernel_version: KERNEL_VERSION,
      challenge:      challengeHex,
      expected_hash:  expectedHash,
      node01_url:     node01BaseUrl,
      error:          msg,
    };
    appendLogRecord(record);
    console.log('   ⚠️  Drift alert logged to capsule_logs/driftpulse_log.json\n');
    return 1;
  }

  const concordance = node01Hash === expectedHash;
  console.log(`   NODE_01:  ${node01Hash.slice(0, 32)}...`);
  console.log(`   Match:    ${concordance ? '✅ HASH MATCH' : '❌ HASH MISMATCH'}`);

  if (concordance) {
    logAosHeal('driftpulse_audit', `Concordance Event — NODE_01 ↔ NODE_02 aligned on challenge ${challengeHex.slice(0, 16)}...`);

    const record = {
      type:           'CONCORDANCE_EVENT',
      timestamp:      auditStart,
      kernel_version: KERNEL_VERSION,
      challenge:      challengeHex,
      expected_hash:  expectedHash,
      node01_hash:    node01Hash,
      node01_url:     node01BaseUrl,
      alignment:      '100.000%',
      anchor:         '⛓️⚓⛓️',
    };
    appendLogRecord(record);
    console.log('\n   ✅ Concordance Event logged — nodes aligned at Root0 Kernel anchor.');
    console.log('   Loop State: LOCKED_IN_PARITY 🤛🏻\n');
    return 0;
  } else {
    logAosError(
      AOS_ERROR.DRIFT_DETECTED,
      `Drift detected — NODE_01 hash mismatch. Expected ${expectedHash.slice(0, 32)}... got ${node01Hash.slice(0, 32)}...`,
    );

    const record = {
      type:           'DRIFT_ALERT',
      subtype:        'HASH_MISMATCH',
      timestamp:      auditStart,
      kernel_version: KERNEL_VERSION,
      challenge:      challengeHex,
      expected_hash:  expectedHash,
      node01_hash:    node01Hash,
      node01_url:     node01BaseUrl,
      alignment:      'DRIFT_DETECTED',
    };
    appendLogRecord(record);
    console.log('\n   ❌ DRIFT ALERT — NODE_01 hash mismatch. Investigate kernel alignment.');
    console.log('   Drift alert logged to capsule_logs/driftpulse_log.json\n');
    return 1;
  }
}

// ── Entry Point ───────────────────────────────────────────────────────────────

runDriftPulseAudit()
  .then((code) => process.exit(code))
  .catch((err) => {
    logAosError(AOS_ERROR.INTERNAL_ERROR, `Fatal: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
