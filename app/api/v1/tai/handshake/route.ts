/**
 * POST /api/v1/tai/handshake
 *
 * TAI™ Network Handshake — Phase 94.1
 *
 * Validates an AVERYOS_LICENSE_KEY and returns a time-limited Sovereign Pulse Token
 * that authorises a remote AI Studio Gem to POST forensic insights to the D1
 * Sovereign Audit Logs via /api/v1/tai/sync.
 *
 * Request body (JSON):
 *   { license_key: string }
 *
 * On success:
 *   Returns a Sovereign Pulse Token (SPT) valid for 24 hours, a SHA-512
 *   handshake seal anchored to KERNEL_SHA, and the kernel metadata.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

interface CloudflareEnv {
  TAI_LICENSE_KEY?:     string;
  AVERYOS_LICENSE_KEY?: string;
  TAI_SENTINEL_TOKEN?:  string;
}

/** Constant-time comparison to avoid timing-based token enumeration. */
/** Token TTL: 24 hours */
const SPT_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const licenseKeySecret   = cfEnv.AVERYOS_LICENSE_KEY ?? cfEnv.TAI_LICENSE_KEY ?? "";
    const sentinelTokenSecret = cfEnv.TAI_SENTINEL_TOKEN ?? "";

    if (!licenseKeySecret || !sentinelTokenSecret) {
      return aosErrorResponse(
        AOS_ERROR.VAULT_NOT_CONFIGURED,
        "AVERYOS_LICENSE_KEY or TAI_SENTINEL_TOKEN is not configured on this Worker.",
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: { license_key?: unknown };
    try {
      body = await request.json() as { license_key?: unknown };
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
    }

    const providedKey = typeof body.license_key === "string" ? body.license_key.trim() : "";
    if (!providedKey) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "Field 'license_key' is required.");
    }

    if (!safeEqual(providedKey, licenseKeySecret)) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Invalid AVERYOS_LICENSE_KEY.");
    }

    // ── Issue Sovereign Pulse Token ───────────────────────────────────────────
    const now        = Date.now();
    const expiresAt  = new Date(now + SPT_TTL_MS);
    const issuedAt   = formatIso9(new Date(now));
    const expiresStr = formatIso9(expiresAt);

    // Derive the SPT using HMAC-SHA512 with the sentinel token as the key.
    // This is resistant to brute-force even if the expiry and KERNEL_SHA are known.
    const sptKeyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(sentinelTokenSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const sptData    = new TextEncoder().encode(`spt:${KERNEL_SHA}:${expiresAt.toISOString()}`);
    const sptSig     = await crypto.subtle.sign("HMAC", sptKeyMaterial, sptData);
    const sptHex     = Array.from(new Uint8Array(sptSig)).map(b => b.toString(16).padStart(2, "0")).join("");

    // ── Build handshake seal ──────────────────────────────────────────────────
    const sealPayload = JSON.stringify({
      issued_at:       issuedAt,
      expires_at:      expiresStr,
      kernel_sha:      KERNEL_SHA,
      kernel_version:  KERNEL_VERSION,
      spt_prefix:      sptHex.slice(0, 16),
    });
    const sealDigest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(sealPayload + KERNEL_SHA));
    const sealHex    = Array.from(new Uint8Array(sealDigest)).map(b => b.toString(16).padStart(2, "0")).join("");

    return Response.json({
      resonance:        "HANDSHAKE_COMPLETE",
      sovereign_pulse_token: sptHex,
      token_type:       "Bearer",
      issued_at:        issuedAt,
      expires_at:       expiresStr,
      ttl_seconds:      SPT_TTL_MS / 1000,
      sync_endpoint:    "/api/v1/tai/sync",
      usage:            "Use this token as: Authorization: Bearer <sovereign_pulse_token> on POST /api/v1/tai/sync",
      handshake_seal:   sealHex,
      kernel_version:   KERNEL_VERSION,
      kernel_anchor:    `${KERNEL_SHA.slice(0, 16)}…${KERNEL_SHA.slice(-8)}`,
    });
  } catch (err: unknown) {
    console.error("[TAI_HANDSHAKE] Unexpected error:", err instanceof Error ? err.message : String(err));
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, "An unexpected error occurred in the TAI Handshake endpoint.");
  }
}
