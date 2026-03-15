#!/usr/bin/env node
/**
 * scripts/residency-check.cjs
 *
 * AveryOS™ USB Residency Handshake — Gate 115.1.3
 *
 * Detects the physical USB salt volume named "AVERY_ROOT_ANCHOR" and toggles
 * the Node-02 physical residency state.
 *
 * Protocol:
 *   1. Scan all mounted volumes for a volume labelled "AVERY_ROOT_ANCHOR".
 *   2. If found: read the salt file, verify SHA-512 against the known anchor,
 *      and write Node-02_Physical status to .sovereign-nodes.json (gitignored).
 *   3. If not found: remain in Cloud Execution Mode (Node-02_Physical = false).
 *
 * Execution states:
 *   CLOUD_EXECUTION_MODE  — USB salt not present; operating without physical anchor.
 *   FULLY_RESIDENT        — USB salt confirmed; Sequential Ignition Logic (SIL) active.
 *
 * Usage:
 *   node scripts/residency-check.cjs [--verbose] [--dry-run]
 *
 * Options:
 *   --verbose   Print detailed scan progress to stdout.
 *   --dry-run   Perform all checks but do NOT write state file.
 *
 * Security:
 *   • The salt value is NEVER logged or printed.
 *   • .sovereign-nodes.json is gitignored and must NEVER be committed.
 *   • If the volume is present but the salt hash mismatches, the script
 *     exits with code 3 (SALT_MISMATCH) — no state file is written.
 *
 * Exit codes:
 *   0 — FULLY_RESIDENT (USB salt confirmed)
 *   1 — Script error
 *   2 — CLOUD_EXECUTION_MODE (USB not found — non-fatal, expected)
 *   3 — SALT_MISMATCH (volume found but salt hash is wrong)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Constants ─────────────────────────────────────────────────────────────────

const VOLUME_LABEL     = 'AVERY_ROOT_ANCHOR';
const SALT_FILENAME    = 'anchor.salt';
const STATE_FILE       = path.join(process.cwd(), '.sovereign-nodes.json');
const KERNEL_VERSION   = 'v3.6.2';

// ── CLI flags ─────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const VERBOSE  = args.includes('--verbose');
const DRY_RUN  = args.includes('--dry-run');

// ── Helpers ───────────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const GOLD   = '\x1b[33m';

function info(msg) {
  if (VERBOSE) console.log(`${CYAN}[residency-check]${RESET} ${msg}`);
}

function success(msg) {
  console.log(`${GREEN}✔${RESET}  ${msg}`);
}

function warn(msg) {
  console.warn(`${YELLOW}⚠${RESET}  ${msg}`);
}

function fail(msg) {
  console.error(`${RED}✘${RESET}  ${msg}`);
}

/**
 * Returns an array of candidate mount points that might carry the USB volume.
 * Platform-aware: checks /Volumes (macOS), /media and /mnt (Linux).
 *
 * @returns {string[]}
 */
function getCandidateMounts() {
  const candidates = [];

  switch (os.platform()) {
    case 'darwin':
      candidates.push('/Volumes');
      break;
    case 'linux':
      candidates.push('/media', '/mnt', '/run/media');
      try {
        // Also check /media/<username>/ if present
        const username = os.userInfo().username;
        const userMedia = `/media/${username}`;
        if (fs.existsSync(userMedia)) candidates.push(userMedia);
      } catch {
        // best-effort
      }
      break;
    case 'win32':
      // On Windows, scan all drive letters A–Z
      for (let charCode = 65; charCode <= 90; charCode++) {
        candidates.push(`${String.fromCharCode(charCode)}:\\`);
      }
      break;
    default:
      candidates.push('/Volumes', '/media', '/mnt');
  }

  return candidates;
}

/**
 * Attempt to locate the AVERY_ROOT_ANCHOR volume across candidate mount points.
 *
 * @returns {string|null} Absolute path to the volume root, or null.
 */
function findAnchorVolume() {
  const candidates = getCandidateMounts();

  for (const base of candidates) {
    if (!fs.existsSync(base)) continue;

    // Direct match at base level (e.g. /Volumes/AVERY_ROOT_ANCHOR)
    const direct = path.join(base, VOLUME_LABEL);
    if (fs.existsSync(direct)) {
      info(`Volume found at ${direct}`);
      return direct;
    }

    // One level deep (e.g. /media/username/AVERY_ROOT_ANCHOR)
    try {
      const entries = fs.readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const nested = path.join(base, entry.name, VOLUME_LABEL);
        if (fs.existsSync(nested)) {
          info(`Volume found (nested) at ${nested}`);
          return nested;
        }
      }
    } catch {
      // Permission denied or not a directory — skip
    }
  }

  // Fallback: try lsblk on Linux to find by LABEL
  if (os.platform() === 'linux') {
    try {
      const lsblkOut = execSync(
        'lsblk -o LABEL,MOUNTPOINT --json --noheadings 2>/dev/null',
        { stdio: ['ignore', 'pipe', 'ignore'] },
      ).toString();
      const parsed = JSON.parse(lsblkOut);
      const devices = (parsed.blockdevices || []).flatMap(
        (d) => [d, ...(d.children || [])],
      );
      for (const dev of devices) {
        if (dev.label === VOLUME_LABEL && dev.mountpoint) {
          info(`Volume found via lsblk at ${dev.mountpoint}`);
          return dev.mountpoint;
        }
      }
    } catch {
      // lsblk not available or JSON parse failed — skip silently
    }
  }

  return null;
}

