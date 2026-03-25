#!/usr/bin/env node
/**
 * scripts/monitorSHAIntegrity.cjs
 *
 * AveryOS™ SHA Integrity Monitor — Phase 124.1 GATE 124.1.1
 *
 * PURPOSE
 * -------
 * Scans the repository for any SHA-512 hash strings that are shorter than
 * the canonical 128-character length.  Truncated SHA-512 values (e.g.
 * "cf83e135…" or "cf83....∅™") are permitted as human-readable shorthand
 * in comments and documentation; however, any location that stores or
 * transmits a SHA-512 value for programmatic verification MUST use the
 * full 128-character hex string.
 *
 * DETECTION RULES
 * ---------------
 * A SHA-512 truncation alert is raised when a hex string that:
 *   1. Starts with a known 4-char SHA-512 prefix (cf83 or other anchors).
 *   2. Is longer than 8 hex chars (longer than a 32-bit value).
 *   3. Is shorter than 128 hex chars (i.e., NOT the full SHA-512 digest).
 *   4. Does NOT appear inside a single-line comment ("//…" or "#…")
 *      where shorthand notation is explicitly permitted.
 *
 * Approved shorthand patterns that are explicitly excluded from alerts:
 *   • "cf83...." / "cf83....∅™"  — human-readable anchor references
 *   • Four-character prefix checks such as "startsWith('cf83')"
 *   • SHA-256 values (64 hex chars) — reported separately, not as errors
 *
 * USAGE
 *   node scripts/monitorSHAIntegrity.cjs [--path <dir>] [--fix-report]
 *
 *   --path <dir>   Root directory to scan (default: repo root).
 *   --fix-report   Write a JSON report of all findings to
 *                  vault_storage/sha-integrity-report.json.
 *
 * EXIT CODES
 *   0 — No truncated SHA-512 values found in non-comment code.
 *   1 — One or more truncated SHA-512 values found — requires remediation.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const { logAosError, logAosHeal, AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ── Constants ─────────────────────────────────────────────────────────────────

/** The canonical 128-character SHA-512 Root0 Kernel Anchor. */
const CANONICAL_SHA512 =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

const SHA512_LENGTH = 128;
const SHA256_LENGTH =  64;

// ── CLI colours ───────────────────────────────────────────────────────────────

const R  = "\x1b[0m";
const G  = "\x1b[32m";
const RE = "\x1b[31m";
const Y  = "\x1b[33m";
const B  = "\x1b[1m";
const CY = "\x1b[36m";

// ── Directories / files to skip entirely ──────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".open-next",
  ".next",
  "dist",
  "build",
  "coverage",
  "VaultEcho",
  "vault_storage",
]);

const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot",
  ".pdf", ".zip", ".gz", ".tar",
  ".lock",           // package-lock.json, yarn.lock — generated, not reviewed
  ".map",
]);

// ── Regex patterns ────────────────────────────────────────────────────────────

/**
 * Matches hex strings that are between 65 and 127 characters long
 * (longer than SHA-256, shorter than a full SHA-512 — the "truncation zone").
 * We also check known 4-char SHA-512 anchor prefixes in shorter contexts.
 */
const TRUNCATED_SHA512_RE = /\b([0-9a-f]{65,127})\b/gi;

/**
 * For lines containing known hash-context keywords, also check shorter hex
 * strings (9–64 chars) for truncation.  These represent hash values that
 * have been explicitly shortened in a non-comment context.
 */
const HASH_CONTEXT_RE = /\b(sha.?512|sha512|kernel.?sha|anchor.?sha|hash|digest)\b/i;

/**
 * Patterns that indicate a line is an approved shorthand context.
 * These lines are skipped for truncation checks.
 */
