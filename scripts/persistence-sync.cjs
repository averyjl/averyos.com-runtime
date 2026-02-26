#!/usr/bin/env node
/**
 * AveryOS™ Persistence Sync — scripts/persistence-sync.cjs
 *
 * Watches logs/persistence/ for new .vault or .json files and pushes them
 * to the `vaultchain` branch of the remote repository as an immutable
 * administrative audit trail.
 *
 * Usage (foreground watcher):
 *   GITHUB_PAT=<pat> node scripts/persistence-sync.cjs
 *
 * Usage (one-shot commit of any uncommitted files):
 *   GITHUB_PAT=<pat> node scripts/persistence-sync.cjs --once
 *
 * Environment variables (set in Render / CI secrets — never hardcode):
 *   GITHUB_PAT   – GitHub Personal Access Token with repo scope
 *   REPO_OWNER   – GitHub org/user (default: averyjl)
 *   REPO_NAME    – Repository name  (default: averyos.com-runtime)
 *   SYNC_BRANCH  – Target branch    (default: vaultchain)
 *   WATCH_DIR    – Directory to watch (default: logs/persistence)
 *
 * Security: The PAT is injected exclusively via environment variables.
 *           It is never written to disk or logged.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Config ────────────────────────────────────────────────────────────────────
const GITHUB_PAT  = process.env.GITHUB_PAT;
const REPO_OWNER  = process.env.REPO_OWNER  || "averyjl";
const REPO_NAME   = process.env.REPO_NAME   || "averyos.com-runtime";
const SYNC_BRANCH = process.env.SYNC_BRANCH || "vaultchain";
const WATCH_DIR   = path.resolve(
  process.cwd(),
  process.env.WATCH_DIR || "logs/persistence"
);

const TRACKED_EXTS = new Set([".vault", ".json"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a 9-digit microsecond timestamp string (UTC). */
function microTimestamp() {
  const now = Date.now();          // ms precision in Node
  const micro = process.hrtime.bigint();
  // Combine wall-clock ms with sub-ms hrtime digits for a 9-digit suffix
  const suffix = String(micro % 1_000_000_000n).padStart(9, "0");
  return `${now}${suffix}`.slice(0, 22); // keep reasonable length
}

/** Ensure the watch directory exists. */
function ensureWatchDir() {
  if (!fs.existsSync(WATCH_DIR)) {
    fs.mkdirSync(WATCH_DIR, { recursive: true });
    console.log(`📁 Created watch directory: ${WATCH_DIR}`);
  }
}

/** Build the authenticated remote URL (PAT injected, not logged). */
function remoteUrl() {
  if (!GITHUB_PAT) throw new Error("GITHUB_PAT environment variable is not set.");
  return `https://x-access-token:${GITHUB_PAT}@github.com/${REPO_OWNER}/${REPO_NAME}.git`;
}

/** Run a shell command and return stdout (throws on non-zero exit). */
function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: "pipe", ...opts });
}

/**
 * Commit and push any untracked / modified files under WATCH_DIR
 * to SYNC_BRANCH.
 */
function syncFiles(changedFile) {
  const relPath = path.relative(process.cwd(), changedFile || WATCH_DIR);
  const ts = microTimestamp();

  try {
    // Stage only the watch directory
    run(`git add "${relPath}"`);

    // Check if there is anything to commit
    const status = run("git status --porcelain");
    if (!status.trim()) {
      console.log("✅ Nothing to commit.");
      return;
    }

    const msg = `⛓️ persistence-sync ${ts} — ${path.basename(changedFile || WATCH_DIR)}`;
    run(`git commit -m "${msg}"`);

    // Push to the target branch using the authenticated remote
    const remote = remoteUrl();
    run(`git push "${remote}" HEAD:${SYNC_BRANCH}`);

    console.log(`📤 Pushed to ${SYNC_BRANCH}: ${msg}`);
  } catch (err) {
    // Scrub PAT from error message before logging
    const safe = err.message.replace(GITHUB_PAT || "", "<PAT>");
    console.error(`⚠️  Sync error: ${safe}`);
  }
}

// ── One-Shot Mode ─────────────────────────────────────────────────────────────
if (process.argv.includes("--once")) {
  if (!GITHUB_PAT) {
    console.error("❌ GITHUB_PAT is not set. Aborting.");
    process.exit(1);
  }
  ensureWatchDir();
  console.log(`🔄 One-shot sync of ${WATCH_DIR} → ${SYNC_BRANCH}`);
  syncFiles(null);
  process.exit(0);
}

// ── Watcher Mode ──────────────────────────────────────────────────────────────
if (!GITHUB_PAT) {
  console.error("❌ GITHUB_PAT is not set. Set it as an environment variable.");
  process.exit(1);
}

ensureWatchDir();
console.log(`👀 Watching ${WATCH_DIR} → ${SYNC_BRANCH} (Ctrl+C to stop)`);

// Debounce rapid successive changes (e.g. editor writes multiple events)
const debounceMap = new Map();

fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  const ext = path.extname(filename).toLowerCase();
  if (!TRACKED_EXTS.has(ext)) return;

  const full = path.join(WATCH_DIR, filename);

  // Debounce: wait 800 ms after last event for the same file
  if (debounceMap.has(full)) clearTimeout(debounceMap.get(full));
  debounceMap.set(
    full,
    setTimeout(() => {
      debounceMap.delete(full);
      if (!fs.existsSync(full)) return; // deleted — skip
      console.log(`🔔 Change detected: ${filename} [${eventType}]`);
      syncFiles(full);
    }, 800)
  );
});
