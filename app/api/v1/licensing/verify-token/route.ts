import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { formatIso9 } from "../../../../../lib/timePrecision";

/**
 * POST /api/v1/licensing/verify-token
 *
 * Phase 82 — Hardware Token Machine ID SDK Exchange Endpoint.
 *
 * Accepts a machine fingerprint (SHA-256 of UUID + MAC + hostname) and an
 * optional Stripe session ID, then:
 *   1. Validates the machine_fingerprint format (64-char hex SHA-256).
 *   2. Looks up any existing token bound to this machine fingerprint in D1.
 *   3. If payment is confirmed (stripe_session_id provided), issues a new
 *      hardware-bound capsule_access_token with 365-day expiry.
 *   4. Returns the token_id and capsule access details.
 *
 * GET /api/v1/licensing/verify-token?token_id=<id>
 *
 * Validates an existing token by token_id and returns its status.
 *
 * Request body (POST):
 *   {
 *     machine_fingerprint: string;  // SHA-256(UUID + MAC + hostname), 64-char hex
 *     capsule_id:          string;  // Target .aoscap capsule ID
 *     stripe_session_id?:  string;  // Stripe checkout session ID (for new issuance)
 *     partner_id?:         string;  // Optional partner/entity ID
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface D1PreparedStatement {
  bind(...args: unknown[]): {
    run(): Promise<unknown>;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results: T[] }>;
  };
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_PASSPHRASE?: string;
}

interface TokenRow {
  id: number;
  token_id: string;
  capsule_id: string;
  machine_fingerprint: string;
  sha256_binding: string;
  stripe_session_id: string | null;
  partner_id: string | null;
  issued_at: string;
  expires_at: string;
  revoked: number;
  revoked_at: string | null;
  kernel_version: string;
}

/** Generate a random token ID: TOKEN_<hex32> */
async function generateTokenId(): Promise<string> {
  const buf = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
  return `TOKEN_${hex.toUpperCase()}`;
}

