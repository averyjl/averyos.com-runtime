#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const USB_SALT_PATH = "D:\\.averyos-anchor-salt.aossalt";
const PULSE_INTERVAL = 5000; // 5 seconds

// Capture baselines at startup
const BASELINE_ENV_SNAPSHOT = Object.assign({}, process.env);
const CRITICAL_SCRIPTS = [
  path.join(__dirname, "auth.js"),
  path.join(__dirname, "watchdog.js"),
];

function killSession(reason) {
  console.error(`\n🚨 CRITICAL SECURITY BREACH: ${reason}`);
  if (fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    fs.unlinkSync(SOVEREIGN_LOCK_PATH);
  }
  console.log("🔒 Sovereign Environment Vaporized. System Locked.");
  process.exit(1);
}

function pulse() {
  // 1. Physical Pulse
  if (!fs.existsSync(USB_SALT_PATH)) {
    killSession("Physical USB Anchor pulled.");
  }

  // 2. Logic Integrity
  if (!fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    killSession("Sovereign Lock missing.");
  }

  // 3. Env/Script Integrity Checks
  // (Full original logic from your watchdog.js goes here)
  
  console.log(`🛡️ GabrielOS: Pulse Verified [${new Date().toLocaleTimeString()}]`);
}

console.log(`⛓️⚓⛓️ Sovereign Watchdog: Continuous Physical Pulse Active (${PULSE_INTERVAL/1000}s)`);
setInterval(pulse, PULSE_INTERVAL);
