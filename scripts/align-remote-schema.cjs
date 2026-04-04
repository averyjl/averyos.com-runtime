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
 * scripts/align-remote-schema.cjs
 *
 * AveryOS™ D1 Schema Alignment — GATE 114.6.5 / GATE 114.8.5
 *
 * Safely aligns the remote Cloudflare D1 database (`averyos_kernel_db`) with
 * the local migration history.  Specifically recovers from the
 * "no such column: sha512" error that occurs when the remote table is ahead of
 * (or behind) the local migration tracking:
 *
 *   Migration 0032_sha_refactor.sql attempted:
 *     1. Promote sha512 → sha512_payload where sha512_payload = 'PENDING_SHA'
 *     2. DROP COLUMN sha512
 *     3. ADD COLUMN request_method TEXT DEFAULT 'GET'
 *
 * This script introspects the live table schema (PRAGMA table_info) and executes
 * only the steps that haven't been applied yet, making it safe to re-run.
 *
 * Usage:
 *   node scripts/align-remote-schema.cjs [--dry-run] [--db <name>]
 *
 * Options:
 *   --dry-run   Print SQL that would execute without running it
 *   --db        D1 database name (default: averyos_kernel_db)
 *   --local     Target local D1 dev DB instead of --remote
 *
 * Prerequisites:
 *   npx wrangler must be available (installed via npm ci).
 *   CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in the
 *   environment (or in a .env file) for --remote execution.
 *
 * Exit codes:
 *   0 — All steps applied (or already aligned — no drift detected)
 *   1 — Alignment failed
 *   2 — Usage error
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path   = require('path');
const fs     = require('fs');

const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Sovereign kernel anchor ────────────────────────────────────────────────────
const KERNEL_SHA     = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';

// ── ANSI colours ───────────────────────────────────────────────────────────────
const R    = '\x1b[0m';
const RED  = '\x1b[31m';
const GRN  = '\x1b[32m';
const YEL  = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

// ── CLI arg parsing ────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LOCAL   = args.includes('--local');
const dbIdx   = args.indexOf('--db');
const DB_NAME = dbIdx !== -1 ? (args[dbIdx + 1] ?? 'averyos_kernel_db') : 'averyos_kernel_db';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Execute a wrangler D1 SQL command and return trimmed stdout.
 * Throws on non-zero exit code.
 */
function runD1(sql, label) {
  const remoteFlag = LOCAL ? [] : ['--remote'];

  if (DRY_RUN) {
    console.log(`${CYAN}[DRY-RUN]${R} ${label}`);
    console.log(`  SQL: ${YEL}${sql}${R}`);
    return '[]';
  }

  console.log(`${BOLD}▶ ${label}${R}`);
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, ...remoteFlag, '--command', sql],
    {
      encoding: 'utf8',
      stdio:    ['ignore', 'pipe', 'pipe'],
      env:      { ...process.env },
      cwd:      path.resolve(__dirname, '..'),
    }
  );

  if (result.status !== 0) {
    const errText = (result.stderr ?? '') + (result.stdout ?? '');
    throw new Error(`wrangler command failed (${label}): ${errText}`);
  }
  return result.stdout ?? '';
}

/**
 * Fetch PRAGMA table_info for a table and return column names as a Set.
 */
function getColumns(tableName) {
  const raw = runD1(
    `PRAGMA table_info(${tableName});`,
    `Inspect ${tableName} columns`
  );

  if (DRY_RUN) return new Set();

  const cols = new Set();
  // wrangler outputs JSON-like lines; parse every line that looks like JSON
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      const rows   = Array.isArray(parsed) ? parsed : (parsed.results ?? []);
      for (const row of rows) {
        if (row && row.name) cols.add(row.name);
      }
    } catch {
      // not valid JSON — skip line
    }
  }
  return cols;
}

