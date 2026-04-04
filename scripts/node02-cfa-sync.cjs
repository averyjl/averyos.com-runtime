#!/usr/bin/env node
/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * scripts/node02-cfa-sync.cjs
 *
 * AveryOS™ Node-02 CFA (Forensic Cause Analysis) Data Sync
 *
 * GATE 130.9.2 — CFA DATA SYNC
 *
 * Implements a secure bi-directional sync between:
 *   - The local .aoscap archive (Node-02 physical residency)
 *   - The Cloudflare D1 database (sovereign cloud ledger)
 *
 * Sync direction:
 *   LOCAL → D1  : Upload new .aoscap capsules from Node-02 to D1
 *   D1 → LOCAL  : Pull new D1 capsule records to local .aoscap archive
 *
 * Authentication:
 *   - VAULT_PASSPHRASE env var (used to derive HMAC token for D1 API)
 *   - ALM_SECRET_TOKEN env var (used for ALM-bound requests)
 *
 * The .aoscap archive directory is read-only from a gitignore perspective —
 * this script never commits sensitive capsule payloads to git.
 *
 * Usage:
 *   node scripts/node02-cfa-sync.cjs                  # full bi-directional sync
 *   node scripts/node02-cfa-sync.cjs --direction up   # local → D1 only
 *   node scripts/node02-cfa-sync.cjs --direction down # D1 → local only
 *   node scripts/node02-cfa-sync.cjs --dry-run        # report only, no writes
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs      = require('node:fs');
const path    = require('node:path');
const crypto  = require('node:crypto');
const https   = require('node:https');
const { logAosError, logAosHeal } = require('./sovereignErrorLogger.cjs');

// ── Configuration ─────────────────────────────────────────────────────────────

const ROOT            = path.resolve(__dirname, '..');
const AOSCAP_DIR      = path.join(ROOT, 'capsules');

// ── SSRF Guard: D1_API_BASE must be an https://averyos.com path — never user-arbitrary ──
const D1_API_BASE_RAW = process.env.D1_API_BASE ?? 'https://averyos.com/api/v1/capsules';
const D1_API_BASE_ALLOWED_ORIGIN = 'https://averyos.com';
let D1_API_BASE;
try {
  const parsedUrl = new URL(D1_API_BASE_RAW);
  if (parsedUrl.origin !== D1_API_BASE_ALLOWED_ORIGIN) {
    console.error(`❌ SSRF Guard: D1_API_BASE origin must be ${D1_API_BASE_ALLOWED_ORIGIN}`);
    console.error(`   Got origin: ${parsedUrl.origin}`);
    process.exit(1);
  }
  D1_API_BASE = parsedUrl.href;
} catch (urlErr) {
  const errorMessage = urlErr instanceof Error ? urlErr.message : String(urlErr);
  console.error(`❌ SSRF Guard: D1_API_BASE is not a valid URL: ${D1_API_BASE_RAW}`);
  console.error(`   Error: ${errorMessage}`);
  logAosError('node02-cfa-sync', `Invalid D1_API_BASE URL: ${D1_API_BASE_RAW}`, urlErr);
  process.exit(1);
}

const VAULT_PASSPHRASE = process.env.VAULT_PASSPHRASE ?? '';
const DRY_RUN         = process.argv.includes('--dry-run');
const DIRECTION       = (() => {
  const idx = process.argv.indexOf('--direction');
  const val = idx >= 0 ? process.argv[idx + 1] : 'both';
  if (!['up', 'down', 'both'].includes(val)) {
    console.error(`❌ Invalid --direction value: ${val}. Must be up, down, or both.`);
    process.exit(1);
  }
  return val;
})();

const KERNEL_SHA = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

// ── HMAC Token Generation ─────────────────────────────────────────────────────

/**
 * Derive a time-bound HMAC-SHA256 sync token from VAULT_PASSPHRASE.
 * Token is valid for a 5-minute window (aligned to 5-minute epochs).
 */
