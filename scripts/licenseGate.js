#!/usr/bin/env node

/**
 * AveryOS License Gate — TARI Monetization Foundation
 * Exposes POST /api/v1/license-check.
 * Cross-verifies systemHash + providedKey against the local .sovereign-lock.
 * Failed attempts are logged with the requester IP and tracked in the DTM audit log.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const DTM_AUDIT_LOG_PATH = path.join(process.cwd(), "capsule_logs", "dtm-audit.log");
const PORT = process.env.LICENSE_GATE_PORT || 3333;

const app = express();
app.use(express.json());

const licenseCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { authorized: false, error: "Too many requests. Please try again later." },
});

// Ensure the log directory exists
const logDir = path.dirname(DTM_AUDIT_LOG_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Seed the in-memory counter from any existing log entries
let dtmFailureCount = (() => {
  if (!fs.existsSync(DTM_AUDIT_LOG_PATH)) return 0;
  try {
    const content = fs.readFileSync(DTM_AUDIT_LOG_PATH, "utf8");
    return content.split("\n").filter((line) => line.trim() !== "").length;
  } catch {
    return 0;
  }
})();

/**
 * Append a line to the DTM audit log and return the updated failure count.
 * @param {string} ip - IP address of the requester
 * @param {string} reason - Short description of the failure
 * @returns {number} Total DTM failure count after this entry
 */
function recordDtmFailure(ip, reason) {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} | IP: ${ip} | REASON: ${reason}\n`;
  try {
    fs.appendFileSync(DTM_AUDIT_LOG_PATH, entry);
  } catch (err) {
    console.error(`[licenseGate] Failed to write DTM audit log: ${err.message}`);
  }
  dtmFailureCount += 1;
  return dtmFailureCount;
}

app.post("/api/v1/license-check", licenseCheckLimiter, (req, res) => {
  const { systemHash, providedKey } = req.body || {};
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";

  // Validate input presence
  if (!systemHash || !providedKey) {
    const count = recordDtmFailure(ip, "missing_fields");
    console.error(`[licenseGate] ❌ Missing fields from IP ${ip} | DTM count: ${count}`);
    return res.status(400).json({ authorized: false, error: "systemHash and providedKey are required." });
  }

  // Read sovereign lock
  if (!fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    const count = recordDtmFailure(ip, "sovereign_lock_missing");
    console.error(`[licenseGate] ❌ Sovereign lock absent — IP ${ip} | DTM count: ${count}`);
    return res.status(503).json({ authorized: false, error: "Sovereign lock not initialized on this node." });
  }

  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(SOVEREIGN_LOCK_PATH, "utf8"));
  } catch {
    const count = recordDtmFailure(ip, "lock_parse_error");
    console.error(`[licenseGate] ❌ Lock parse error — IP ${ip} | DTM count: ${count}`);
    return res.status(500).json({ authorized: false, error: "Failed to read sovereign lock." });
  }

  // Cross-verify
  const expectedKey = `AVERY-SOV-2026-${lock.hardware ? lock.hardware : ""}`;
  const keyMatch = providedKey.toLowerCase() === expectedKey.toLowerCase();
  const hashMatch = systemHash === lock.hardware;

  if (!lock.locked || !keyMatch || !hashMatch) {
    const count = recordDtmFailure(ip, "key_mismatch");
    console.warn(`[licenseGate] ⚠️ Unauthorized attempt from IP ${ip} | DTM count: ${count}`);
    return res.status(403).json({ authorized: false, error: "License verification failed.", dtmCount: count });
  }

  console.log(`[licenseGate] ✅ License verified for IP ${ip}`);
  return res.status(200).json({ authorized: true, node: lock.node, timestamp: lock.timestamp });
});

app.listen(PORT, () => {
  console.log(`⛓️⚓⛓️ AveryOS License Gate active on port ${PORT}`);
});
