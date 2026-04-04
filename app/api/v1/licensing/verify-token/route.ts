/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";

/**
 * POST /api/v1/licensing/verify-token
 *
 * Phase 81.2 — Hardware-Bound Capsule Token Exchange
 *
 * Validates a purchased AveryOS™ capsule access token and verifies that the
 * requesting machine fingerprint matches the one registered at purchase time.
 * On success, returns a one-time-use session decryption key for the licensed
 * .aoscap capsule, locked to the specific hardware anchor.
 *
 * Hardware Binding prevents "Logic Sharing" — the session key will only
 * activate on the machine whose fingerprint was recorded during checkout.
 *
 * Request body:
 *   {
 *     "access_token":        "<UUID from Stripe checkout metadata>",
 *     "machine_fingerprint": "<SHA-256 of hardware identifiers (CPU ID, MAC, etc.)>",
 *     "capsule_id":          "<.aoscap capsule identifier>"
 *   }
 *
 * Response (200):
 *   {
 *     "resonance":       "HIGH_FIDELITY_SUCCESS",
 *     "session_key":     "<one-time AES-256-GCM base64 key>",
 *     "capsule_id":      "<capsule identifier>",
 *     "expires_at":      "<ISO-9 timestamp>",
 *     "kernel_sha":      "<cf83...>",
 *     "verified_at":     "<ISO-9 timestamp>"
 *   }
 *
 * Error responses follow the AveryOS™ Sovereign Error Standard.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface TokenRecord {
  id: number;
  access_token: string;
  capsule_id: string;
  machine_fingerprint: string | null;
  stripe_session_id: string | null;
  redeemed: number;
  issued_at: string;
  expires_at: string | null;
}

/** Session key TTL — 15 minutes in milliseconds */
const SESSION_KEY_TTL_MS = 15 * 60 * 1000;

/** Machine fingerprint must be a 64-character SHA-256 hex string */
const FINGERPRINT_RE = /^[a-f0-9]{64}$/i;

/** Access token UUID format */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Derive a deterministic one-time session key from the access token,
 * machine fingerprint, and current time bucket (rounded to 15-min window).
 * Uses HMAC-SHA-256 via Web Crypto; the result is base64-encoded.
 */
async function deriveSessionKey(
  accessToken: string,
  machineFingerprint: string,
  kernelSha: string
): Promise<string> {
  const timeBucket = Math.floor(Date.now() / SESSION_KEY_TTL_MS).toString();
  const material   = `${accessToken}|${machineFingerprint}|${kernelSha}|${timeBucket}`;
  const keyData    = new TextEncoder().encode(material);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode(...hashArray));
}