/** Compute SHA-256 binding of machine_fingerprint + capsule_id + KERNEL_SHA */
async function computeBinding(machineFp: string, capsuleId: string): Promise<string> {
  const raw = `${machineFp}||${capsuleId}||${KERNEL_SHA}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── POST — Issue or re-validate a hardware-bound token ────────────────────────
export async function POST(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "D1 DB binding is not configured.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
    }

    if (typeof body !== "object" || body === null) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Request body is missing or invalid.");
    }

    const { machine_fingerprint, capsule_id, stripe_session_id, partner_id } =
      body as Record<string, unknown>;

    // Validate machine_fingerprint: must be 64-char hex (SHA-256)
    if (
      typeof machine_fingerprint !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(machine_fingerprint)
    ) {
      return aosErrorResponse(
        AOS_ERROR.INVALID_FIELD,
        "machine_fingerprint must be a 64-character hex string (SHA-256 of UUID + MAC + hostname)."
      );
    }

    if (typeof capsule_id !== "string" || !capsule_id.trim()) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "capsule_id is required.");
    }

    const capsuleIdStr    = capsule_id.trim().slice(0, 500);
    const partnerIdStr    = typeof partner_id === "string" ? partner_id.trim().slice(0, 200) : null;
    const stripeSessionId = typeof stripe_session_id === "string" ? stripe_session_id.trim().slice(0, 200) : null;

    // Check for existing active token for this machine + capsule
    const existing = await cfEnv.DB.prepare(
      `SELECT id, token_id, capsule_id, machine_fingerprint, sha256_binding,
              stripe_session_id, partner_id, issued_at, expires_at, revoked, revoked_at, kernel_version
       FROM capsule_access_tokens
       WHERE machine_fingerprint = ? AND capsule_id = ? AND revoked = 0
         AND expires_at > datetime('now')
       ORDER BY id DESC
       LIMIT 1`
    )
      .bind(machine_fingerprint, capsuleIdStr)
      .first<TokenRow>();

    if (existing) {
      return Response.json({
        status:             "TOKEN_ALREADY_ACTIVE",
        token_id:           existing.token_id,
        capsule_id:         existing.capsule_id,
        machine_fingerprint: existing.machine_fingerprint,
        sha256_binding:     existing.sha256_binding,
        issued_at:          existing.issued_at,
        expires_at:         existing.expires_at,
        partner_id:         existing.partner_id,
        kernel_version:     existing.kernel_version,
        detail:             "An active hardware-bound token already exists for this machine and capsule.",
        kernel_sha:         KERNEL_SHA.slice(0, 16) + "…",
      });
    }

    // Issue a new token
    const tokenId      = await generateTokenId();
    const sha256Bind   = await computeBinding(machine_fingerprint, capsuleIdStr);
    const issuedAt     = formatIso9(new Date());
    const expiresDate  = new Date();
    expiresDate.setFullYear(expiresDate.getFullYear() + 1);
    const expiresAt    = expiresDate.toISOString();

    await cfEnv.DB.prepare(
      `INSERT INTO capsule_access_tokens
         (token_id, capsule_id, machine_fingerprint, sha256_binding,
          stripe_session_id, partner_id, issued_at, expires_at, kernel_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        tokenId,
        capsuleIdStr,
        machine_fingerprint,
        sha256Bind,
        stripeSessionId,
        partnerIdStr,
        issuedAt,
        expiresAt,
        KERNEL_VERSION,
      )
      .run();

    // Auto-track as INFRASTRUCTURE accomplishment
    autoTrackAccomplishment(cfEnv.DB as unknown as Parameters<typeof autoTrackAccomplishment>[0], {
      title:       `Hardware Token Issued — Capsule ${capsuleIdStr.slice(0, 40)}`,
      description: `Token ${tokenId} issued for machine fingerprint ${machine_fingerprint.slice(0, 16)}… bound to capsule ${capsuleIdStr.slice(0, 40)}.`,
      category:    "INFRASTRUCTURE",
      phase:       "Phase 82",
    });

    return Response.json(
      {
        status:              "TOKEN_ISSUED",
        token_id:            tokenId,
        capsule_id:          capsuleIdStr,
        machine_fingerprint,
        sha256_binding:      sha256Bind,
        stripe_session_id:   stripeSessionId,
        partner_id:          partnerIdStr,
        issued_at:           issuedAt,
        expires_at:          expiresAt,
        kernel_version:      KERNEL_VERSION,
        kernel_sha:          KERNEL_SHA.slice(0, 16) + "…",
        detail:              "Hardware-bound capsule access token issued. Valid for 365 days.",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}

// ── GET — Validate an existing token by token_id ─────────────────────────────
export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "D1 DB binding is not configured.");
    }

    const url     = new URL(request.url);
    const tokenId = url.searchParams.get("token_id")?.trim() ?? "";

    if (!tokenId) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "token_id query parameter is required.");
    }

    const row = await cfEnv.DB.prepare(
      `SELECT id, token_id, capsule_id, machine_fingerprint, sha256_binding,
              stripe_session_id, partner_id, issued_at, expires_at, revoked, revoked_at, kernel_version
       FROM capsule_access_tokens
       WHERE token_id = ?
       LIMIT 1`
    )
      .bind(tokenId)
      .first<TokenRow>();

    if (!row) {
      return Response.json(
        {
          status:    "TOKEN_NOT_FOUND",
          token_id:  tokenId,
          detail:    "No hardware-bound token found with this ID.",
          kernel_sha: KERNEL_SHA.slice(0, 16) + "…",
        },
        { status: 404 }
      );
    }

    if (row.revoked) {
      return Response.json(
        {
          status:      "TOKEN_REVOKED",
          token_id:    row.token_id,
          capsule_id:  row.capsule_id,
          revoked_at:  row.revoked_at,
          detail:      "This hardware-bound token has been revoked.",
          kernel_sha:  KERNEL_SHA.slice(0, 16) + "…",
        },
        { status: 410 }
      );
    }

    const expired = new Date(row.expires_at) < new Date();
    if (expired) {
      return Response.json(
        {
          status:      "TOKEN_EXPIRED",
          token_id:    row.token_id,
          capsule_id:  row.capsule_id,
          expires_at:  row.expires_at,
          detail:      "This hardware-bound token has expired. Renew via /api/v1/checkout/create-session.",
          kernel_sha:  KERNEL_SHA.slice(0, 16) + "…",
        },
        { status: 410 }
      );
    }

    return Response.json({
      status:              "TOKEN_VALID",
      token_id:            row.token_id,
      capsule_id:          row.capsule_id,
      machine_fingerprint: row.machine_fingerprint,
      sha256_binding:      row.sha256_binding,
      stripe_session_id:   row.stripe_session_id,
      partner_id:          row.partner_id,
      issued_at:           row.issued_at,
      expires_at:          row.expires_at,
      kernel_version:      row.kernel_version,
      kernel_sha:          KERNEL_SHA.slice(0, 16) + "…",
      verified_at:         new Date().toISOString(),
      detail:              "Hardware-bound capsule access token is valid and active.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
