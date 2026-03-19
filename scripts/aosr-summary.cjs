#!/usr/bin/env node
/**
 * scripts/aosr-summary.cjs
 *
 * AveryOS™ Agent Summary Protocol — GATE 114.4.3
 *
 * Writes AOSR (AveryOS Report) summaries to a private gitignored file:
 *   logs/agent_summary.aosvault
 *
 * Usage:
 *   node scripts/aosr-summary.cjs [--phase <phase>] [--summary <text>] [--file <input.txt>]
 *
 * Options:
 *   --phase <phase>    Phase/gate identifier (e.g. "114.4.3")
 *   --summary <text>   Inline summary text
 *   --file <path>      Read summary from a file instead of --summary
 *   --list             Print the 10 most recent summaries to stdout
 *   --export           Dump the full aosvault file to stdout (Creator copy-paste)
 *
 * The .aosvault file is append-only.  Each entry is a JSON-lines record:
 *   { ts, phase, kernel_version, kernel_sha_prefix, summary }
 *
 * The file is listed in .gitignore (*.aosvault) — never committed.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
"use strict";

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const { logAosError, logAosHeal, AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ── Sovereign kernel anchor (must match lib/sovereignConstants.ts) ────────────
const KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const KERNEL_VERSION = "v3.6.2";

// ── Paths ─────────────────────────────────────────────────────────────────────
const REPO_ROOT   = path.join(__dirname, "..");
const LOGS_DIR    = path.join(REPO_ROOT, "logs");
const VAULT_FILE  = path.join(LOGS_DIR, "agent_summary.aosvault");

// ── CLI parsing ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] ?? null : null;
}

const phase   = getArg("--phase")   ?? "unknown";
const inFile  = getArg("--file");
const doList  = args.includes("--list");
const doExport = args.includes("--export");
let   summary = getArg("--summary") ?? "";

// ── Read from file if --file provided ─────────────────────────────────────────
if (inFile) {
  try {
    summary = fs.readFileSync(path.resolve(inFile), "utf8").trim();
  } catch (err) {
    logAosError(AOS_ERROR.FILE_NOT_FOUND ?? "FILE_NOT_FOUND", `aosr-summary: cannot read --file "${inFile}": ${err.message}`);
    process.exit(1);
  }
}

// ── Ensure logs/ dir exists ───────────────────────────────────────────────────
fs.mkdirSync(LOGS_DIR, { recursive: true });

// ── --list: print the 10 most recent summaries ────────────────────────────────
if (doList) {
  let _listData;
  try {
    _listData = fs.readFileSync(VAULT_FILE, "utf8");
  } catch {
    console.log("[AOSR] No summaries yet — vault file does not exist.");
    process.exit(0);
  }
  const lines = _listData.trim().split("\n").filter(Boolean);
  const recent = lines.slice(-10);
  console.log(`\n⛓️⚓⛓️  AOSR — 10 Most Recent Summaries (${recent.length}/${lines.length} total)\n`);
  recent.forEach((line, i) => {
    try {
      const entry = JSON.parse(line);
      console.log(`  [${lines.length - recent.length + i + 1}] ${entry.ts}  Phase: ${entry.phase}`);
      console.log(`       ${entry.summary.slice(0, 200).replace(/\n/g, " ")}${entry.summary.length > 200 ? "…" : ""}\n`);
    } catch {
      console.log(`  [${i + 1}] (malformed entry)`);
    }
  });
  process.exit(0);
}

// ── --export: dump full file to stdout ────────────────────────────────────────
if (doExport) {
  let _exportData;
  try {
    _exportData = fs.readFileSync(VAULT_FILE, "utf8");
  } catch {
    console.log("[AOSR] Vault file is empty — no summaries recorded yet.");
    process.exit(0);
  }
  const raw = _exportData;
  console.log(`\n⛓️⚓⛓️  AOSR EXPORT — logs/agent_summary.aosvault\n`);
  console.log(raw);
  console.log(`\n🤜🏻\n⛓️⚓⛓️`);
  process.exit(0);
}

// ── Write summary ─────────────────────────────────────────────────────────────
if (!summary.trim()) {
  console.error("[AOSR] No summary provided. Use --summary <text>, --file <path>, --list, or --export.");
  console.error("       Example: node scripts/aosr-summary.cjs --phase 114.4.3 --summary \"Upgraded rate limiting\"");
  process.exit(1);
}

// Build a unique fingerprint for this entry
const ts          = new Date().toISOString();
const entryRaw    = JSON.stringify({ ts, phase, summary });
const fingerprint = crypto.createHash("sha512").update(entryRaw).digest("hex").slice(0, 32);

const record = JSON.stringify({
  ts,
  phase,
  kernel_version:    KERNEL_VERSION,
  kernel_sha_prefix: KERNEL_SHA.slice(0, 16) + "…",
  fingerprint,
  summary: summary.trim(),
});

try {
  const _appendFd = fs.openSync(VAULT_FILE, 'a');
  try { fs.writeSync(_appendFd, record + "\n"); } finally { fs.closeSync(_appendFd); }
  logAosHeal("AOSR_SUMMARY_WRITTEN", `Phase ${phase} summary appended → logs/agent_summary.aosvault`);
  console.log(`✅ [AOSR] Summary written — Phase ${phase} · Fingerprint: ${fingerprint}`);
  console.log(`   File: ${path.relative(REPO_ROOT, VAULT_FILE)}`);
} catch (err) {
  logAosError(AOS_ERROR.INTERNAL_ERROR ?? "INTERNAL_ERROR", `aosr-summary: write failed: ${err.message}`);
  process.exit(1);
}
