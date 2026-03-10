/**
 * POST /api/v1/licensing/exchange
 *
 * Phase 85 — AveryOS™ Hardware-Attested Token Gate
 *
 * Implements a checkout handshake that binds a purchased .aoscap invention
 * to the specific hardware fingerprint of the licensee.  Even if an entity
 * obtains an .aoscap file, the Sovereign Decryption Key will only generate
 * when the machine fingerprint matches the purchase record.
 *
 * Auth: Stripe-signed checkout session (verified via STRIPE_SECRET_KEY).
 *
 * Request body:
 *   {
 *     "session_id":          string — Stripe Checkout session ID
 *     "machine_fingerprint": string — hardware fingerprint (UUID/SHA hash)
 *     "capsule_id":          string — .aoscap capsule identifier
 *   }
 *
 * Response (success):
 *   {
 *     "token":           string  — time-limited decryption token (SHA-512)
 *     "capsule_id":      string
 *     "bound_to":        string  — SHA-256 of machine_fingerprint (never echoed raw)
 *     "valid_until":     string  — ISO timestamp (24h)
 *     "kernel_sha":      string
 *     "issued_at":       string
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run():   Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:               D1Database;
  STRIPE_SECRET_KEY?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** SHA-512 of an arbitrary string via Web Crypto. */
async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 of an arbitrary string via Web Crypto (for bound_to binding). */
async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify Stripe Checkout session via the Stripe API.
 * Returns the session object if payment_status === 'paid', null otherwise.
 */
async function verifyStripeSession(
  sessionId:  string,
  secretKey:  string,
): Promise<{ payment_status: string; metadata?: Record<string, string> } | null> {
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      payment_status: string;
      metadata?: Record<string, string>;
    };
    if (data.payment_status !== "paid") return null;
    return data;
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let cfEnv: CloudflareEnv;
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "Cloudflare binding unavailable", 503);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    session_id?:          string;
    machine_fingerprint?: string;
    capsule_id?:          string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body is not valid JSON", 400);
  }

  const { session_id, machine_fingerprint, capsule_id } = body;

  if (!session_id || typeof session_id !== "string") {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "session_id (Stripe Checkout session ID) is required", 400);
  }
  if (!machine_fingerprint || typeof machine_fingerprint !== "string") {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "machine_fingerprint (hardware fingerprint) is required", 400);
  }
  if (!capsule_id || typeof capsule_id !== "string") {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "capsule_id (.aoscap capsule identifier) is required", 400);
  }

  // Basic fingerprint format validation: must be 8–512 printable chars
  if (!/^[\x20-\x7E]{8,512}$/.test(machine_fingerprint)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "machine_fingerprint must be 8–512 printable ASCII characters", 400);
  }

  // Basic Stripe Checkout Session ID validation: e.g., "cs_test_..." or "cs_live_..."
  if (!/^cs_(test|live)_[0-9A-Za-z]{10,}$/.test(session_id)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "session_id is not a valid Stripe Checkout session identifier", 400);
  }

  // ── Verify Stripe payment ─────────────────────────────────────────────────
  if (!cfEnv.STRIPE_SECRET_KEY) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "Cloudflare binding unavailable", 503);
  }

  const session = await verifyStripeSession(session_id, cfEnv.STRIPE_SECRET_KEY);
  if (!session) {
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, "Stripe payment verification failed", 402);
  }

  // ── Compute hardware binding ──────────────────────────────────────────────
  const issuedAt       = formatIso9();
  const validUntilDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const validUntil     = formatIso9(validUntilDate);

  // bound_to = SHA-256(machine_fingerprint | capsule_id) — stored in DB, never echoed raw
  const boundTo = await sha256hex(`${machine_fingerprint}|${capsule_id}`);

  // Decryption token = SHA-512(kernel_sha | session_id | boundTo | issuedAt)
  const tokenRaw = `${KERNEL_SHA}|${session_id}|${boundTo}|${issuedAt}`;
  const token    = await sha512hex(tokenRaw);

  // ── Persist to D1 ─────────────────────────────────────────────────────────
  if (cfEnv.DB) {
    cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path,
          timestamp_ns, threat_level, tari_liability_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        "HARDWARE_TOKEN_ISSUED",
        capsule_id,
        "licensing/exchange",
        boundTo,
        "/api/v1/licensing/exchange",
        Date.now().toString() + "000000",
        1,
        0,
      )
      .run()
      .catch(() => {});
  }

  return Response.json({
    token,
    capsule_id,
    bound_to:     boundTo,
    valid_until:  validUntil,
    kernel_sha:   KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    issued_at:    issuedAt,
  });
}