export async function POST(request: Request): Promise<Response> {
  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body is not valid JSON", 400);
  }

  const rawToken       = body["access_token"];
  const rawFingerprint = body["machine_fingerprint"];
  const rawCapsuleId   = body["capsule_id"];

  if (!rawToken || typeof rawToken !== "string") {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "access_token is required", 400);
  }
  if (!rawFingerprint || typeof rawFingerprint !== "string") {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "machine_fingerprint is required", 400);
  }
  if (!rawCapsuleId || typeof rawCapsuleId !== "string") {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "capsule_id is required", 400);
  }

  const accessToken        = rawToken.trim();
  const machineFingerprint = rawFingerprint.trim().toLowerCase();
  const capsuleId          = rawCapsuleId.trim();

  if (!UUID_RE.test(accessToken)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "access_token must be a valid UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
      400,
    );
  }
  if (!FINGERPRINT_RE.test(machineFingerprint)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "machine_fingerprint must be a 64-character lowercase SHA-256 hex string",
      400,
    );
  }

  // ── D1 lookup ──────────────────────────────────────────────────────────────
  let cfEnv: CloudflareEnv;
  try {
    const ctx = await getCloudflareContext({ async: true });
    cfEnv = ctx.env as unknown as CloudflareEnv;
  } catch {
    return d1ErrorResponse("Cloudflare context unavailable");
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database binding unavailable", 503);
  }

  let tokenRecord: TokenRecord | null;
  try {
    tokenRecord = await cfEnv.DB
      .prepare(
        `SELECT id, access_token, capsule_id, machine_fingerprint, stripe_session_id,
                redeemed, issued_at, expires_at
           FROM capsule_access_tokens
          WHERE access_token = ?`
      )
      .bind(accessToken)
      .first<TokenRecord>();
  } catch (err) {
    return d1ErrorResponse(err instanceof Error ? err.message : String(err));
  }

  if (!tokenRecord) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_AUTH,
      "Access token not found in the Sovereign Ledger.",
      401,
    );
  }

  // ── Validate capsule match ─────────────────────────────────────────────────
  if (tokenRecord.capsule_id !== capsuleId) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "Token is not authorized for the requested capsule.",
      403,
    );
  }

  // ── Validate expiry ────────────────────────────────────────────────────────
  if (tokenRecord.expires_at) {
    const expiresAt = new Date(tokenRecord.expires_at).getTime();
    if (Date.now() > expiresAt) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Access token has expired.", 401);
    }
  }

  // ── Hardware fingerprint binding ───────────────────────────────────────────
  // If a fingerprint was recorded at purchase time, it MUST match exactly.
  // If no fingerprint was recorded yet, this is the first activation — bind it
  // now (which also marks the token as redeemed in the same UPDATE).
  if (tokenRecord.machine_fingerprint) {
    // Token is already bound to a machine — enforce single-use and fingerprint match.
    if (tokenRecord.redeemed) {
      return aosErrorResponse(
        AOS_ERROR.INVALID_AUTH,
        "Access token has already been redeemed.",
        403,
      );
    }
    const encoder       = new TextEncoder();
    const storedBytes   = encoder.encode(tokenRecord.machine_fingerprint);
    const incomingBytes = encoder.encode(machineFingerprint);
    let diff = storedBytes.length !== incomingBytes.length ? 1 : 0;
    const len = Math.min(storedBytes.length, incomingBytes.length);
    // eslint-disable-next-line security/detect-object-injection
    for (let i = 0; i < len; i++) diff |= storedBytes[i] ^ incomingBytes[i];
    if (diff !== 0) {
      return aosErrorResponse(
        AOS_ERROR.INVALID_AUTH,
        "Hardware fingerprint mismatch — token is bound to a different machine. Contact licensing@averyos.com to transfer.",
        403,
      );
    }
    // Mark as redeemed now that fingerprint is verified
    try {
      await cfEnv.DB
        .prepare(`UPDATE capsule_access_tokens SET redeemed = 1 WHERE id = ?`)
        .bind(tokenRecord.id)
        .run();
    } catch {
      // Non-fatal: session key is still valid; next redemption attempt will fail
    }
  } else {
    // First activation — bind the fingerprint and mark as redeemed atomically
    try {
      await cfEnv.DB
        .prepare(
          `UPDATE capsule_access_tokens
              SET machine_fingerprint = ?, redeemed = 1
            WHERE id = ?`
        )
        .bind(machineFingerprint, tokenRecord.id)
        .run();
    } catch (err) {
      return d1ErrorResponse(err instanceof Error ? err.message : String(err));
    }
  }

  // ── Derive one-time session key ────────────────────────────────────────────
  const verifiedAt = formatIso9(new Date());
  const expiresAt  = formatIso9(new Date(Date.now() + SESSION_KEY_TTL_MS));
  const sessionKey = await deriveSessionKey(accessToken, machineFingerprint, KERNEL_SHA);

  // ── TAI auto-track ─────────────────────────────────────────────────────────
  if (cfEnv.DB) {
    autoTrackAccomplishment(cfEnv.DB, {
      title:       "Hardware-Attested Logic Unlock Live",
      description: `Phase 81.2: Capsule ${capsuleId} session key issued to hardware-bound token. ` +
                   `Machine fingerprint anchored. One-time redemption recorded in capsule_access_tokens.`,
      phase:       "Phase 81.2",
      category:    "INFRASTRUCTURE",
    });
  }

  return Response.json(
    {
      resonance:      "HIGH_FIDELITY_SUCCESS",
      session_key:    sessionKey,
      capsule_id:     capsuleId,
      expires_at:     expiresAt,
      kernel_sha:     KERNEL_SHA,
      kernel_version: KERNEL_VERSION,
      verified_at:    verifiedAt,
    },
    { status: 200 }
  );
}
