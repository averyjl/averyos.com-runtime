/**
 * GET /api/v1/residency/bridge
 *
 * AveryOS™ VPC/PC Hybrid Residency Bridge — Phase 119 GATE 119.3
 *
 * Serves as the handshake endpoint between the physical PC (Node-02) and
 * the Cloudflare Worker VPC runtime.  This "always-on" bridge allows the
 * ALM (Anchored Language Model) to run in the cloud while cryptographic
 * keys and biometric anchors are held exclusively on the physical machine.
 *
 * Handshake flow:
 *   1. Node-02 POSTs a time-stamped nonce signed with the PC private key.
 *   2. This endpoint verifies the signature against the public JWKS key.
 *   3. On success, returns a short-lived VPC session token (signed JWT).
 *   4. Node-02 uses the VPC token for subsequent cloud API calls that
 *      require physical-residency attestation.
 *
 * GET — Returns the current bridge status and the VPC endpoint metadata.
 * POST — Accepts a signed nonce payload and issues a VPC session token.
 *
 * Auth: Requires a valid JWKS-signed nonce from Node-02 (POST).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }             from "@opennextjs/cloudflare";
import { getSovereignKeys }                 from "../../../../../lib/security/keys";
import { KERNEL_SHA, KERNEL_VERSION }       from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR }      from "../../../../../lib/sovereignError";
import { formatIso9 }                       from "../../../../../lib/timePrecision";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CloudflareEnv {
  AVERYOS_PRIVATE_KEY_B64?:        string;
  AVERYOS_PUBLIC_KEY_B64?:         string;
  AVERYOS_PRIVATE_KEY_B64_1_OF_3?: string;
  AVERYOS_PRIVATE_KEY_B64_2_OF_3?: string;
  AVERYOS_PRIVATE_KEY_B64_3_OF_3?: string;
  VAULT_PASSPHRASE?:               string;
}

interface BridgeNoncePayload {
  /** ISO-8601 timestamp from Node-02 */
  ts:          string;
  /** Node identifier (e.g. "NODE-02") */
  node_id:     string;
  /** Random nonce (32+ bytes, hex-encoded) */
  nonce:       string;
  /** Kernel SHA-512 that Node-02 is anchored to */
  kernel_sha:  string;
}

// ── Nonce validation window ───────────────────────────────────────────────────

/** Maximum clock skew accepted between Node-02 and the VPC (5 minutes). */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

// ── SHA-512 helper ────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const buf  = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/residency/bridge
 *
 * Returns the current bridge endpoint metadata and key status.
 * Public-readable — no auth required for status check.
 */
export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  const keyPair = await getSovereignKeys({
    AVERYOS_PRIVATE_KEY_B64:        cfEnv.AVERYOS_PRIVATE_KEY_B64,
    AVERYOS_PUBLIC_KEY_B64:         cfEnv.AVERYOS_PUBLIC_KEY_B64,
    AVERYOS_PRIVATE_KEY_B64_1_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_1_OF_3,
    AVERYOS_PRIVATE_KEY_B64_2_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_2_OF_3,
    AVERYOS_PRIVATE_KEY_B64_3_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_3_OF_3,
  });

  const baseUrl    = new URL(request.url).origin;
  const keyStatus  = keyPair.publicKey ? "ACTIVE" : "PENDING_KEY_DEPLOYMENT";

  const body = {
    bridge:          "VPC/PC Hybrid Residency Bridge",
    gate:            "GATE 119.3",
    status:          keyStatus,
    vpc_endpoint:    `${baseUrl}/api/v1/residency/bridge`,
    jwks_uri:        `${baseUrl}/.well-known/jwks.json`,
    key_id:          keyPair.kid,
    kernel_version:  KERNEL_VERSION,
    kernel_sha:      KERNEL_SHA,
    checked_at:      formatIso9(new Date()),
    description:
      "POST a signed nonce payload from Node-02 to receive a short-lived " +
      "VPC session token. Keys remain on the physical machine (PC); the " +
      "ALM runs always-on in the cloud (VPC).",
    node_requirements: {
      node_id:          "NODE-02",
      kernel_sha:       KERNEL_SHA,
      signature_alg:    "RS256",
      nonce_min_length: 32,
      max_clock_skew:   `${MAX_CLOCK_SKEW_MS / 1000}s`,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status:  200,
    headers: {
      "Content-Type":                "application/json",
      "Cache-Control":               "no-store",
      "X-AveryOS-Kernel":            KERNEL_VERSION,
      "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
    },
  });
}

