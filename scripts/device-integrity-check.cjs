#!/usr/bin/env node
/**
 * scripts/device-integrity-check.cjs
 *
 * AveryOS™ Device Integrity Check — ADB Android ID Verification
 *
 * Compares a locally stored device UUID (read from .aid.bak as a binary
 * buffer) against the live android_id retrieved via ADB from the tethered
 * Android device.  The result — MATCH or MISMATCH — is written to a
 * timestamped JSON audit log in the logs/ directory.
 *
 * Usage:
 *   node scripts/device-integrity-check.cjs [--aid-bak <path>] [--out-dir <dir>]
 *
 *   --aid-bak <path>   Path to the .aid.bak binary file (default: .aid.bak)
 *   --out-dir <dir>    Directory for the output JSON log (default: logs/)
 *
 * Exit codes:
 *   0 — MATCH     (stored UUID matches device android_id)
 *   1 — MISMATCH  (stored UUID does not match device android_id)
 *   2 — ERROR     (could not read .aid.bak or ADB command failed)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const { exec }     = require('child_process');
const { promisify } = require('util');

const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

const execAsync = promisify(exec);

// ── Sovereign Kernel Anchor ────────────────────────────────────────────────────
// Source of truth: lib/sovereignConstants.ts — mirrored here for CJS compat.
const KERNEL_SHA = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

// ── Defaults ───────────────────────────────────────────────────────────────────

const ROOT_DIR       = path.resolve(__dirname, '..');
const DEFAULT_AID    = path.join(ROOT_DIR, '.aid.bak');
const DEFAULT_OUTDIR = path.join(ROOT_DIR, 'logs');

// ── Argument parsing ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let aidBakPath = DEFAULT_AID;
  let outDir     = DEFAULT_OUTDIR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--aid-bak' && args[i + 1]) {
      aidBakPath = path.resolve(args[++i]);
    } else if (args[i] === '--out-dir' && args[i + 1]) {
      outDir = path.resolve(args[++i]);
    }
  }

  return { aidBakPath, outDir };
}

// ── UUID helpers ───────────────────────────────────────────────────────────────

/**
 * Read .aid.bak as a binary buffer and return its hex representation.
 * Android IDs are 8 bytes (64-bit) → 16 hex chars, but the file may also
 * contain a plain UTF-8 hex string.  Both cases are handled.
 *
 * @param {string} aidBakPath — Absolute path to the .aid.bak file
 * @returns {string} Lowercase hex string of the stored UUID
 */
function readAidBak(aidBakPath) {
  const buf = fs.readFileSync(aidBakPath);

  // If the entire buffer is printable ASCII (i.e. already a hex string),
  // strip any trailing newline/whitespace and return as-is.
  const asString = buf.toString('utf8').trim();
  if (/^[0-9a-fA-F]+$/.test(asString)) {
    return asString.toLowerCase();
  }

  // Otherwise treat as raw binary — hex-encode the whole buffer.
  return buf.toString('hex').toLowerCase();
}

/**
 * Retrieve the device's android_id via ADB.
 *
 * @returns {Promise<string>} Lowercase hex android_id string
 */
async function getDeviceAndroidId() {
  const { stdout } = await execAsync('adb shell settings get secure android_id');
  return stdout.trim().toLowerCase();
}

// ── Logging ────────────────────────────────────────────────────────────────────

/**
 * Write the audit result to a timestamped JSON file in outDir.
 *
 * @param {string} outDir
 * @param {object} payload
 * @returns {string} Path to the written log file
 */
function writeAuditLog(outDir, payload) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const ts       = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `device-integrity-${ts}.json`;
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { aidBakPath, outDir } = parseArgs(process.argv);

  console.log('⛓️⚓⛓️  AveryOS™ Device Integrity Check');
  console.log(`   .aid.bak : ${aidBakPath}`);
  console.log(`   Log dir  : ${outDir}`);
  console.log('');

  // ── Step 1: Read stored UUID from .aid.bak ─────────────────────────────────
  let storedId;
  try {
    storedId = readAidBak(aidBakPath);
  } catch (err) {
    logAosError(AOS_ERROR.NOT_FOUND, `.aid.bak could not be read: ${err instanceof Error ? err.message : String(err)}`, err);
    const logPath = writeAuditLog(outDir, {
      timestamp:  new Date().toISOString(),
      result:     'ERROR',
      error_code: AOS_ERROR.NOT_FOUND,
      detail:     `Could not read .aid.bak at ${aidBakPath}`,
      aid_bak:    aidBakPath,
    });
    console.error(`Audit log written: ${logPath}`);
    process.exit(2);
  }

  console.log(`   Stored ID (from .aid.bak) : ${storedId}`);

  // ── Step 2: Get live android_id via ADB ────────────────────────────────────
  let deviceId;
  try {
    deviceId = await getDeviceAndroidId();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Auto-heal hint: ADB may simply not be running or device is disconnected.
    if (msg.includes('not found') || msg.includes('ENOENT') || msg.includes('command not found')) {
      logAosHeal(AOS_ERROR.EXTERNAL_API_ERROR, 'ADB binary not found — ensure adb is installed and in PATH');
    } else if (msg.includes('no devices') || msg.includes('offline')) {
      logAosHeal(AOS_ERROR.EXTERNAL_API_ERROR, 'No ADB device detected — connect device and enable USB debugging');
    }

    logAosError(AOS_ERROR.EXTERNAL_API_ERROR, `adb command failed: ${msg}`, err);
    const logPath = writeAuditLog(outDir, {
      timestamp:   new Date().toISOString(),
      result:      'ERROR',
      error_code:  AOS_ERROR.EXTERNAL_API_ERROR,
      detail:      `adb command failed: ${msg}`,
      stored_id:   storedId,
      device_id:   null,
      aid_bak:     aidBakPath,
    });
    console.error(`Audit log written: ${logPath}`);
    process.exit(2);
  }

  console.log(`   Device ID (adb android_id) : ${deviceId}`);

  // ── Step 3: Compare ────────────────────────────────────────────────────────
  const isMatch = storedId === deviceId;
  const result  = isMatch ? 'MATCH' : 'MISMATCH';

  const payload = {
    timestamp:  new Date().toISOString(),
    result,
    stored_id:  storedId,
    device_id:  deviceId,
    aid_bak:    aidBakPath,
    kernel_note: `AveryOS™ Root0 Sovereign Kernel — ${KERNEL_SHA}`,
  };

  const logPath = writeAuditLog(outDir, payload);

  console.log('');
  if (isMatch) {
    console.log(`✅ MATCH — Device android_id matches stored UUID in .aid.bak`);
  } else {
    console.log(`🚨 MISMATCH — Device android_id does NOT match stored UUID in .aid.bak`);
    console.log(`   Stored : ${storedId}`);
    console.log(`   Device : ${deviceId}`);
  }
  console.log(`\nAudit log written: ${logPath}`);
  console.log('\n🤜🏻');
  console.log('⛓️⚓⛓️');

  process.exit(isMatch ? 0 : 1);
}

main();
