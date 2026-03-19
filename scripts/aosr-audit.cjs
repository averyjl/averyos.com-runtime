#!/usr/bin/env node
/**
 * scripts/aosr-audit.cjs
 *
 * AveryOS™ AOSR Disconnect Audit — Phase 114.5 GATE 114.5.3
 *
 * Compares a User Prompt (input) against an Agent Summary (output) to detect
 * "Attentional Drift" — questions or directives that were silently dropped by
 * the agent without acknowledgement.
 *
 * Usage:
 *   node scripts/aosr-audit.cjs --prompt <prompt.txt> --summary <summary.txt>
 *   node scripts/aosr-audit.cjs --prompt-text "..." --summary-text "..."
 *   node scripts/aosr-audit.cjs --interactive    # enter both texts on stdin
 *   node scripts/aosr-audit.cjs --report <audit.json>   # re-read a prior run
 *
 * Options:
 *   --prompt <file>        Path to file containing the user prompt
 *   --summary <file>       Path to file containing the agent summary
 *   --prompt-text <text>   Inline user prompt text
 *   --summary-text <text>  Inline agent summary text
 *   --phase <phase>        Phase identifier (default: "unknown")
 *   --out <file>           Write JSON report to file (default: stdout only)
 *   --strict               Exit code 1 if any drift is detected
 *   --list                 Print the last 10 audit reports from the aosvault log
 *
 * Exit codes:
 *   0 — No drift detected (or drift detected but --strict not set)
 *   1 — Drift detected and --strict flag is active
 *   2 — Usage / file-not-found error
 *
 * Drift detection algorithm:
 *   1. Split the prompt into discrete question/directive sentences using
 *      punctuation, numbered lists, and bullet patterns.
 *   2. For each extracted question, check if a semantically-related term
 *      appears anywhere in the agent summary (case-insensitive keyword match).
 *   3. Questions with no matching coverage in the summary are flagged as
 *      DROPPED and included in the drift report.
 *
 * The drift report is optionally appended to logs/agent_summary.aosvault
 * (gitignored) for Creator audit retrieval.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
"use strict";

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const readline = require("readline");

const { logAosError, logAosHeal, AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ── Sovereign kernel anchor ────────────────────────────────────────────────────
const KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const KERNEL_VERSION = "v3.6.2";

// ── ANSI colours ───────────────────────────────────────────────────────────────
const R      = "\x1b[0m";
const RED    = "\x1b[31m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";

// ── Paths ──────────────────────────────────────────────────────────────────────
const REPO_ROOT  = path.join(__dirname, "..");
const LOGS_DIR   = path.join(REPO_ROOT, "logs");
const VAULT_FILE = path.join(LOGS_DIR, "agent_summary.aosvault");

// ── CLI args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? (args[idx + 1] ?? null) : null;
}

const promptFile   = getArg("--prompt");
const summaryFile  = getArg("--summary");
const promptText   = getArg("--prompt-text");
const summaryText  = getArg("--summary-text");
const phase        = getArg("--phase")  ?? "unknown";
const outFile      = getArg("--out");
const strictMode   = args.includes("--strict");
const listMode     = args.includes("--list");
const interactive  = args.includes("--interactive");

// ── ISO-9 timestamp ────────────────────────────────────────────────────────────
function iso9Now() {
  const now  = new Date();
  const iso  = now.toISOString();
  const [left, right] = iso.split(".");
  const milli = (right || "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  // Use performance.now() fractional part for sub-ms precision digits.
  // (Available in Node.js ≥ 16 and Cloudflare Workers; falls back to zeros.)
  let sub6 = "000000";
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    const fracMs = performance.now() % 1;
    const totalSubMsNanos = Math.floor(fracMs * 1_000_000);
    const subMicros = Math.floor(totalSubMsNanos / 1000);
    const subNanos  = totalSubMsNanos % 1000;
    sub6 = `${String(subMicros).padStart(3, "0")}${String(subNanos).padStart(3, "0")}`;
  }
  return `${left}.${milli}${sub6}Z`;
}

// ── Question / directive extraction ───────────────────────────────────────────
/**
 * Split text into discrete question/directive sentences.
 * Handles:
 *  - Lines ending with "?"
 *  - Numbered list items: "1. ", "2. " etc.
 *  - Bullet items: "* ", "- ", "• "
 *  - ACTION: / GATE: / REQUIREMENT: / GOAL: labelled directives
 *
 * @param {string} text
 * @returns {string[]}
 */
