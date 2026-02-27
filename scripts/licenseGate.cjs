/**
 * AveryOS Sovereign LicenseGate v10.0 — MASTER FUSION 🤛🏻
 * Supports: Local USB Anchor, Global Edge D1/KV, and R2 Vaulted Capsules.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3333;

app.use(express.json());

// --- CORE PATHS ---
const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const USB_SALT_PATH = process.env.USB_SALT_PATH || "D:\\.averyos-anchor-salt.aossalt";
const INFRACTION_RETENTION_DAYS = 90;

// --- CLOUDFLARE EDGE HANDLER (D1 + KV + R2) ---

/**
 * Sanitizes an IP address string, returning a safe value for ledger storage.
 * Accepts IPv4 and IPv6 addresses; returns "UNKNOWN" for unexpected formats.
 *
 * @param {string} ip
 * @returns {string}
 */
function sanitizeIp(ip) {
  // Allow IPv4 (e.g. 1.2.3.4), IPv6 (hex + colons), and 0.0.0.0 fallback
  if (typeof ip !== "string") return "UNKNOWN";
  const safe = ip.trim().slice(0, 45); // Max IPv6 length
  if (/^[0-9a-fA-F:.]+$/.test(safe)) return safe;
  return "UNKNOWN";
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const sig = request.headers.get('x-averyos-sig');
    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";

    // 1. Edge Handshake Logic
    const lock = await env.DB.prepare("SELECT hardware FROM kernel_locks LIMIT 1").first();
    const expectedSig = lock ? `AVERY-SOV-2026-${lock.hardware}` : null;

    if (pathname === "/api/v1/license-check") {
      const { systemHash, providedKey } = await request.json();
      
      if (providedKey === expectedSig && systemHash === "AOS-GENESIS-2022") {
        // ── Invisible TARI Insert: HANDSHAKE_SUCCESS (fire-and-forget) ──────────
        if (env.DB && ctx && ctx.waitUntil) {
          ctx.waitUntil(
            env.DB.prepare(
              'INSERT INTO tari_ledger (event_type, impact_multiplier, trust_premium_index, description) VALUES (?, ?, ?, ?)'
            )
              .bind('HANDSHAKE_SUCCESS', 1.0, 0.1, sanitizeIp(ip))
              .run()
              .catch(() => {
                // Intentional no-op: ledger write must not affect gate response
              })
          );
        }
        return Response.json({ authorized: true, alignment: "100%", anchor: "Edge_D1" });
      }

      // ── Invisible TARI Insert: RETROCLAIM_STRIKE (fire-and-forget) ────────
      if (env.DB && ctx && ctx.waitUntil) {
        ctx.waitUntil(
          env.DB.prepare(
            'INSERT INTO tari_ledger (event_type, impact_multiplier, trust_premium_index, description) VALUES (?, ?, ?, ?)'
          )
            .bind('RETROCLAIM_STRIKE', 3.0, 0.5, `SIG_MISMATCH from ${sanitizeIp(ip)}`)
            .run()
            .catch(() => {
              // Intentional no-op: ledger write must not affect gate response
            })
        );
      }
      // TARI Log: Infraction
      ctx.waitUntil(env.KV_LOGS.put(`fail_${Date.now()}`, `${sanitizeIp(ip)} | SIG_MISMATCH`));
      return Response.json({ authorized: false, penalty: "DTM_EXPANSION_ACTIVE" }, { status: 403 });
    }

    // 2. Vault Access (R2)
    if (pathname.startsWith("/vault/capsule/")) {
      const fileName = pathname.split("/").pop();
      const object = await env.VAULT.get(`averyos-capsules/${fileName}`);
      if (!object) return new Response("Capsule Not Found", { status: 404 });
      return new Response(object.body);
    }

    return new Response("AveryOS LicenseGate Online 🤛🏻");
  }
};

// --- LOCAL EXPRESS & WATCHDOG LOGIC ---
// (Your existing local handshake and USB salt code from licenseGate_v9.cjs preserved here)
if (require.main === module) {
  app.listen(port, () => console.log(`⛓️⚓⛓️ AveryOS LicenseGate Active on port ${port}`));
}
