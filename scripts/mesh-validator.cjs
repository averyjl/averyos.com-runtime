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
 * scripts/mesh-validator.cjs
 * AveryOS™ Cross-Domain Mesh & Temporal Anchor Validator v1.0
 *
 * Validates the sovereign DNS mesh between averyos.com (primary) and
 * nobis.biz (legacy temporal anchor, est. ~2000) to confirm that both
 * domains carry the cf83... Kernel Root and that the ALM routing SRV
 * record points to Node-02.
 *
 * Usage:
 *   node scripts/mesh-validator.cjs
 *
 * Exit codes:
 *   0 — Mesh integrity 100% — all checks pass
 *   1 — Mesh fracture detected — one or more checks failed
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const dns = require('dns').promises;
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ---------------------------------------------------------------------------
// Sovereign constants
// ---------------------------------------------------------------------------

// Canonical kernel SHA-512 anchor — matches KERNEL_SHA in lib/sovereignConstants.ts.
// CJS scripts cannot import TypeScript modules directly; using the env-override
// pattern (process.env.KERNEL_SHA ?? '...') mirrors the approach used by
// sovereign-takedown.cjs and other scripts in this directory.
const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

const DOMAINS = {
  primary: 'averyos.com',
  legacy:  'nobis.biz',
};

// ---------------------------------------------------------------------------
// Mesh validation
// ---------------------------------------------------------------------------

/**
 * Resolve TXT records for a domain and return the flattened string array.
 * @param {string} domain
 * @returns {Promise<string[]>}
 */
async function resolveTxtRecords(domain) {
  const records = await dns.resolveTxt(domain);
  return records.map(rec => rec.join(''));
}

/**
 * Main validation pulse — checks:
 *  1. Primary kernel anchor in averyos.com TXT
 *  2. Temporal anchor role in nobis.biz TXT
 *  3. Kernel parity (nobis.biz also carries cf83...)
 *  4. SRV routing redirection to Node-02
 *
 * @returns {Promise<void>}
 */
async function validateMesh() {
  console.log('');
  console.log('⛓️⚓⛓️  AveryOS™ Cross-Domain Mesh & Temporal Anchor Validator v1.0');
  console.log('--- AveryOS Mesh Validation Pulse ---');
  console.log(`  Primary : ${DOMAINS.primary}`);
  console.log(`  Legacy  : ${DOMAINS.legacy}`);
  console.log(`  Kernel  : ${KERNEL_SHA.slice(0, 16)}...`);
  console.log('');

  let hasPrimaryKernel  = false;
  let hasLegacyAnchor   = false;
  let matchesKernel     = false;
  let pointsToNode02    = false;

  // 1. Verify Primary Root
  try {
    const primaryTxt = await resolveTxtRecords(DOMAINS.primary);
    hasPrimaryKernel = primaryTxt.some(rec => rec.includes(KERNEL_SHA));
    console.log(
      `[PRIMARY] ${DOMAINS.primary}: ` +
      (hasPrimaryKernel ? '✅ ANCHORED' : '❌ DRIFT DETECTED')
    );
    if (hasPrimaryKernel) {
      logAosHeal('MESH_VALIDATOR', `Primary kernel anchor verified for ${DOMAINS.primary}`);
    }
  } catch (err) {
    logAosError(AOS_ERROR.EXTERNAL_SERVICE, `DNS TXT lookup failed for ${DOMAINS.primary}: ${err.message}`, err);
    console.log(`[PRIMARY] ${DOMAINS.primary}: ❌ DNS ERROR — ${err.message}`);
  }

  // 2. Verify Legacy Temporal Anchor
  try {
    const legacyTxt = await resolveTxtRecords(DOMAINS.legacy);
    hasLegacyAnchor = legacyTxt.some(rec => rec.includes('role=temporal-anchor'));
    matchesKernel   = legacyTxt.some(rec => rec.includes(KERNEL_SHA));
    console.log(
      `[LEGACY] ${DOMAINS.legacy}: ` +
      (hasLegacyAnchor ? '✅ TEMPORAL LOCK ACTIVE' : '❌ ANCHOR MISSING')
    );
    console.log(
      `[PARITY] Kernel Sync: ` +
      (matchesKernel ? '✅ 100% ALIGNED' : '❌ SIGNATURE MISMATCH')
    );
    if (hasLegacyAnchor) {
      logAosHeal('MESH_VALIDATOR', `Temporal anchor verified for ${DOMAINS.legacy}`);
    }
  } catch (err) {
    logAosError(AOS_ERROR.EXTERNAL_SERVICE, `DNS TXT lookup failed for ${DOMAINS.legacy}: ${err.message}`, err);
    console.log(`[LEGACY] ${DOMAINS.legacy}: ❌ DNS ERROR — ${err.message}`);
    console.log('[PARITY] Kernel Sync: ❌ DNS ERROR');
  }

  // 3. SRV Handshake Check
  try {
    const srv = await dns.resolveSrv(`_averyos_alm.${DOMAINS.legacy}`);
    pointsToNode02 = srv.some(rec => rec.name === 'node-02.averyos.com');
    console.log(
      `[ROUTING] Pulse Redirection: ` +
      (pointsToNode02 ? '✅ NODE-02 RESIDENCY VERIFIED' : '❌ ROUTING DRIFT')
    );
    if (pointsToNode02) {
      logAosHeal('MESH_VALIDATOR', 'SRV routing to Node-02 verified');
    }
  } catch (err) {
    logAosError(AOS_ERROR.EXTERNAL_SERVICE, `SRV lookup failed for _averyos_alm.${DOMAINS.legacy}: ${err.message}`, err);
    console.log(`[ROUTING] Pulse Redirection: ❌ DNS ERROR — ${err.message}`);
  }

  // ── Final status ──────────────────────────────────────────────────────────
  console.log('');
  if (hasPrimaryKernel && hasLegacyAnchor && matchesKernel && pointsToNode02) {
    console.log('--- STATUS: MESH INTEGRITY 100% ---');
    console.log('Sovereign Gravity Well is holding.');
    console.log('⛓️⚓⛓️  Mesh validation complete — all checks passed. 🤛🏻');
    console.log('');
  } else {
    console.log('⚠️  SYSTEM CRITICAL: Mesh Fracture Detected. Re-run DNS re-anchoring.');
    console.log('    Refer to nobis.biz DNS BIND records for correct TXT/SRV setup.');
    console.log('');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

validateMesh().catch(err => {
  const msg = err instanceof Error ? err.message : String(err);
  logAosError(AOS_ERROR.INTERNAL_ERROR, `Mesh validator failed: ${msg}`, err);
  process.exit(1);
});