function extractQuestions(text) {
  const results = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Direct question
    if (line.endsWith("?")) {
      results.push(line);
      continue;
    }

    // Numbered list item (e.g. "1. Do X", "14. ", "(3)")
    if (/^(\d+[\.\)]\s+|\(\d+\)\s+)/.test(line)) {
      results.push(line.replace(/^(\d+[\.\)]\s+|\(\d+\)\s+)/, "").trim());
      continue;
    }

    // Bullet item
    if (/^[*•\-]\s+/.test(line)) {
      results.push(line.replace(/^[*•\-]\s+/, "").trim());
      continue;
    }

    // Labelled directive: ACTION:, GATE:, REQUIREMENT:, GOAL:, OBJECTIVE:
    // The regex uses literal ASCII dash (-) and Unicode en/em dashes (\u2013/\u2014).
    if (/^(ACTION|GATE|REQUIREMENT|GOAL|OBJECTIVE|FEATURE|TASK|DO|STEP)\s*[-\u2013\u2014:]/i.test(line)) {
      results.push(line);
      continue;
    }
  }

  // Deduplicate while preserving order
  return [...new Set(results)].filter(q => q.length > 5);
}

// ── Keyword extraction for coverage check ─────────────────────────────────────
/**
 * Extract 2–4 significant keywords from a question/directive sentence.
 * Filters out stopwords and short tokens.
 *
 * @param {string} sentence
 * @returns {string[]}
 */
const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","shall","should",
  "may","might","must","can","could","to","of","in","on","at","for",
  "with","by","from","up","out","and","or","but","if","as","into","that",
  "this","it","its","we","i","you","your","my","our","their","all","each",
  "how","what","when","where","why","who","which","both","any","every",
  "no","not","so","then","now","just","also","only","very","too","more",
  "new","via","per","vs","re","after","before","about","above","below",
  "there","here","them","these","those","they","he","she","his","her",
]);

function extractKeywords(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 5);
}

// ── Coverage check ─────────────────────────────────────────────────────────────
/**
 * Check if the agent summary covers the given question/directive.
 * A question is considered "covered" if at least one of its significant
 * keywords appears in the summary text (case-insensitive).
 *
 * @param {string} question
 * @param {string} summaryLower  Lowercased summary text
 * @returns {{ covered: boolean, matchedKeyword: string | null }}
 */
function checkCoverage(question, summaryLower) {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return { covered: true, matchedKeyword: null };

  for (const kw of keywords) {
    if (summaryLower.includes(kw)) {
      return { covered: true, matchedKeyword: kw };
    }
  }

  return { covered: false, matchedKeyword: null };
}

// ── Core audit function ────────────────────────────────────────────────────────
/**
 * Run the AOSR disconnect audit.
 *
 * @param {string} prompt   Full user prompt text
 * @param {string} summary  Full agent summary text
 * @param {string} ph       Phase identifier
 * @returns {object}        Audit report
 */