/**
 * Compute SHA-512 of a buffer.
 *
 * @param {Buffer} buf
 * @returns {string} Lowercase hex digest
 */
function sha512Hex(buf) {
  return crypto.createHash('sha512').update(buf).digest('hex');
}

/**
 * Read the current state file, if it exists.
 *
 * @returns {Record<string, unknown>}
 */
function readStateFile() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Write the updated state file.
 *
 * @param {Record<string, unknown>} state
 */
function writeStateFile(state) {
  if (DRY_RUN) {
    console.log(`${YELLOW}[DRY-RUN]${RESET} Would write to ${STATE_FILE}:`);
    console.log(JSON.stringify(state, null, 2));
    return;
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${GOLD}⛓️⚓⛓️  AveryOS™ USB Residency Handshake${RESET}`);
  console.log(`${GOLD}       Gate 115.1.3 · Kernel ${KERNEL_VERSION}${RESET}\n`);

  info('Scanning candidate mount points for volume: ' + VOLUME_LABEL);

  const volumePath = findAnchorVolume();

  if (!volumePath) {
    warn(`Volume "${VOLUME_LABEL}" not found.`);
    warn('Remaining in CLOUD_EXECUTION_MODE (Node-02_Physical = false).');
    warn('Mount the AOS salt USB to activate FULLY_RESIDENT state.');

    // Ensure state file reflects cloud-only mode
    const state = readStateFile();
    state['Node-02_Physical'] = false;
    state['residency_state']  = 'CLOUD_EXECUTION_MODE';
    state['checked_at']       = new Date().toISOString();
    state['kernel_version']   = KERNEL_VERSION;
    writeStateFile(state);

    process.exit(2);
  }

  success(`Volume found: ${volumePath}`);

  // ── Read the salt file ────────────────────────────────────────────────────
  const saltPath = path.join(volumePath, SALT_FILENAME);

  if (!fs.existsSync(saltPath)) {
    warn(`Salt file "${SALT_FILENAME}" not found on volume.`);
    warn('Volume present but anchor.salt is missing — cannot confirm residency.');

    const state = readStateFile();
    state['Node-02_Physical']    = false;
    state['residency_state']     = 'VOLUME_FOUND_SALT_MISSING';
    state['checked_at']          = new Date().toISOString();
    state['kernel_version']      = KERNEL_VERSION;
    state['volume_path']         = volumePath;
    writeStateFile(state);

    process.exit(3);
  }

  let saltBuf;
  try {
    saltBuf = fs.readFileSync(saltPath);
  } catch (err) {
    logAosError(AOS_ERROR.NOT_FOUND, `Cannot read salt file: ${err.message}`, err);
    fail('Failed to read anchor.salt — permission denied?');
    process.exit(1);
  }

  const saltHash = sha512Hex(saltBuf);
  info('Salt file read. SHA-512 computed (not displayed for security).');

  // ── Verify against known anchor (if ANCHOR_SALT_SHA512 env is set) ────────
  const knownHash = process.env.ANCHOR_SALT_SHA512;
  if (knownHash && knownHash.trim()) {
    if (saltHash !== knownHash.trim().toLowerCase()) {
      fail('SALT_MISMATCH — SHA-512 of anchor.salt does not match ANCHOR_SALT_SHA512 env.');
      fail('Physical residency NOT activated. USB salt may be corrupted or invalid.');

      const state = readStateFile();
      state['Node-02_Physical'] = false;
      state['residency_state']  = 'SALT_MISMATCH';
      state['checked_at']       = new Date().toISOString();
      state['kernel_version']   = KERNEL_VERSION;
      writeStateFile(state);

      process.exit(3);
    }
    success('Salt SHA-512 verified against ANCHOR_SALT_SHA512 ✓');
  } else {
    info('ANCHOR_SALT_SHA512 env not set — skipping hash verification (presence-only check).');
  }

  // ── Activate FULLY_RESIDENT state ─────────────────────────────────────────
  const state = readStateFile();

  state['Node-02_Physical']      = true;
  state['residency_state']       = 'FULLY_RESIDENT';
  state['checked_at']            = new Date().toISOString();
  state['kernel_version']        = KERNEL_VERSION;
  state['volume_path']           = volumePath;
  // Store the salt fingerprint (hash prefix only — never the raw salt)
  state['salt_sha512_prefix']    = saltHash.slice(0, 16) + '…';
  state['sil_triggered']         = true;

  writeStateFile(state);

  logAosHeal(
    'USB_RESIDENCY',
    `Node-02_Physical activated — FULLY_RESIDENT. Kernel ${KERNEL_VERSION}.`,
  );

  success('⚡ Sequential Ignition Logic (SIL) triggered.');
  success('   Node-02_Physical = true  →  FULLY_RESIDENT');
  success(`   State written to ${DRY_RUN ? '[DRY-RUN]' : STATE_FILE}`);
  console.log(`\n${GOLD}⛓️⚓⛓️  Residency Handshake Complete${RESET}\n`);

  process.exit(0);
}

main().catch((err) => {
  logAosError(AOS_ERROR.NOT_FOUND, err.message, err);
  fail(`Unexpected error: ${err.message}`);
  process.exit(1);
});
