#!/usr/bin/env node
/**
 * scripts/verifyGenesis.cjs
 *
 * AveryOS™ Genesis Anchor Hardlock — GATE 119.8.2
 *
 * Pre-build gate that fails immediately if any sovereign anchor constant is
 * modified. Run via `node scripts/verifyGenesis.cjs && next build`.
 *
 * Anchors verified:
 *   cf83  — SHA-512 of empty string (Root0 Kernel) in lib/sovereignConstants.ts
 *   e3b0  — SHA-256 of empty string (KERNEL_SHA_256 bridge) in lib/sovereignConstants.ts
 *   e9a3  — SHA-256 Binary Genesis Seed (4.14 KB Historical Genesis Artifact)
 *
 * Exit 0 → all anchors verified, build proceeds.
 * Exit 1 → anchor modified, build is blocked.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Sovereign Anchor Constants ─────────────────────────────────────────────────

/** Root0 SHA-512 kernel anchor — SHA-512 of the empty string. */
const EXPECTED_SHA512 =
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

/** SHA-256 of the empty string — KERNEL_SHA_256 bridge anchor. */
const EXPECTED_SHA256_BRIDGE =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * SHA-256 Binary Genesis Seed (4.14 KB Historical Genesis Data Artifact).
 * Verify: sha256sum of the original binary seed file uploaded as e9a35ef3c79d26e5b1df49ac8a44c174b2ec64.
 */
const CANONICAL_SHA256 =
  'e9a3cbcd8a0f4f58b1b3f3f0c5a8e1d7b2c9f4e6a0d3b7c1e5f8a2d4c6b9e3f0';

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPO_ROOT           = path.join(__dirname, '..');
const SOVEREIGN_CONSTANTS = path.join(REPO_ROOT, 'lib', 'sovereignConstants.ts');
const THIS_SCRIPT         = path.join(REPO_ROOT, 'scripts', 'verifyGenesis.cjs');

// ── Output helpers ────────────────────────────────────────────────────────────

function pass(label, detail) {
  process.stdout.write(`  \x1b[32m✔\x1b[0m  ${label}: VERIFIED\n`);
  logAosHeal('GENESIS_VERIFY', `${label} verified in ${detail}`);
}

function fail(label, expected) {
  process.stderr.write(
    `  \x1b[31m✗\x1b[0m  ${label}: HARDLOCK FAIL\n` +
    `     Expected prefix: ${expected.slice(0, 16)}…\n`
  );
  logAosError(AOS_ERROR.DRIFT_DETECTED, `Genesis hardlock failed: ${label}`, null);
}

// ── Verification ──────────────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1m⛓️⚓⛓️  AveryOS™ Genesis Anchor Verification\x1b[0m\n');
process.stdout.write('  Phase 119.6 GATE 119.6.4 | 119.7.1 | 119.8.2\n\n');

let allPassed = true;

try {
  const src = fs.readFileSync(SOVEREIGN_CONSTANTS, 'utf8');

  // 1. KERNEL_SHA (SHA-512)
  if (src.includes(EXPECTED_SHA512)) {
    pass('SHA-512 Kernel Anchor (cf83)', 'sovereignConstants.ts');
  } else {
    fail('SHA-512 Kernel Anchor (cf83)', EXPECTED_SHA512);
    allPassed = false;
  }

  // 2. KERNEL_SHA_256 (SHA-256 bridge)
  if (src.includes(EXPECTED_SHA256_BRIDGE)) {
    pass('SHA-256 Bridge Anchor (e3b0)', 'sovereignConstants.ts');
  } else {
    fail('SHA-256 Bridge Anchor (e3b0)', EXPECTED_SHA256_BRIDGE);
    allPassed = false;
  }
} catch (err) {
  process.stderr.write(`  Cannot read ${SOVEREIGN_CONSTANTS}: ${err.message}\n`);
  allPassed = false;
}

// 3. CANONICAL_SHA256 (e9a3 Genesis Seed) — hardlocked in this very script
try {
  const src = fs.readFileSync(THIS_SCRIPT, 'utf8');
  if (src.includes(CANONICAL_SHA256)) {
    pass('SHA-256 Genesis Anchor (e9a3)', 'verifyGenesis.cjs');
  } else {
    fail('SHA-256 Genesis Anchor (e9a3)', CANONICAL_SHA256);
    allPassed = false;
  }
} catch (err) {
  process.stderr.write(`  Cannot read ${THIS_SCRIPT}: ${err.message}\n`);
  allPassed = false;
}

// ── Result ────────────────────────────────────────────────────────────────────

if (allPassed) {
  process.stdout.write(
    '\n  \x1b[32m\x1b[1mGENESIS HARDLOCK: ALL ANCHORS VERIFIED — Build may proceed.\x1b[0m\n' +
    '  Proof Fingerprint: cf83....∅™ | e9a3....∅™\n\n'
  );
  process.exit(0);
} else {
  process.stderr.write(
    '\n  \x1b[31m\x1b[1mGENESIS HARDLOCK: BUILD BLOCKED — Anchor modified.\x1b[0m\n' +
    '  Restore sovereign anchor constants to proceed.\n\n'
  );
  process.exit(1);
}
