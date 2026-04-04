#!/usr/bin/env node
'use strict';

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
 * AveryOS™ Lighthouse Pulse — scripts/lighthouse.cjs
 *
 * Records a sovereign heartbeat entry on every scheduled run and commits it
 * to the repository, building a continuous, immutable audit trail.
 *
 * Called by .github/workflows/pulse.yml every hour with:
 *   GITHUB_TOKEN – injected by the workflow (built-in Actions token)
 *
 * The git identity and remote credentials are configured by the workflow
 * before this script runs; this script only performs file I/O and git ops.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { sovereignWriteSync, PULSE_LOGS_ROOT } = require('./lib/sovereignIO.cjs');

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://averyos.com';

/** Run a shell command and return its stdout (throws on non-zero exit). */
function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
}

// ── Write heartbeat entry ─────────────────────────────────────────────────────
const ts = new Date().toISOString();
const entry = {
  ts,
  node: 'Node-02',
  status: 'alive',
  site: SITE_URL,
  runtime: 'AveryOS™',
};

const filename = `pulse-${ts.replace(/[:.]/g, '-')}.json`;
sovereignWriteSync(PULSE_LOGS_ROOT, filename, JSON.stringify(entry, null, 2) + '\n');
console.log(`⚓ Sovereign Pulse recorded: ${filename}`);

// ── Commit and push ───────────────────────────────────────────────────────────
try {
  const rel = path.relative(process.cwd(), PULSE_LOGS_ROOT);
  run(`git add "${rel}"`);

  const status = run('git status --porcelain');
  if (!status.trim()) {
    console.log('✅ Nothing new to commit.');
    process.exit(0);
  }

  run(`git commit -m "⚓ lighthouse pulse ${ts}"`);
  run('git push origin main');
  console.log('📤 Pulse pushed to main.');
} catch (err) {
  console.error('⚠️ Commit/push error:', err.message);
  process.exit(1);
}
