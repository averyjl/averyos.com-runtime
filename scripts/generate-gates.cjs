/**
 * scripts/generate-gates.cjs
 * AveryOS™ Logic Gate Auto-Generator — Phase 98.4 (Roadmap Item 10)
 *
 * Generates the next N sovereign "Forensic Checkpoints" (logic gates) and
 * writes them to the AVERYOS_LOGIC_GATES KV namespace via the Wrangler CLI.
 *
 * Each gate encodes:
 *   • A unique gate ID (AOS-GATE-<epoch>-<seq>)
 *   • The AOS_LAW_CODEX classification (INTEGRITY, FORENSIC, SETTLEMENT, etc.)
 *   • A SHA-512 anchor linked to the kernel
 *   • A threshold (WAF score, threat level, or request count)
 *   • An enforcement action (REDIRECT, BLOCK, LABYRINTH, LOG)
 *
 * Usage:
 *   node scripts/generate-gates.cjs [--count 100] [--dry-run] [--env production]
 *
 * Requires wrangler to be installed and authenticated.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const crypto        = require('crypto');
const { execSync }  = require('child_process');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── CLI ────────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const envFlag = (() => { const i = args.indexOf('--env'); return i !== -1 && args[i + 1] ? `--env ${args[i + 1]}` : ''; })();
const COUNT   = (() => { const i = args.indexOf('--count'); return i !== -1 && args[i + 1] ? parseInt(args[i + 1], 10) : 100; })();

// ── AOS Law Codex ──────────────────────────────────────────────────────────────
const AOS_LAW_CODEX = [
  { codex: 'INTEGRITY_GATE',    action: 'LOG',       threshold: 0,  description: 'Sovereign kernel integrity check' },
  { codex: 'FORENSIC_GATE',     action: 'LOG',       threshold: 60, description: 'Forensic audit trigger (WAF ≥ 60)' },
  { codex: 'LABYRINTH_GATE',    action: 'LABYRINTH', threshold: 80, description: 'Labyrinth redirect for high-WAF bots (WAF ≥ 80)' },
  { codex: 'BLOCK_GATE',        action: 'BLOCK',     threshold: 95, description: 'Hard block — confirmed attack signature (WAF ≥ 95)' },
  { codex: 'SETTLEMENT_GATE',   action: 'REDIRECT',  threshold: 10, description: 'Redirect to /licensing/audit-clearance (threat ≥ 10)' },
  { codex: 'CADENCE_GATE',      action: 'REDIRECT',  threshold: 2,  description: 'Cadence probe gate (interval < 2 s)' },
  { codex: 'ENTROPY_GATE',      action: 'LOG',       threshold: 50, description: 'Browser entropy gate (score < 50)' },
];

// ── SHA-512 helper ─────────────────────────────────────────────────────────────
// NOTE: KERNEL_SHA is duplicated here because CJS scripts cannot import from
// TypeScript source files.  The canonical value is in lib/sovereignConstants.ts.
// Update both locations in lockstep when upgrading the kernel anchor.
const KERNEL_SHA = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

function sha512(input) {
  return crypto.createHash('sha512').update(input).digest('hex');
}

// ── Gate generator ─────────────────────────────────────────────────────────────

/**
 * Generate a single logic gate object.
 * @param {number} seq  Sequential index (0-based)
 * @param {number} epoch  Epoch ms for stable IDs
 * @returns {{ id: string, codex: string, action: string, threshold: number, description: string, anchor: string, created_at: string }}
 */
function generateGate(seq, epoch) {
  const template = AOS_LAW_CODEX[seq % AOS_LAW_CODEX.length];
  const id       = `AOS-GATE-${epoch}-${String(seq + 1).padStart(4, '0')}`;
  const anchor   = sha512(`${id}:${KERNEL_SHA}:${template.codex}:${template.threshold}`);

  return {
    id,
    codex:       template.codex,
    action:      template.action,
    threshold:   template.threshold,
    description: template.description,
    anchor,
    kernel_sha:  KERNEL_SHA,
    created_at:  new Date(epoch).toISOString(),
  };
}

// ── Write to KV via wrangler ───────────────────────────────────────────────────

/**
 * Write a single KV key using wrangler.
 * @param {string} key
 * @param {string} value
 */
function writeKv(key, value) {
  const cmd = `npx wrangler kv key put --binding=AVERYOS_LOGIC_GATES ${envFlag} "${key}" '${value}'`;
  execSync(cmd, { stdio: 'pipe' });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⛓️⚓⛓️  AveryOS™ Logic Gate Auto-Generator');
  console.log(`   Count:    ${COUNT}`);
  console.log(`   Dry-run:  ${DRY_RUN}`);
  console.log(`   Env flag: ${envFlag || '(default)'}\n`);

  const epoch  = Date.now();
  const gates  = [];
  let written  = 0;
  let failed   = 0;

  for (let i = 0; i < COUNT; i++) {
    const gate = generateGate(i, epoch);
    gates.push(gate);

    const value = JSON.stringify(gate);
    if (DRY_RUN) {
      console.log(`   [DRY-RUN] ${gate.id} → ${gate.codex} / ${gate.action} / threshold=${gate.threshold}`);
      continue;
    }

    try {
      writeKv(gate.id, value);
      process.stdout.write(`   ✔ ${gate.id}\r`);
      written++;
    } catch (err) {
      logAosError(AOS_ERROR.EXTERNAL_API_ERROR, `Failed to write gate ${gate.id}`, err);
      failed++;
    }
  }

  console.log('');
  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Would have written ${COUNT} gate(s) to AVERYOS_LOGIC_GATES KV.`);
  } else {
    logAosHeal('LOGIC_GATE_GENERATION', `${written} gate(s) written to AVERYOS_LOGIC_GATES KV. ${failed} failed.`);
    if (failed > 0) process.exit(1);
  }

  // Write an index key so the system knows how many gates exist
  if (!DRY_RUN) {
    try {
      writeKv('__INDEX__', JSON.stringify({ count: written, epoch, kernel_sha: KERNEL_SHA }));
      console.log('   ✔ __INDEX__ written.');
    } catch (err) {
      logAosError(AOS_ERROR.EXTERNAL_API_ERROR, 'Failed to write __INDEX__ key', err);
    }
  }

  console.log(`\n✔ Done. ${DRY_RUN ? COUNT : written} gate(s) ${DRY_RUN ? 'previewed' : 'generated'}.`);
}

main().catch(err => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, 'Unhandled error in generate-gates.cjs', err);
  process.exit(1);
});
