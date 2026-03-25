#!/usr/bin/env node
/**
 * scripts/monitorSHAIntegrity.cjs
 *
 * AveryOS™ SHA Integrity Monitor — Phase 124.0 GATE 124.0.1
 *
 * Scans the repository for any SHA-512 strings that are shorter than the
 * canonical 128-character length.  This catches truncated or placeholder
 * hashes that could indicate drift from the Root0 sovereign anchor.
 *
 * Approved shorthands (excluded from alerts):
 *   • "cf83...." / "cf83..." — deliberate display shorthand for the Kernel SHA
 *   • "e9a3...." / "e9a3..." — deliberate display shorthand for Genesis SHA-256
 *
 * Usage:
 *   node scripts/monitorSHAIntegrity.cjs [--dir <path>] [--quiet]
 *
 * Exit codes:
 *   0 — All SHA-512 strings found are full-length (128 chars). Clean.
 *   1 — One or more truncated SHA-512 strings detected. Investigate.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Configuration ─────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "..");

// Directories to skip during scan (build artifacts, dependencies)
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".open-next",
  ".git",
  "dist",
  "build",
  "VaultEcho",
]);

// File extensions to scan
const SCAN_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".cjs", ".mjs",
  ".json", ".yaml", ".yml", ".md", ".txt",
]);

// Approved shorthand prefixes that intentionally truncate the hash
const APPROVED_SHORTHANDS = [
  /^cf83\.{3,}/, // "cf83...." — kernel SHA shorthand
  /^e9a3\.{3,}/, // "e9a3...." — genesis SHA shorthand
  /^cf83\u2026/,  // "cf83…"  — unicode ellipsis shorthand
  /^e9a3\u2026/,
];

// ── CLI args ──────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const quiet  = args.includes("--quiet");
const dirArg = (() => {
  const idx = args.indexOf("--dir");
  return idx !== -1 && args[idx + 1] ? path.resolve(args[idx + 1]) : REPO_ROOT;
})();

// ── ANSI colours ──────────────────────────────────────────────────────────────
const R  = "\x1b[0m";
const G  = "\x1b[32m";
const RE = "\x1b[31m";
const Y  = "\x1b[33m";
const B  = "\x1b[1m";
const DIM = "\x1b[2m";

// ── SHA-512 detection regex ───────────────────────────────────────────────────
// Matches hex strings of 10–127 chars (possible truncated SHA-512).
// Full 128-char SHA-512s are not flagged — only shorter candidates.
const SHA512_CANDIDATE = /\b([0-9a-f]{10,127})\b/gi;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Return true if `candidate` is an approved display shorthand.
 */
function isApprovedShorthand(candidate) {
  return APPROVED_SHORTHANDS.some((re) => re.test(candidate));
}

/**
 * Recursively collect all scannable files under `dir`.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  if (!quiet) {
    console.log(`\n${B}⛓️⚓⛓️  AveryOS™ SHA Integrity Monitor${R}`);
    console.log(`  Phase 124.0 GATE 124.0.1\n`);
    console.log(`  ${DIM}Scanning: ${dirArg}${R}\n`);
  }

  const files   = collectFiles(dirArg);
  const alerts  = [];

  for (const filePath of files) {
    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const relPath = path.relative(REPO_ROOT, filePath);
    let match;
    SHA512_CANDIDATE.lastIndex = 0;

    while ((match = SHA512_CANDIDATE.exec(content)) !== null) {
      const candidate = match[1];
      if (isApprovedShorthand(candidate)) continue;
      // Candidate is a hex string shorter than 128 chars — flag it.
      const lineNum = content.slice(0, match.index).split("\n").length;
      alerts.push({ file: relPath, line: lineNum, value: candidate });
    }
  }

  if (!quiet) {
    console.log(`  Files scanned : ${files.length}`);
    console.log(`  Alerts found  : ${alerts.length}\n`);
  }

  if (alerts.length === 0) {
    if (!quiet) {
      console.log(`  ${G}${B}SHA INTEGRITY: CLEAN — No truncated SHA-512 strings detected.${R}\n`);
    }
    process.exit(0);
  }

  // Print alerts
  console.error(`  ${RE}${B}SHA INTEGRITY ALERT — ${alerts.length} truncated SHA-512 candidate(s) found:${R}\n`);
  for (const a of alerts.slice(0, 50)) {
    console.error(`  ${Y}→${R} ${a.file}:${a.line}  ${DIM}${a.value.slice(0, 24)}…${R}`);
  }
  if (alerts.length > 50) {
    console.error(`  ${DIM}… and ${alerts.length - 50} more${R}`);
  }
  console.error(`\n  ${Y}Action: Replace all truncated hashes with full 128-character SHA-512 values.${R}\n`);
  process.exit(1);
}

main();
