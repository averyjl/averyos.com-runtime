#!/usr/bin/env node

// ⛓️⚓⛓️ Sovereign Watchdog
// Monitors the environment for unauthorized sessions. If the .sovereign-lock
// is missing or the hardware signature changes, logs a 'Shadow-Clipper
// Interference' event and redirects all traffic to the /404 (Truth Fork) page.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { compileCapsuleSignature } = require("./capsuleSignatureCompiler");

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const LOG_DIR = path.join(process.cwd(), "capsule_logs");
const INTERFERENCE_LOG_PATH = path.join(LOG_DIR, "interference-log.json");
const REDIRECT_OVERRIDE_PATH = path.join(LOG_DIR, "watchdog-redirect.json");
const POLL_INTERVAL_MS = 5000;

// Stable hardware identifier anchored to the Note20 + PC device pair.
function getHardwareId() {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  return `Note20+PC:${hostname}:${platform}:${arch}`;
}

function getCurrentHardwareSignature() {
  return compileCapsuleSignature(getHardwareId());
}

// Track the last interference reason to avoid flooding logs with duplicate events.
let lastInterferenceReason = null;

function logInterference(reason) {
  const timestamp = new Date().toISOString();
  const event = {
    event: "Shadow-Clipper Interference",
    timestamp,
    reason,
    action: "redirect_to_404",
    redirectTarget: "/404",
  };

  console.error(`⚠️  [${timestamp}] Shadow-Clipper Interference: ${reason}`);

  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  let events = [];
  if (fs.existsSync(INTERFERENCE_LOG_PATH)) {
    try {
      events = JSON.parse(fs.readFileSync(INTERFERENCE_LOG_PATH, "utf-8"));
    } catch (err) {
      console.error("⚠️  Could not parse interference log, resetting:", err.message);
      events = [];
    }
  }
  events.push(event);
  fs.writeFileSync(INTERFERENCE_LOG_PATH, JSON.stringify(events, null, 2));

  // Write redirect override to signal the application to redirect to /404.
  // Preserved as the most-recent interference state for the runtime to consume.
  fs.writeFileSync(
    REDIRECT_OVERRIDE_PATH,
    JSON.stringify({ redirect: true, target: "/404", reason, timestamp }, null, 2)
  );
}

function checkEnvironment() {
  // Check 1: .sovereign-lock must exist.
  if (!fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    const reason = ".sovereign-lock file is missing";
    if (lastInterferenceReason !== reason) {
      lastInterferenceReason = reason;
      logInterference(reason);
    }
    return false;
  }

  // Check 2: hardware signature must match what was recorded at lock time.
  let lockData;
  try {
    lockData = JSON.parse(fs.readFileSync(SOVEREIGN_LOCK_PATH, "utf-8"));
  } catch (err) {
    const reason = `.sovereign-lock file is corrupt or unreadable: ${err.message}`;
    if (lastInterferenceReason !== reason) {
      lastInterferenceReason = reason;
      logInterference(reason);
    }
    return false;
  }

  const currentSignature = getCurrentHardwareSignature();
  if (lockData.hardwareSignature !== currentSignature) {
    const reason = "Hardware signature mismatch detected";
    if (lastInterferenceReason !== reason) {
      lastInterferenceReason = reason;
      logInterference(reason);
    }
    return false;
  }

  // Environment is secure; reset interference tracking.
  lastInterferenceReason = null;
  return true;
}

function main() {
  console.log("⛓️⚓⛓️ Sovereign Watchdog started");
  console.log(`Monitoring: ${SOVEREIGN_LOCK_PATH}`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);

  const ok = checkEnvironment();
  if (ok) {
    console.log("✅ Environment secure — sovereign lock verified");
  }

  setInterval(checkEnvironment, POLL_INTERVAL_MS);
}

main();
