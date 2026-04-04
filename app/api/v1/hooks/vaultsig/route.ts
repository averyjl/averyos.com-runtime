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
 * POST /api/v1/hooks/vaultsig
 *
 * VaultSig™ GitHub App Webhook Handler — AveryOS™ Phase 111.6 / GATE 111.6.2
 *
 * Receives webhook events from the AveryOS™ VaultSig GitHub App and logs
 * them to D1 for sovereign audit trail and partner misconfiguration detection.
 *
 * Security:
 *   • Validates the GitHub webhook signature via HMAC-SHA256 over the raw body
 *     using the GITHUB_WEBHOOK_SECRET (or VAULT_PASSPHRASE as fallback).
 *   • Returns 200 for all valid payloads — GitHub retries on non-2xx.
 *   • Logs partner misconfiguration events (e.g., 404-causing legacy URLs) to D1.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_VERSION }              from "../../../../../lib/sovereignConstants";
import { formatIso9 }                  from "../../../../../lib/timePrecision";

// ── D1 types ──────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
  GITHUB_WEBHOOK_SECRET?: string;
  VAULT_PASSPHRASE?: string;
}

// ── HMAC-SHA256 signature verification ───────────────────────────────────────

/**
 * Verify GitHub's X-Hub-Signature-256 header.
 * Returns true when the computed HMAC matches the header value.
 */
async function verifyGitHubSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice("sha256=".length);

  const encoder    = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(rawBody));
  const computed = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (computed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    const { env }  = await getCloudflareContext({ async: true });
    const cfEnv    = env as unknown as CloudflareEnv;

    const rawBody  = await request.text();
    const sigHeader = request.headers.get("x-hub-signature-256") ?? "";
    const event     = request.headers.get("x-github-event")       ?? "unknown";
    const deliveryId = request.headers.get("x-github-delivery")   ?? "unknown";

    // ── Signature verification ─────────────────────────────────────────────
    const secret = cfEnv.GITHUB_WEBHOOK_SECRET ?? cfEnv.VAULT_PASSPHRASE ?? "";
    if (secret) {
      const valid = await verifyGitHubSignature(rawBody, sigHeader, secret);
      if (!valid) {
        return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Invalid webhook signature — possible replay or misconfiguration.");
      }
    }

    // ── Parse payload ──────────────────────────────────────────────────────
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      // Non-JSON payload — still log the event type
    }

    const sender = (payload.sender as Record<string, unknown> | undefined)?.login ?? "unknown";
    const action = typeof payload.action === "string" ? payload.action : "unknown";

    // ── D1 audit log ───────────────────────────────────────────────────────
    if (cfEnv.DB) {
      const ts = formatIso9();
      await cfEnv.DB.prepare(
        `CREATE TABLE IF NOT EXISTS vaultsig_webhook_log (
           id          INTEGER PRIMARY KEY AUTOINCREMENT,
           delivery_id TEXT    NOT NULL,
           event_type  TEXT    NOT NULL,
           action      TEXT,
           sender      TEXT,
           logged_at   TEXT    NOT NULL,
           kernel      TEXT    NOT NULL
         )`
      ).run();

      await cfEnv.DB.prepare(
        `INSERT INTO vaultsig_webhook_log
           (delivery_id, event_type, action, sender, logged_at, kernel)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(deliveryId, event, action, sender, ts, KERNEL_VERSION)
        .run();
    }

    return Response.json(
      {
        received: true,
        event,
        delivery_id: deliveryId,
        anchor: "⛓️⚓⛓️",
        kernel: KERNEL_VERSION,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