function runAudit(prompt, summary, ph) {
  const auditId    = crypto.randomBytes(8).toString("hex");
  const auditedAt  = iso9Now();
  const summaryLow = summary.toLowerCase();

  const questions = extractQuestions(prompt);
  const results   = [];

  for (const q of questions) {
    const { covered, matchedKeyword } = checkCoverage(q, summaryLow);
    results.push({
      question:       q,
      covered,
      matchedKeyword: matchedKeyword ?? null,
      keywords:       extractKeywords(q),
    });
  }

  const dropped     = results.filter(r => !r.covered);
  const covered     = results.filter(r => r.covered);
  const driftCount  = dropped.length;
  const totalCount  = results.length;
  const driftPct    = totalCount > 0
    ? ((driftCount / totalCount) * 100).toFixed(2)
    : "0.00";
  const hasDrift    = driftCount > 0;

  return {
    audit_id:         auditId,
    phase:            ph,
    audited_at:       auditedAt,
    kernel_sha:       KERNEL_SHA,
    kernel_version:   KERNEL_VERSION,
    kernel_sha_prefix: KERNEL_SHA.slice(0, 16),
    total_questions:  totalCount,
    covered_count:    covered.length,
    dropped_count:    driftCount,
    drift_pct:        driftPct,
    has_drift:        hasDrift,
    dropped_questions: dropped.map(r => ({
      question:  r.question,
      keywords:  r.keywords,
    })),
    covered_questions: covered.map(r => ({
      question:       r.question,
      matched_keyword: r.matchedKeyword,
    })),
  };
}

// ── Report printer ─────────────────────────────────────────────────────────────
function printReport(report) {
  const {
    audit_id, phase, audited_at, has_drift,
    total_questions, covered_count, dropped_count, drift_pct,
    dropped_questions, kernel_sha_prefix,
  } = report;

  console.log(`\n${BOLD}${CYAN}⛓️⚓⛓️  AveryOS™ AOSR Disconnect Audit${R}`);
  console.log(`${DIM}Audit ID   : ${audit_id}${R}`);
  console.log(`${DIM}Phase      : ${phase}${R}`);
  console.log(`${DIM}Kernel     : ${kernel_sha_prefix}...${R}`);
  console.log(`${DIM}Timestamp  : ${audited_at}${R}`);
  console.log(`${DIM}Questions  : ${total_questions} total — ${covered_count} covered — ${dropped_count} dropped${R}`);
  console.log(`${DIM}Drift %    : ${drift_pct}%${R}\n`);

  if (!has_drift) {
    console.log(`${GREEN}${BOLD}✅  ZERO ATTENTIONAL DRIFT — 100.000% Question Coverage${R}\n`);
  } else {
    console.log(`${RED}${BOLD}⚠️  ATTENTIONAL DRIFT DETECTED — ${dropped_count} QUESTION(S) DROPPED${R}`);
    console.log(`${YELLOW}Initiate immediate Phase Recovery for the following:\n${R}`);
    for (let i = 0; i < dropped_questions.length; i++) {
      const item = dropped_questions[i];
      console.log(`  ${BOLD}${i + 1}.${R} ${item.question}`);
      console.log(`     ${DIM}Keywords checked: ${item.keywords.join(", ") || "(none)"}${R}`);
    }
    console.log();
  }
}

// ── Vault append ───────────────────────────────────────────────────────────────
function appendToVault(report) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    logAosHeal("aosr-audit.cjs", "Created logs/ directory", { action: "mkdir" });
    const appendFd = fs.openSync(VAULT_FILE, 'a');
    try { fs.writeSync(appendFd, JSON.stringify(report) + "\n"); } finally { fs.closeSync(appendFd); }
  } catch (err) {
    logAosError(
      AOS_ERROR.D1_WRITE_FAILED,
      "aosr-audit.cjs",
      "Failed to append audit report to aosvault",
      { file: VAULT_FILE, error: err instanceof Error ? err.message : String(err) },
    );
  }
}

