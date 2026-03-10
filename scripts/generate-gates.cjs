/**
 * generate-gates.cjs
 *
 * 100-Gate Automation Script — AveryOS™ Phase 98.4
 *
 * Generates the next 100 Forensic Checkpoints across the sovereign ecosystem.
 * Uses the AOS_LAW_CODEX to define gate identifiers, threshold rules, and
 * enforcement actions for WAF/KaaS/TARI™ integration.
 *
 * Output: JSON gate manifest written to public/manifest/gates/kaas_gates_v1.json
 *
 * Usage:
 *   node scripts/generate-gates.cjs
 *   node scripts/generate-gates.cjs --output ./custom/output/path
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { logAosError, logAosHeal } = require('./sovereignErrorLogger.cjs');

// ── AOS_LAW_CODEX — Gate Definitions ─────────────────────────────────────────
// Base rules governing all 100 forensic checkpoints.
const AOS_LAW_CODEX = {
  version:    '1.0',
  kernel_sha: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  kernel_version: 'v3.6.2',
  created_at: new Date().toISOString(),
  license: 'AveryOS™ Sovereign Integrity License v1.0',
  creator: 'Jason Lee Avery (ROOT0)',
};

// ── Gate Category Definitions ─────────────────────────────────────────────────
const GATE_CATEGORIES = [
  { id: 'WAF',      prefix: 'WAF',    name: 'WAF Score Gate',               count: 20 },
  { id: 'KAAS',     prefix: 'KAAS',   name: 'KaaS Tier Enforcement Gate',   count: 20 },
  { id: 'TARI',     prefix: 'TARI',   name: 'TARI™ Liability Gate',         count: 15 },
  { id: 'DER',      prefix: 'DER',    name: 'DER Entity Recognition Gate',  count: 15 },
  { id: 'CADENCE',  prefix: 'CAD',    name: 'Cadence Probe Gate',           count: 10 },
  { id: 'BIOMETRIC',prefix: 'BIO',    name: 'Biometric Identity Gate',      count: 10 },
  { id: 'VAULT',    prefix: 'VLT',    name: 'VaultChain™ Capsule Gate',     count: 10 },
];

// ── Enforcement Actions ───────────────────────────────────────────────────────
const ENFORCEMENT_ACTIONS = ['REDIRECT_AUDIT', 'KAAS_BREACH', 'LOG_D1', 'FCM_PUSH', 'INVOICE_STRIPE'];

// ── Threshold Rules ───────────────────────────────────────────────────────────
const WAF_THRESHOLDS = [60, 70, 80, 90, 95, 97, 99];
const KAAS_TIERS    = [1, 7, 8, 9, 10];

/**
 * Generate a single gate definition.
 */
function buildGate(category, index, globalIndex) {
  const gateId = `${category.prefix}-GATE-${String(index + 1).padStart(3, '0')}`;
  const tier   = KAAS_TIERS[globalIndex % KAAS_TIERS.length];
  const threshold = WAF_THRESHOLDS[globalIndex % WAF_THRESHOLDS.length];
  const action = ENFORCEMENT_ACTIONS[globalIndex % ENFORCEMENT_ACTIONS.length];

  return {
    gate_id:     gateId,
    phase:       `Phase 98.4 — Gate ${globalIndex + 1}`,
    category:    category.id,
    name:        `${category.name} #${index + 1}`,
    threshold,
    kaas_tier:   tier,
    enforcement: action,
    description: `${category.name}: WAF score ≥ ${threshold} OR ASN Tier-${tier}+ → ${action}. ` +
                 `Forensic receipt logged to D1 sovereign_audit_logs and kaas_valuations. ` +
                 `Kernel: ${AOS_LAW_CODEX.kernel_version}`,
    kernel_sha:  AOS_LAW_CODEX.kernel_sha.slice(0, 16) + '…',
    created_at:  new Date().toISOString(),
  };
}

/**
 * Generate the full 100-gate manifest.
 */
function generateGates() {
  const gates = [];
  let globalIndex = 0;

  for (const category of GATE_CATEGORIES) {
    for (let i = 0; i < category.count; i++) {
      gates.push(buildGate(category, i, globalIndex));
      globalIndex++;
      if (globalIndex >= 100) break;
    }
    if (globalIndex >= 100) break;
  }

  return {
    manifest_version: '1.0',
    codex: AOS_LAW_CODEX,
    gate_count: gates.length,
    gates,
    generated_at: new Date().toISOString(),
    integrity_note:
      'This manifest is part of the AveryOS™ KaaS sovereignty automation. ' +
      'Each gate represents a forensic checkpoint anchored to the cf83™ Kernel Root. ' +
      '⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0) 🤛🏻',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const args       = process.argv.slice(2);
  const outputFlag = args.indexOf('--output');
  const outputDir  = outputFlag >= 0 && args[outputFlag + 1]
    ? path.resolve(args[outputFlag + 1])
    : path.resolve(__dirname, '..', 'public', 'manifest', 'gates');

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    logAosError('GATE_GEN_MKDIR', `Failed to create output dir ${outputDir}: ${err.message}`);
    process.exit(1);
  }

  const manifest     = generateGates();
  const outputPath   = path.join(outputDir, 'kaas_gates_v1.json');

  try {
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    logAosHeal('GATE_GEN_COMPLETE', `Generated ${manifest.gate_count} gates → ${outputPath}`);
    console.log(`✅ Generated ${manifest.gate_count} KaaS gates → ${outputPath}`);
  } catch (err) {
    logAosError('GATE_GEN_WRITE', `Failed to write gate manifest: ${err.message}`);
    process.exit(1);
  }
}

main();
