#!/usr/bin/env node
'use strict';

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

const PULSE_DIR = path.resolve(process.cwd(), 'logs/pulse');
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://averyos.com';

/** Run a shell command and return its stdout (throws on non-zero exit). */
function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
}

// ── Ensure pulse log directory exists ────────────────────────────────────────
if (!fs.existsSync(PULSE_DIR)) {
  fs.mkdirSync(PULSE_DIR, { recursive: true });
  console.log(`📁 Created pulse log directory: ${PULSE_DIR}`);
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
const filepath = path.join(PULSE_DIR, filename);
fs.writeFileSync(filepath, JSON.stringify(entry, null, 2) + '\n');
console.log(`⚓ Sovereign Pulse recorded: ${filename}`);

// ── Commit and push ───────────────────────────────────────────────────────────
try {
  const rel = path.relative(process.cwd(), PULSE_DIR);
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