function deriveSyncToken() {
  if (!VAULT_PASSPHRASE) return null;
  const epoch5m = Math.floor(Date.now() / 300_000);
  const payload = `averyos-cfa-sync:${epoch5m}:${KERNEL_SHA.slice(0, 16)}`;
  return crypto
    .createHmac('sha256', VAULT_PASSPHRASE)
    .update(payload)
    .digest('hex');
}

// ── HTTP Helper ───────────────────────────────────────────────────────────────

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: safeParseJson(data, url.toString()) });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function safeParseJson(raw, context) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    logAosError('node02-cfa-sync', `JSON parse error in response from ${context}: ${err.message}`);
    return raw;
  }
}

// ── Local Capsule Discovery ───────────────────────────────────────────────────

/**
 * Discover all .aoscap capsule files in the capsules/ directory.
 * Returns array of { filePath, capsuleId, sha512, content } objects.
 */
function discoverLocalCapsules() {
  if (!fs.existsSync(AOSCAP_DIR)) return [];

  return fs
    .readdirSync(AOSCAP_DIR)
    .filter((f) => f.endsWith('.aoscap') || f.endsWith('.json'))
    .map((f) => {
      const filePath = path.join(AOSCAP_DIR, f);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const sha512 = crypto.createHash('sha512').update(content, 'utf8').digest('hex');
        // Attempt to parse capsule ID from JSON content
        let capsuleId = path.basename(f, '.aoscap');
        try {
          const parsed = JSON.parse(content);
          capsuleId = parsed.capsule_id ?? parsed.id ?? capsuleId;
        } catch { /* not JSON — use filename */ }
        return { filePath, capsuleId, sha512, content };
      } catch (err) {
        logAosError('node02-cfa-sync', `Failed to read capsule ${f}`, err);
        return null;
      }
    })
    .filter(Boolean);
}

// ── Upload (LOCAL → D1) ───────────────────────────────────────────────────────

async function syncLocalToD1(capsules) {
  const token = deriveSyncToken();
  if (!token) {
    console.warn('⚠️  No VAULT_PASSPHRASE set — skipping LOCAL → D1 sync');
    return { uploaded: 0, skipped: 0, errors: 0 };
  }

  let uploaded = 0, skipped = 0, errors = 0;

  for (const capsule of capsules) {
    if (DRY_RUN) {
      console.log(`  📋 [DRY] Would upload: ${capsule.capsuleId} (sha512: ${capsule.sha512.slice(0, 16)}...)`);
      continue;
    }

    try {
      const url = new URL(`${D1_API_BASE}/sync`);
      const result = await httpsRequest(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cfa-sync-token': token,
            'x-kernel-sha': KERNEL_SHA.slice(0, 16),
          },
        },
        {
          capsule_id: capsule.capsuleId,
          sha512: capsule.sha512,
          content: capsule.content,
          source: 'node-02-local',
        }
      );

      if (result.status === 200 || result.status === 201) {
        uploaded++;
        console.log(`  ✅ Uploaded: ${capsule.capsuleId}`);
        logAosHeal('node02-cfa-sync', `Capsule uploaded: ${capsule.capsuleId}`);
      } else if (result.status === 409) {
        skipped++;
        console.log(`  ℹ️  Already synced: ${capsule.capsuleId}`);
      } else {
        errors++;
        logAosError('node02-cfa-sync', `Upload failed for ${capsule.capsuleId}: HTTP ${result.status}`);
      }
    } catch (err) {
      errors++;
      logAosError('node02-cfa-sync', `Network error uploading ${capsule.capsuleId}`, err);
    }
  }

  return { uploaded, skipped, errors };
}

// ── Download (D1 → LOCAL) ─────────────────────────────────────────────────────

