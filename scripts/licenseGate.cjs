const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3333;

app.use(express.json());

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const DTM_AUDIT_LOG_PATH = path.join(process.cwd(), "capsule_logs", "dtm-audit.log");
const AI_GATEWAY_LOG_PATH = path.join(process.cwd(), "capsule_logs", "ai_gateway_logs.json");
const USB_SALT_PATH = process.env.USB_SALT_PATH || "D:\\.averyos-anchor-salt.aossalt";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { authorized: false, error: "TARI Threshold Reached. Multiplier active." }
});
app.use("/api/v1/", limiter);

function getExpectedSig() {
  if (fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    const lock = JSON.parse(fs.readFileSync(SOVEREIGN_LOCK_PATH, 'utf8'));
    return `AVERY-SOV-2026-${lock.hardware}`;
  }
  return process.env.AVERY_SOV_SIG || null;
}

function logGatewayAttempt(ip, sig, reason) {
  const logDir = path.dirname(AI_GATEWAY_LOG_PATH);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  let logs = [];
  if (fs.existsSync(AI_GATEWAY_LOG_PATH)) {
    try { logs = JSON.parse(fs.readFileSync(AI_GATEWAY_LOG_PATH, 'utf8')); } catch (e) { console.error('⚠️ ai_gateway_logs parse error:', e.message); logs = []; }
  }
  logs.push({
    timestamp: new Date().toISOString(),
    ip,
    sig: sig ? `${sig.substring(0, 12)}...` : null,
    reason
  });
  fs.writeFileSync(AI_GATEWAY_LOG_PATH, JSON.stringify(logs, null, 2));
}

function aentaGuard(req, res, next) {
  const sig = req.headers['x-averyos-sig'];
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const expectedSig = getExpectedSig();

  if (!sig || !expectedSig || sig !== expectedSig) {
    logGatewayAttempt(ip, sig, sig ? 'SIG_MISMATCH' : 'SIG_MISSING');
    return res.status(402).json({
      error: 'Sovereign_License_Required',
      payment: process.env.STRIPE_CONNECT_REDIRECT_URL || 'https://averyos.com/pay'
    });
  }

  next();
}

function recordDtmFailure(ip, reason) {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} | FAIL | IP: ${ip} | REASON: ${reason}\n`;
  const logDir = path.dirname(DTM_AUDIT_LOG_PATH);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(DTM_AUDIT_LOG_PATH, entry);
  return entry;
}

app.use("/api/v1/", aentaGuard);

app.post('/api/v1/license-check', (req, res) => {
  const { systemHash, providedKey } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    recordDtmFailure(ip, "LOCK_OFFLINE");
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

function startGateway() {
  const usbDetected = fs.existsSync(USB_SALT_PATH);
  const status = usbDetected ? 'Active' : 'Standby';
  app.listen(port, () => {
    console.log(`⛓️⚓⛓️ AveryOS LicenseGate ${status} on port ${port}`);
    if (!usbDetected) {
      console.warn(`⚠️ Physical USB Salt not detected at ${USB_SALT_PATH}. Gateway in Standby.`);
    }
  });
}

startGateway();