// ── Main alignment sequence ────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}⛓️⚓⛓️  AveryOS™ Schema Alignment — GATE 114.6.5${R}`);
  console.log(`${CYAN}  Kernel: ${KERNEL_VERSION} · ${KERNEL_SHA.slice(0, 16)}…${R}`);
  console.log(`  Target: ${BOLD}${DB_NAME}${R}${LOCAL ? ' (local)' : ' (remote)'}`);
  if (DRY_RUN) console.log(`  Mode:   ${YEL}DRY RUN — no changes will be made${R}`);
  console.log('');

  try {
    // ── Step 1: Introspect anchor_audit_logs columns ────────────────────────
    const cols = getColumns('anchor_audit_logs');
    console.log(`${GRN}✔${R} Detected columns: ${Array.from(cols).join(', ') || '(dry-run — unknown)'}`);

    // ── Step 2: Promote sha512 → sha512_payload if both columns exist ───────
    const hasSha512        = DRY_RUN || cols.has('sha512');
    const hasSha512Payload = DRY_RUN || cols.has('sha512_payload');

    if (hasSha512 && hasSha512Payload) {
      console.log('\n→ Step 2: Promoting legacy sha512 values into sha512_payload for sentinel rows…');
      runD1(
        "UPDATE anchor_audit_logs SET sha512_payload = sha512 WHERE sha512_payload = 'PENDING_SHA';",
        'Promote sha512 → sha512_payload'
      );
      logAosHeal('align-remote-schema', 'sha512 promotion completed', 'Step 2 GATE 114.6.5');
      console.log(`${GRN}✔${R} Promotion complete.`);
    } else if (!hasSha512) {
      console.log(`${YEL}⚠${R}  sha512 column not present — promotion already applied or not needed.`);
    } else {
      console.log(`${YEL}⚠${R}  sha512_payload column missing — migration 0031 may not have been applied.`);
    }

    // ── Step 3: Drop sha512 column if it still exists ───────────────────────
    if (hasSha512) {
      console.log('\n→ Step 3: Dropping legacy sha512 column…');
      runD1(
        'ALTER TABLE anchor_audit_logs DROP COLUMN sha512;',
        'DROP COLUMN sha512'
      );
      logAosHeal('align-remote-schema', 'sha512 column dropped', 'Step 3 GATE 114.6.5');
      console.log(`${GRN}✔${R} sha512 column dropped.`);
    } else {
      console.log(`${GRN}✔${R} sha512 column already absent — step 3 skipped (no drift).`);
    }

    // ── Step 4: Add request_method if missing ────────────────────────────────
    const hasRequestMethod = DRY_RUN || cols.has('request_method');
    if (!hasRequestMethod) {
      console.log('\n→ Step 4: Adding request_method column…');
      runD1(
        "ALTER TABLE anchor_audit_logs ADD COLUMN request_method TEXT DEFAULT 'GET';",
        'ADD COLUMN request_method'
      );
      logAosHeal('align-remote-schema', 'request_method column added', 'Step 4 GATE 114.6.5');
      console.log(`${GRN}✔${R} request_method column added.`);
    } else {
      console.log(`${GRN}✔${R} request_method already present — step 4 skipped (no drift).`);
    }

    // ── Step 5: Verify final column set ──────────────────────────────────────
    if (!DRY_RUN) {
      const finalCols = getColumns('anchor_audit_logs');
      const ok = !finalCols.has('sha512') && finalCols.has('sha512_payload') && finalCols.has('request_method');
      if (ok) {
        console.log(`\n${GRN}${BOLD}✅  Schema alignment complete — anchor_audit_logs is aligned.${R}`);
      } else {
        const missing = [];
        if (finalCols.has('sha512'))          missing.push('sha512 still present');
        if (!finalCols.has('sha512_payload')) missing.push('sha512_payload missing');
        if (!finalCols.has('request_method')) missing.push('request_method missing');
        throw new Error(`Schema verification failed: ${missing.join(', ')}`);
      }
    } else {
      console.log(`\n${YEL}[DRY-RUN]${R} Alignment plan printed — run without --dry-run to apply.`);
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    console.log(`\n⛓️⚓⛓️  Kernel: ${KERNEL_SHA.slice(0, 32)}…`);
    console.log(`🤛🏻 Jason Lee Avery · ROOT0 · GATE 114.6.5\n`);
    process.exit(0);

  } catch (err) {
    logAosError(AOS_ERROR.DB_QUERY_FAILED, err.message ?? String(err), err);
    console.error(`\n${RED}${BOLD}✗ Schema alignment failed.${R}`);
    console.error(`  ${RED}${err.message}${R}`);
    console.error(`\n  RCA: Verify CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are set.`);
    console.error(`  Hint: Run with --dry-run first to preview operations.\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(RED + 'Unexpected error: ' + R, err);
  process.exit(1);
});