async function syncD1ToLocal() {
  const token = deriveSyncToken();
  if (!token) {
    console.warn('⚠️  No VAULT_PASSPHRASE set — skipping D1 → LOCAL sync');
    return { downloaded: 0, skipped: 0, errors: 0 };
  }

  let downloaded = 0, skipped = 0, errors = 0;

  try {
    const url = new URL(`${D1_API_BASE}/list`);
    const result = await httpsRequest(
      url,
      {
        method: 'GET',
        headers: {
          'x-cfa-sync-token': token,
          'x-kernel-sha': KERNEL_SHA.slice(0, 16),
        },
      },
      null
    );

    if (result.status !== 200) {
      logAosError('node02-cfa-sync', `D1 capsule list failed: HTTP ${result.status}`);
      return { downloaded: 0, skipped: 0, errors: 1 };
    }

    const remoteCapsules = Array.isArray(result.body) ? result.body : (result.body?.capsules ?? []);
    const localFiles = new Set(
      discoverLocalCapsules().map((c) => c.sha512)
    );

    for (const remote of remoteCapsules) {
      if (localFiles.has(remote.sha512)) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  📋 [DRY] Would download: ${remote.capsule_id}`);
        continue;
      }

      try {
        const dlUrl = new URL(`${D1_API_BASE}/${remote.capsule_id}`);
        const dlResult = await httpsRequest(
          dlUrl,
          {
            method: 'GET',
            headers: { 'x-cfa-sync-token': token },
          },
          null
        );

        if (dlResult.status === 200 && dlResult.body?.content) {
          const fileName = `${remote.capsule_id}.aoscap`;
          const filePath = path.join(AOSCAP_DIR, fileName);
          fs.writeFileSync(filePath, dlResult.body.content, 'utf8');
          downloaded++;
          console.log(`  ✅ Downloaded: ${remote.capsule_id}`);
          logAosHeal('node02-cfa-sync', `Capsule downloaded: ${remote.capsule_id}`);
        }
      } catch (err) {
        errors++;
        logAosError('node02-cfa-sync', `Download failed for ${remote.capsule_id}`, err);
      }
    }
  } catch (err) {
    errors++;
    logAosError('node02-cfa-sync', 'D1 capsule list request failed', err);
  }

  return { downloaded, skipped, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('⛓️⚓⛓️  AveryOS™ Node-02 CFA Sync — GATE 130.9.2');
  console.log(`  Direction : ${DIRECTION}`);
  console.log(`  Dry Run   : ${DRY_RUN ? 'YES' : 'NO'}`);
  console.log(`  Capsule Dir: ${AOSCAP_DIR}`);
  console.log('');

  if (!fs.existsSync(AOSCAP_DIR)) {
    console.log(`  ℹ️  Capsule directory not found: ${AOSCAP_DIR}`);
    console.log('  Creating capsule directory...');
    if (!DRY_RUN) fs.mkdirSync(AOSCAP_DIR, { recursive: true });
  }

  const localCapsules = discoverLocalCapsules();
  console.log(`  📦 Local capsules found: ${localCapsules.length}`);

  let totalUploaded = 0, totalDownloaded = 0, totalErrors = 0;

  if (DIRECTION === 'up' || DIRECTION === 'both') {
    console.log('\n  ── LOCAL → D1 ──');
    const upResult = await syncLocalToD1(localCapsules);
    totalUploaded = upResult.uploaded;
    totalErrors += upResult.errors;
    console.log(`  Uploaded: ${upResult.uploaded} | Skipped: ${upResult.skipped} | Errors: ${upResult.errors}`);
  }

  if (DIRECTION === 'down' || DIRECTION === 'both') {
    console.log('\n  ── D1 → LOCAL ──');
    const downResult = await syncD1ToLocal();
    totalDownloaded = downResult.downloaded;
    totalErrors += downResult.errors;
    console.log(`  Downloaded: ${downResult.downloaded} | Skipped: ${downResult.skipped} | Errors: ${downResult.errors}`);
  }

  console.log('');
  if (totalErrors > 0) {
    console.error(`❌ CFA Sync completed with ${totalErrors} error(s). Check sovereign error log.`);
    process.exit(1);
  } else {
    console.log(`✅ CFA Sync complete — Uploaded: ${totalUploaded} | Downloaded: ${totalDownloaded}`);
    logAosHeal('node02-cfa-sync', `Sync complete. Up: ${totalUploaded} Down: ${totalDownloaded}`);
  }
}

main().catch((err) => {
  logAosError('node02-cfa-sync', 'Fatal error in CFA sync', err);
  console.error('❌ Fatal CFA sync error:', err);
  process.exit(1);
});
