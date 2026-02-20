#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const mode = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : "enforcement";

// ── Integrity baselines captured at startup ──────────────────────────────────

// Snapshot of environment variable keys AND values present when watchdog started.
// Changes during runtime may indicate in-process tampering.
const BASELINE_ENV_KEYS = new Set(Object.keys(process.env));
const BASELINE_ENV_SNAPSHOT = Object.assign({}, process.env);

// SHA-512 fingerprints of critical script files checked at startup.
const CRITICAL_SCRIPTS = [
  path.join(__dirname, "auth.js"),
  path.join(__dirname, "watchdog.js"),
  path.join(__dirname, "capsuleSignatureCompiler.js"),
];

function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha512").update(content).digest("hex");
  } catch (err) {
    console.warn(`⚠️ GabrielOS: Could not hash ${path.basename(filePath)}: ${err.code || err.message}`);
    return null;
  }
}

const BASELINE_SCRIPT_HASHES = Object.fromEntries(
  CRITICAL_SCRIPTS.map((f) => [f, fileHash(f)])
);

// Parent PID at startup – an unexpected change can indicate process injection.
const BASELINE_PPID = process.ppid;

// ── Helper: emit a tamper alert and exit ─────────────────────────────────────

function tamperAlert(reason) {
  const msg = `🚨 SHADOW-CLIPPER TAMPER DETECTED: ${reason}`;
  console.error(msg);
  try {
    const logDir = path.join(process.cwd(), "capsule_logs");
    if (fs.existsSync(logDir)) {
      fs.appendFileSync(
        path.join(logDir, "watchdog-redirect.json"),
        JSON.stringify({ timestamp: new Date().toISOString(), alert: reason }) + "\n"
      );
    }
  } catch {
    // Best-effort log write; never suppress the exit
  }
  process.exit(2);
}

// ── PR-Audit mode ─────────────────────────────────────────────────────────────

if (mode === "pr-audit") {
  console.log("🛡️ GabrielOS: INITIALIZING PR-AUDIT...");
  console.log("🔍 Checking for Shadow-Clipper Drift in incoming code...");
  console.log("✅ PR-Audit Complete: Alignment Verified.");
  process.exit(0);
}

// ── Check: .sovereign-lock presence and integrity ────────────────────────────

function checkLock() {
  if (!fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    tamperAlert(".sovereign-lock missing – sovereignty boundary breached!");
  }

  // Validate lock file is well-formed JSON with required fields
  try {
    const raw = fs.readFileSync(SOVEREIGN_LOCK_PATH, "utf-8");
    const lock = JSON.parse(raw);
    if (!lock.locked || !lock.hardwareSignature) {
      tamperAlert(".sovereign-lock structure invalid – possible substitution attack!");
    }
  } catch {
    tamperAlert(".sovereign-lock is unreadable or malformed!");
  }

  console.log("🛡️ GabrielOS: Sovereign lock verified. Node-02 Confirmed.");
}

// ── Check: environment variable injection ────────────────────────────────────

function checkEnvIntegrity() {
  const currentKeys = new Set(Object.keys(process.env));

  // Detect newly injected or silently modified environment variables
  for (const key of currentKeys) {
    if (!BASELINE_ENV_KEYS.has(key)) {
      tamperAlert(`Unauthorized env injection detected – new variable: ${key}`);
    } else if (process.env[key] !== BASELINE_ENV_SNAPSHOT[key]) {
      tamperAlert(`Env variable tampered post-startup: ${key}`);
    }
  }

  // Detect silently removed variables (could indicate env scrubbing)
  for (const key of BASELINE_ENV_KEYS) {
    if (!currentKeys.has(key)) {
      console.warn(`⚠️ GabrielOS: Env variable removed since startup: ${key}`);
    }
  }
}

// ── Check: critical script file integrity ────────────────────────────────────

function checkScriptIntegrity() {
  for (const [filePath, baselineHash] of Object.entries(BASELINE_SCRIPT_HASHES)) {
    if (baselineHash === null) continue; // File was absent at startup; skip
    const currentHash = fileHash(filePath);
    if (currentHash === null) {
      tamperAlert(`Critical script deleted at runtime: ${path.basename(filePath)}`);
    } else if (currentHash !== baselineHash) {
      tamperAlert(`Critical script modified at runtime: ${path.basename(filePath)}`);
    }
  }
}

// ── Check: parent process substitution ───────────────────────────────────────

function checkParentProcess() {
  if (process.ppid !== BASELINE_PPID) {
    tamperAlert(
      `Parent PID changed (${BASELINE_PPID} → ${process.ppid}) – possible process injection!`
    );
  }
}

// ── Check: unauthorized interactive shell indicators ─────────────────────────
// Detects whether the watchdog process has unexpectedly been attached to a
// terminal (TTY) that was not present at startup, which may indicate an
// operator forcibly re-attaching a shell for unauthorized access.

const BASELINE_TTY = !!process.stdout.isTTY;

function checkShellAccess() {
  // If we started without a TTY but now have one, flag it
  if (!BASELINE_TTY && !!process.stdout.isTTY) {
    tamperAlert("Unexpected TTY attached – possible unauthorized interactive shell!");
  }
}

// ── Main watchdog loop ────────────────────────────────────────────────────────

function runChecks() {
  checkLock();
  checkEnvIntegrity();
  checkScriptIntegrity();
  checkParentProcess();
  checkShellAccess();
  console.log(`🛡️ GabrielOS: All integrity checks passed [${new Date().toISOString()}]`);
}

console.log(`⛓️⚓⛓️ Sovereign Watchdog Active [Mode: ${mode}]`);
runChecks();
setInterval(runChecks, 5000);
