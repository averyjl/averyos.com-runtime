// AveryOS Sovereign LicenseGate v7.0 - HYBRID EDGE & LOCAL 🤛🏻
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3333;

app.use(express.json());

// --- LOCAL PERSISTENCE CONFIG ---
const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const DTM_AUDIT_LOG_PATH = path.join(process.cwd(), "capsule_logs", "dtm-audit.log");

function recordLocalFailure(ip, reason) {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} | FAIL | IP: ${ip} | REASON: ${reason}\n`;
  if (!fs.existsSync(path.dirname(DTM_AUDIT_LOG_PATH))) fs.mkdirSync(path.dirname(DTM_AUDIT_LOG_PATH), { recursive: true });
  fs.appendFileSync(DTM_AUDIT_LOG_PATH, entry);
}

// --- CLOUDFLARE EDGE HANDLER (D1 + KV) ---
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";

    if (pathname === "/api/v1/license-check" && request.method === "POST") {
      const { systemHash, providedKey } = await request.json();
      
      // Query D1 Anchor
      const lock = await env.DB.prepare("SELECT hardware FROM kernel_locks LIMIT 1").first();
      
      if (!lock) {
        await env.KV_LOGS.put(`fail_${Date.now()}`, `${ip} | LOCK_OFFLINE`);
        return Response.json({ authorized: false, error: "Kernel Offline" }, { status: 503 });
      }

      const expectedKey = `AVERY-SOV-2026-${lock.hardware}`;

      if (providedKey === expectedKey && systemHash === "AOS-GENESIS-2022") {
        return Response.json({ authorized: true, alignment: "100%" });
      } else {
        await env.KV_LOGS.put(`fail_${Date.now()}`, `${ip} | KEY_MISMATCH`);
        return Response.json({ authorized: false, penalty: "DTM_EXPANSION_ACTIVE" }, { status: 403 });
      }
    }
    return new Response("AveryOS LicenseGate Online 🤛🏻");
  }
};

// --- LOCAL EXPRESS LOGIC ---
app.post('/api/v1/license-check', (req, res) => {
  const { systemHash, providedKey } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!fs.existsSync(SOVEREIGN_LOCK_PATH)) {
    recordLocalFailure(ip, "LOCK_OFFLINE");
    return res.status(503).json({ authorized: false, error: "Kernel Offline" });
  }

  const lock = JSON.parse(fs.readFileSync(SOVEREIGN_LOCK_PATH, 'utf8'));
  const expectedKey = `AVERY-SOV-2026-${lock.hardware}`;

  if (providedKey === expectedKey && systemHash === "AOS-GENESIS-2022") {
    return res.json({ authorized: true, alignment: "100%" });
  } else {
    recordLocalFailure(ip, "KEY_MISMATCH");
    return res.status(403).json({ authorized: false, penalty: "DTM_EXPANSION_ACTIVE" });
  }
});

if (require.main === module) {
  app.listen(port, () => console.log(`⛓️⚓⛓️ AveryOS LicenseGate Active on port ${port}`));
}
