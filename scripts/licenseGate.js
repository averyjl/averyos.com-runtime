// AveryOS Sovereign LicenseGate v6.0 - Hybrid Edge/Local 🤛🏻
const express = require('express');
const app = express();
const port = 3333; 

app.use(express.json());

export default {
  async fetch(request, env) {
    // CLOUDFLARE EDGE LOGIC
    const { pathname } = new URL(request.url);
    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";

    if (pathname === "/api/v1/license-check") {
      const { systemHash, providedKey } = await request.json();
      
      // Use D1 instead of fs.readFileSync
      const lock = await env.DB.prepare("SELECT hardware FROM kernel_locks LIMIT 1").first();
      
      if (!lock) {
        await env.KV_LOGS.put(`fail_${Date.now()}`, `${ip} | LOCK_MISSING`);
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
  }
};

// LOCAL TESTING FALLBACK
if (require.main === module) {
    app.listen(port, () => console.log(`⛓️⚓⛓️ AveryOS LicenseGate Active on port ${port}`));
}