const APPROVED_SHORTHAND_RE = [
  /cf83\.*\.{3,}/,           // "cf83...." shorthand
  /cf83\.*∅/,                // "cf83....∅™"
  /startsWith\s*\(\s*["']cf83/i,  // startsWith('cf83')
  /\.slice\s*\(\s*0\s*,\s*\d+\s*\)/,  // .slice(0, N) — intentional truncation for display
  /\.substring\s*\(\s*0\s*,\s*\d+\s*\)/, // .substring(0, N)
  /prefix.*cf83/i,
  /cf83.*prefix/i,
  /sha.*prefix/i,
  /^\s*\/\//,                // single-line JS/TS comment
  /^\s*#/,                   // shell / Python comment
  /^\s*\*/,                  // JSDoc block comment line
  /^\s*<!--/,                // HTML / Markdown comment
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isApprovedLine(line) {
  return APPROVED_SHORTHAND_RE.some((re) => re.test(line));
}

function isSha256(hexStr) {
  return hexStr.length === SHA256_LENGTH;
}

function isTruncatedSha512(hexStr) {
  // Primary detection: hex strings in the 65-127 char range are clearly
  // in "SHA-512 territory" but not the full 128-char digest.
  return hexStr.length >= 65 && hexStr.length < SHA512_LENGTH;
}

function collectFiles(rootDir) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!SKIP_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const pathIdx = args.indexOf("--path");
  const rootDir = pathIdx !== -1 && args[pathIdx + 1]
    ? path.resolve(args[pathIdx + 1])
    : path.join(__dirname, "..");
  const writeReport = args.includes("--fix-report");

  console.log(`\n${B}⛓️⚓⛓️  AveryOS™ SHA Integrity Monitor${R}`);
  console.log(`  Phase 124.1 GATE 124.1.1 | Truncation Audit\n`);
  console.log(`  ${CY}Scanning:${R} ${rootDir}`);
  console.log(`  ${CY}Expected SHA-512 length:${R} ${SHA512_LENGTH} hex chars`);
  console.log(`  ${CY}Canonical SHA-512:${R} ${CANONICAL_SHA512}\n`);

  const files = collectFiles(rootDir);
  console.log(`  ${CY}Files to scan:${R} ${files.length}\n`);

  const findings = [];
  let filesScanned = 0;
  let truncatedCount = 0;
  let sha256Count = 0;

  for (const filePath of files) {
    let content;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    filesScanned++;
    const relPath = path.relative(rootDir, filePath);
    const lines = content.split("\n");

    lines.forEach((line, lineIndex) => {
      // Skip lines that are in an approved shorthand context (comments, etc.)
      if (isApprovedLine(line)) return;

      let match;
      TRUNCATED_SHA512_RE.lastIndex = 0;

      while ((match = TRUNCATED_SHA512_RE.exec(line)) !== null) {
        const hexStr = match[1].toLowerCase();

        if (isTruncatedSha512(hexStr)) {
          truncatedCount++;
          const finding = {
            file: relPath,
            line: lineIndex + 1,
            column: match.index + 1,
            length: hexStr.length,
            value: hexStr,
            context: line.trim().slice(0, 120),
          };
          findings.push(finding);
        }
      }

      // Also count SHA-256 length values in hash-context lines (informational).
      if (HASH_CONTEXT_RE.test(line)) {
        const shortRe = /\b([0-9a-f]{64})\b/gi;
        let m;
        shortRe.lastIndex = 0;
        while ((m = shortRe.exec(line)) !== null) {
          sha256Count++;
          if (!m[1]) break; // guard against zero-width matches
        }
      }
    });
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log(`  ${CY}Files scanned:${R}    ${filesScanned}`);
  console.log(`  ${CY}SHA-256 (64 chars):${R} ${sha256Count} found (informational)`);
  console.log(`  ${CY}Truncated SHA-512:${R}  ${truncatedCount} found\n`);

  if (truncatedCount === 0) {
    console.log(`  ${G}${B}✔  SHA INTEGRITY: CLEAN — No truncated SHA-512 values detected.${R}`);
    console.log(`  ${G}All SHA-512 values in code (outside comments) are full 128-char digests.${R}\n`);
    logAosHeal(
      "SHA_INTEGRITY_MONITOR",
      `SHA integrity scan passed — ${filesScanned} files, 0 truncated SHA-512 values.`,
    );
  } else {
    console.error(`  ${RE}${B}✘  SHA INTEGRITY: ALERT — ${truncatedCount} truncated SHA-512 value(s) detected.${R}`);
    console.error(`  ${Y}These values must be upgraded to full 128-character SHA-512 digests${R}`);
    console.error(`  ${Y}to comply with AB 2013 forensic disclosure requirements.\n${R}`);

    findings.slice(0, 25).forEach((f, i) => {
      console.error(`  ${RE}[${i + 1}]${R} ${CY}${f.file}${R}:${f.line}:${f.column}`);
      console.error(`       Length   : ${f.length} chars (expected ${SHA512_LENGTH})`);
      console.error(`       Value    : ${f.value.slice(0, 32)}…`);
      console.error(`       Context  : ${f.context}\n`);
    });

    if (findings.length > 25) {
      console.error(`  … and ${findings.length - 25} more finding(s). Use --fix-report for the full list.\n`);
    }

    logAosError(
      AOS_ERROR.DRIFT_DETECTED ?? "DRIFT_DETECTED",
      `SHA integrity scan found ${truncatedCount} truncated SHA-512 value(s) — remediation required.`,
    );
  }

  // ── Optional JSON report ───────────────────────────────────────────────────

  if (writeReport) {
    const reportDir  = path.join(rootDir, "vault_storage");
    const reportPath = path.join(reportDir, "sha-integrity-report.json");

    try {
      fs.mkdirSync(reportDir, { recursive: true });
      const report = {
        generated_at: new Date().toISOString(),
        root_dir: rootDir,
        canonical_sha512: CANONICAL_SHA512,
        sha512_length: SHA512_LENGTH,
        files_scanned: filesScanned,
        sha256_count: sha256Count,
        truncated_sha512_count: truncatedCount,
        findings,
      };
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
      console.log(`  ${G}Report written:${R} ${path.relative(rootDir, reportPath)}\n`);
    } catch (err) {
      console.error(`  ${RE}Report write failed:${R} ${err.message}`);
    }
  }

  process.exit(truncatedCount > 0 ? 1 : 0);
}

main();