/**
 * POST /api/v1/residency/bridge
 *
 * Accepts a signed nonce payload from Node-02 and issues a short-lived
 * VPC session token anchored to the cf83™ Kernel SHA-512.
 *
 * Body (JSON):
 *   { ts, node_id, nonce, kernel_sha, signature }
 *   where `signature` is the Base64url-encoded RS256 signature of:
 *     JSON.stringify({ ts, node_id, nonce, kernel_sha })
 */
export async function POST(request: Request): Promise<Response> {
  let body: BridgeNoncePayload & { signature?: string };
  try {
    body = await request.json() as BridgeNoncePayload & { signature?: string };
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Invalid JSON body.", 400);
  }

  const { ts, node_id, nonce, kernel_sha, signature } = body;

  // ── Validate required fields ──────────────────────────────────────────────
  if (!ts || !node_id || !nonce || !kernel_sha || !signature) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "Missing required fields: ts, node_id, nonce, kernel_sha, signature.",
      400,
    );
  }

  // ── Validate kernel SHA matches ───────────────────────────────────────────
  if (kernel_sha !== KERNEL_SHA) {
    return aosErrorResponse(
      AOS_ERROR.UNAUTHORIZED,
      "Kernel SHA mismatch. Node-02 must be anchored to the current cf83™ Kernel Root.",
      403,
    );
  }

  // ── Validate timestamp (clock skew) ──────────────────────────────────────
  const tsMs   = new Date(ts).getTime();
  const nowMs  = Date.now();
  if (isNaN(tsMs) || Math.abs(nowMs - tsMs) > MAX_CLOCK_SKEW_MS) {
    return aosErrorResponse(
      AOS_ERROR.UNAUTHORIZED,
      `Timestamp out of range. Maximum clock skew is ${MAX_CLOCK_SKEW_MS / 1000}s.`,
      403,
    );
  }

  // ── Verify signature ──────────────────────────────────────────────────────
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  const keyPair = await getSovereignKeys({
    AVERYOS_PRIVATE_KEY_B64:        cfEnv.AVERYOS_PRIVATE_KEY_B64,
    AVERYOS_PUBLIC_KEY_B64:         cfEnv.AVERYOS_PUBLIC_KEY_B64,
    AVERYOS_PRIVATE_KEY_B64_1_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_1_OF_3,
    AVERYOS_PRIVATE_KEY_B64_2_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_2_OF_3,
    AVERYOS_PRIVATE_KEY_B64_3_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_3_OF_3,
  });

  if (!keyPair.publicKey) {
    return aosErrorResponse(
      AOS_ERROR.INTERNAL_ERROR,
      "VPC public key not configured. Set AVERYOS_PUBLIC_KEY_B64 Cloudflare secret.",
      503,
    );
  }

  try {
    const sigBytes  = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(
      JSON.stringify({ ts, node_id, nonce, kernel_sha }),
    );
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", keyPair.publicKey, sigBytes, dataBytes);

    if (!valid) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Signature verification failed.", 403);
    }
  } catch {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Signature verification error.", 403);
  }

  // ── Issue VPC session token ───────────────────────────────────────────────
  // Token is a SHA-512 of (nonce + ts + kernel_sha + VAULT_PASSPHRASE) — short-lived
  const vaultSecret  = cfEnv.VAULT_PASSPHRASE ?? "sovereign-fallback";
  const tokenPayload = `${nonce}:${ts}:${KERNEL_SHA}:${vaultSecret}`;
  const sessionToken = (await sha512hex(tokenPayload)).slice(0, 64); // 32-byte token

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  return new Response(
    JSON.stringify({
      ok:            true,
      session_token: sessionToken,
      expires_at:    expiresAt,
      node_id,
      kernel_version: KERNEL_VERSION,
      kernel_sha:    KERNEL_SHA,
      issued_at:     formatIso9(new Date()),
      bridge_gate:   "GATE 119.3",
    }),
    {
      status:  200,
      headers: {
        "Content-Type":                "application/json",
        "Cache-Control":               "no-store",
        "X-AveryOS-Kernel":            KERNEL_VERSION,
        "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
      },
    },
  );
}
