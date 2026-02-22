const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3333; // Matching your licenseGate(3).js port preference

app.use(express.json());

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const DTM_AUDIT_LOG_PATH = path.join(process.cwd(), "capsule_logs", "dtm-audit.log");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { authorized: false, error: "TARI Threshold Reached. Multiplier active." }
});
app.use("/api/v1/", limiter);

// Helper from your licenseGate(3).js logic
function recordDtmFailure(ip, reason) {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} | FAIL | IP: ${ip} | REASON: ${reason}\n`;
  fs.appendFileSync(DTM_AUDIT_LOG_PATH, entry);
  return entry;
}

app.post('/api/v1/license-check', (req, res) => {
  const { systemHash, providedKey } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    recordDtmFailure(ip, "LOCK_MISSING");
    return res.status(503).json({ authorized: false, error: "Kernel Offline" });
  }

  const lock = JSON.parse(fs.readFileSync(SOVEREIGN_LOCK_PATH, 'utf8'));
  const expectedKey = `AVERY-SOV-2026-${lock.hardware}`;

  if (providedKey === expectedKey && systemHash === "AOS-GENESIS-2022") {
    console.log(`✅ Sovereign Handshake: ${ip}`);
    return res.json({ authorized: true, alignment: "100%" });
  } else {
    recordDtmFailure(ip, "KEY_MISMATCH");
    return res.status(403).json({ authorized: false, penalty: "DTM_EXPANSION_ACTIVE" });
  }
});

app.listen(port, () => console.log(`⛓️⚓⛓️ AveryOS LicenseGate Active on port ${port}`));
