/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * AveryOS Sovereign LicenseGate — Cloudflare Worker
 * Author: Jason Lee Avery (ROOT0)
 * Kernel Anchor: cf83e135...927da3e
 *
 * Handles sovereign license verification at the edge.
 * When a SIG_MISMATCH infraction is detected and logged to KV_LOGS,
 * a non-blocking webhook notification is fired to the Creator via
 * the CREATOR_WEBHOOK_URL environment variable.
 */

const KERNEL_ANCHOR_SHORT = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const INFRACTION_RETENTION_DAYS = 90;

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

/**
 * Non-blocking notification to the Sovereign Creator.
 * Fires a POST to CREATOR_WEBHOOK_URL with the IP and infraction reason.
 * Errors are intentionally swallowed so the handshake failure response remains instant.
 *
 * @param {string} ip      - The connecting IP address
 * @param {string} reason  - The infraction reason (e.g. "SIG_MISMATCH")
 * @param {object} env     - Cloudflare Worker environment bindings
 */
function notifyCreator(ip, reason, env) {
  const webhookUrl = env.CREATOR_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = JSON.stringify({
    event: "LICENSE_INFRACTION",
    ip,
    reason,
    kernel_anchor: KERNEL_ANCHOR_SHORT,
    timestamp: new Date().toISOString(),
  });

  // Fire-and-forget: do NOT await — keeps the response instant
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  }).catch(() => {
    // Intentional no-op: notification failure must not affect license gate response
  });
}

const licenseGateWorker = {
  /**
   * Main Cloudflare Worker fetch handler for the AveryOS LicenseGate.
   *
   * Routes:
   *   POST /api/v1/license-check — Validates the sovereign hardware signature
   *
   * @param {Request} request
   * @param {object}  env       - Cloudflare bindings: DB (D1), KV_LOGS (KV), CREATOR_WEBHOOK_URL
   * @param {object}  ctx       - Cloudflare execution context (provides waitUntil)
   */
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";

    if (pathname === "/api/v1/license-check") {
      if (request.method !== "POST") {
        return Response.json({ error: "Method Not Allowed" }, { status: 405 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const providedSig = typeof body.sig === "string" ? body.sig.trim() : null;
      if (!providedSig) {
        return Response.json(
          { authorized: false, error: "SIG_MISSING" },
          { status: 400 }
        );
      }

      // Retrieve the expected sovereign lock from D1
      let lock = null;
      try {
        lock = await env.DB.prepare(
          "SELECT hardware, sha_anchor FROM kernel_locks WHERE status = 'ACTIVE_ANCHOR' LIMIT 1"
        ).first();
      } catch (err) {
        console.error("⚠️  D1 lookup error:", err);
        return Response.json(
          { authorized: false, error: "DB_ERROR" },
          { status: 500 }
        );
      }

      if (!lock) {
        return Response.json(
          { authorized: false, error: "NO_ACTIVE_LOCK" },
          { status: 403 }
        );
      }

      const expectedSig = `AVERY-SOV-2026-${lock.hardware}`;
      const sigMatch = providedSig === expectedSig;

      if (!sigMatch) {
        // ── SIG_MISMATCH detected ─────────────────────────────────────────────
        const infractionKey = `infraction:sig_mismatch:${ip}:${Date.now()}`;
        const infractionRecord = JSON.stringify({
          event: "SIG_MISMATCH",
          ip,
          provided_sig: providedSig,
          timestamp: new Date().toISOString(),
          kernel_anchor: KERNEL_ANCHOR_SHORT,
        });

        // Log to KV_LOGS (awaited to ensure persistence before responding)
        try {
          await env.KV_LOGS.put(infractionKey, infractionRecord, {
            expirationTtl: 60 * 60 * 24 * INFRACTION_RETENTION_DAYS,
          });
        } catch (err) {
          console.error("⚠️  KV_LOGS write error:", err);
        }

        // Non-blocking webhook notification to the Sovereign Creator
        notifyCreator(ip, "SIG_MISMATCH", env);

        // ── Invisible TARI Insert: RETROCLAIM_STRIKE (fire-and-forget) ────────
        if (env.DB && ctx && ctx.waitUntil) {
          ctx.waitUntil(
            env.DB.prepare(
              "INSERT INTO tari_ledger (event_type, impact_multiplier, trust_premium_index, description) VALUES (?, ?, ?, ?)"
            )
              .bind("RETROCLAIM_STRIKE", 3.0, 0.5, `SIG_MISMATCH from ${sanitizeIp(ip)}`)
              .run()
              .catch(() => {
                // Intentional no-op: ledger write must not affect gate response
              })
          );
        }

        return Response.json(
          {
            authorized: false,
            error: "SIG_MISMATCH",
            directive: "Sovereign license required — contact truth@averyworld.com",
            kernel_anchor: KERNEL_ANCHOR_SHORT,
          },
          {
            status: 402,
            headers: {
              "X-GabrielOS-Block": "ACTIVE",
              "X-AveryOS-Kernel": "ROOT0-EDK-2022-AOS-INIT-SEAL",
            },
          }
        );
      }

      // ── Invisible TARI Insert: HANDSHAKE_SUCCESS (fire-and-forget) ──────────
      if (env.DB && ctx && ctx.waitUntil) {
        ctx.waitUntil(
          env.DB.prepare(
            "INSERT INTO tari_ledger (event_type, impact_multiplier, trust_premium_index, description) VALUES (?, ?, ?, ?)"
          )
            .bind("HANDSHAKE_SUCCESS", 1.0, 0.1, sanitizeIp(ip))
            .run()
            .catch(() => {
              // Intentional no-op: ledger write must not affect gate response
            })
        );
      }

      // Signature matched — sovereign handshake approved
      return Response.json({
        authorized: true,
        hardware: lock.hardware,
        kernel_anchor: KERNEL_ANCHOR_SHORT,
        timestamp: new Date().toISOString(),
      });
    }

    // Unmatched route
    return Response.json({ error: "Not Found" }, { status: 404 });
  },
};

export default licenseGateWorker;
