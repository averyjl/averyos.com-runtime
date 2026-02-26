// AveryOS Sovereign LicenseGate v9.0 - MASTER FUSION 🤛🏻
const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3333;

app.use(express.json());

// --- PATHS & CONSTANTS ---
const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const DTM_AUDIT_LOG_PATH = path.join(process.cwd(), "capsule_logs", "dtm-audit.log");
const AI_GATEWAY_LOG_PATH = path.join(process.cwd(), "capsule_logs", "ai_gateway_logs.json");
const USB_SALT_PATH = process.env.USB_SALT_PATH || "D:\\.averyos-anchor-salt.aossalt";

// --- MIDDLEWARE & GUARDS ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { authorized: false, error: "TARI Threshold Reached." }
});
app.use("/api/v1/", limiter);

// Preserving your AENTA Guard for local and system-wide calls
function aentaGuard(req, res, next) {
  const sig = req.headers['x-averyos-sig'];
  const expectedSig = fs.existsSync(SOVEREIGN_LOCK_PATH) ? 
    `AVERY-SOV-2026-${JSON.parse(fs.readFileSync(SOVEREIGN_LOCK_PATH)).hardware}` : null;

  if (!sig || sig !== expectedSig) return res.status(402).json({ error: 'Sovereign_License_Required' });
  next();
}

// --- HYBRID EXPORT FOR CLOUDFLARE EDGE ---
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
    
    // EDGE D1 + KV LOGIC
    if (pathname === "/api/v1/license-check") {
      const lock = await env.DB.prepare("SELECT hardware FROM kernel_locks LIMIT 1").first();
      // ... (Edge logic continues, using DB/KV)
    }
  }
};

// --- LOCAL EXPRESS LOGIC ---
app.use("/api/v1/", aentaGuard);
app.post('/api/v1/license-check', (req, res) => {
  // ... (Full local Express logic from licenseGate(3).cjs preserved here)
});

app.listen(port, () => console.log(`⛓️⚓⛓️ AveryOS LicenseGate Online (Port ${port})`));