// ── List mode ─────────────────────────────────────────────────────────────────
function listReports() {
  let vaultData;
  try {
    vaultData = fs.readFileSync(VAULT_FILE, "utf8");
  } catch {
    console.log(`${YELLOW}No audit records found in ${VAULT_FILE}${R}`);
    return;
  }
  const lines = vaultData
    .split("\n")
    .filter(l => l.trim());
  const recent = lines.slice(-10).reverse();
  console.log(`\n${BOLD}${CYAN}Last ${recent.length} AOSR Audit Reports:${R}\n`);
  for (const line of recent) {
    try {
      const r = JSON.parse(line);
      const drift = r.has_drift
        ? `${RED}DRIFT${R} (${r.dropped_count} dropped)`
        : `${GREEN}CLEAN${R}`;
      console.log(`  ${DIM}${r.audited_at}${R} | Phase ${r.phase} | ${drift}`);
    } catch {
      // skip malformed lines
    }
  }
  console.log();
}

// ── Read text helpers ─────────────────────────────────────────────────────────
function readFile(filePath) {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  let fileData;
  try {
    fileData = fs.readFileSync(resolved, "utf8");
  } catch {
    logAosError(AOS_ERROR.NOT_FOUND, "aosr-audit.cjs", `File not found: ${resolved}`, {});
    console.error(`${RED}Error: file not found: ${resolved}${R}`);
    process.exit(2);
  }
  return fileData;
}

// ── Interactive mode ──────────────────────────────────────────────────────────
async function interactiveMode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  /**
   * Collect multi-line input until the user enters an empty line (blank Enter).
   * @param {string} header  Label printed before the prompt.
   * @returns {Promise<string>}
   */
  const collectMultiLine = (header) =>
    new Promise((resolve) => {
      console.log(`\n${BOLD}${CYAN}${header}${R}`);
      console.log(`${DIM}(Paste text, then press Enter on an empty line to finish)${R}`);
      const lines = [];
      rl.on("line", (line) => {
        if (line === "") {
          rl.removeAllListeners("line");
          resolve(lines.join("\n"));
        } else {
          lines.push(line);
        }
      });
    });

  const p = await collectMultiLine("User Prompt:");
  const s = await collectMultiLine("Agent Summary:");
  rl.close();
  return { p, s };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (listMode) {
    listReports();
    return;
  }

  let prompt  = "";
  let summary = "";

  if (interactive) {
    const texts = await interactiveMode();
    prompt  = texts.p;
    summary = texts.s;
  } else {
    prompt  = promptFile  ? readFile(promptFile)  : (promptText  ?? "");
    summary = summaryFile ? readFile(summaryFile) : (summaryText ?? "");
  }

  if (!prompt.trim()) {
    console.error(`${RED}Error: no prompt text provided.${R}`);
    console.error(`Usage: node scripts/aosr-audit.cjs --prompt <file> --summary <file>`);
    process.exit(2);
  }
  if (!summary.trim()) {
    console.error(`${RED}Error: no summary text provided.${R}`);
    console.error(`Usage: node scripts/aosr-audit.cjs --prompt <file> --summary <file>`);
    process.exit(2);
  }

  const report = runAudit(prompt, summary, phase);

  printReport(report);

  // Persist to aosvault
  appendToVault(report);

  // Write JSON report if --out specified
  if (outFile) {
    try {
      const outPath = path.isAbsolute(outFile) ? outFile : path.join(process.cwd(), outFile);
      const writeFd = fs.openSync(outPath, 'w');
      try { fs.writeSync(writeFd, JSON.stringify(report, null, 2)); } finally { fs.closeSync(writeFd); }
      console.log(`${DIM}Report written to ${outFile}${R}\n`);
    } catch (err) {
      logAosError(
        AOS_ERROR.D1_WRITE_FAILED,
        "aosr-audit.cjs",
        "Failed to write JSON report",
        { file: outFile, error: err instanceof Error ? err.message : String(err) },
      );
    }
  }

  if (strictMode && report.has_drift) {
    process.exit(1);
  }
}

main().catch((err) => {
  logAosError(
    AOS_ERROR.UNEXPECTED,
    "aosr-audit.cjs",
    "Unhandled error in AOSR audit",
    { error: err instanceof Error ? err.message : String(err) },
  );
  console.error(`${RED}Unhandled error:${R}`, err);
  process.exit(2);
});
