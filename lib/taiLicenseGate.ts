/**
 * TAI License Gate — AveryOS™ Sovereign Access Control
 *
 * Enforces the legal distinction between:
 *   • PUBLIC WEBSITE VISIT — free, zero cost, no obligation
 *   • LICENSED IP USE — requires a valid TAI™ (Truth Anchored Intelligence)
 *     license key issued by Jason Lee Avery (ROOT0)
 *
 * The Global Truth Resonance Layer endpoint is semi-public:
 *   • Any caller may submit a kernel SHA for basic verification (free).
 *   • Full resonance payload access requires a valid TAI license key supplied
 *     via the `X-TAI-License-Key` request header.
 *
 * License requests: truth@averyworld.com | https://averyos.com/license
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ---------------------------------------------------------------------------
// Constant-time string comparison — prevents timing side-channel attacks
// that could allow brute-forcing secrets character-by-character.
// Returns true only when both strings are equal in length and content.
// ---------------------------------------------------------------------------
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) {
    // Run through the longer array reading both to maintain constant-time behaviour
    const maxLen = Math.max(aBytes.length, bBytes.length);
    for (let i = 0; i < maxLen; i++) {
      // eslint-disable-next-line security/detect-object-injection
      void ((aBytes[i] ?? 0) ^ (bBytes[i] ?? 0));
    }
    return false;
  }
  let diff = 0;
  // eslint-disable-next-line security/detect-object-injection
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// ---------------------------------------------------------------------------
// License tier classification
// ---------------------------------------------------------------------------

export type TaiAccessTier =
  | "PUBLIC"          // No key — basic public verification only
  | "TAI_LICENSED"    // Valid TAI™ or AveryOS IP license key
  | "VAULT_PASSPHRASE"; // Internal sovereign passphrase (VAULT_PASSPHRASE env)

export interface TaiGateResult {
  tier: TaiAccessTier;
  /** true when caller is permitted full resonance payload access */
  fullAccess: boolean;
  /** Reason string for response headers / error bodies */
  reason: string;
}

// ---------------------------------------------------------------------------
// Header name consumed by the resonance endpoint
// ---------------------------------------------------------------------------

export const TAI_LICENSE_HEADER = "x-tai-license-key";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Evaluate the inbound request headers against available credentials and
 * return the caller's access tier.
 *
 * @param headers         - Inbound request headers
 * @param vaultPassphrase - Value of VAULT_PASSPHRASE env secret (may be empty)
 * @param taiLicenseKey   - Value of AVERYOS_LICENSE_KEY env secret (may be empty)
 */
export function evaluateTaiAccess(
  headers: Headers,
  vaultPassphrase: string,
  averyosLicenseKey: string
): TaiGateResult {
  // ── Tier 1: Internal sovereign passphrase ─────────────────────────────────
  const authHeader = headers.get("authorization") ?? "";
  let bearerToken = "";
  if (authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.slice(7).trim();
  } else if (authHeader.startsWith("Handshake ")) {
    bearerToken = authHeader.slice(10).trim();
  }

  if (vaultPassphrase && safeEqual(bearerToken, vaultPassphrase)) {
    return {
      tier: "VAULT_PASSPHRASE",
      fullAccess: true,
      reason: "SOVEREIGN_VAULT_AUTHENTICATED",
    };
  }

  // ── Tier 2: TAI™ / licensed-IP key ────────────────────────────────────────
  // Callers supply the key in the X-TAI-License-Key header.
  // The server secret AVERYOS_LICENSE_KEY is the single accepted value.
  // (In a production multi-tenant system this would validate against a D1
  //  license registry, but a single env secret is the minimal-change approach.)
  const submittedKey = headers.get(TAI_LICENSE_HEADER)?.trim() ?? "";

  if (averyosLicenseKey && safeEqual(submittedKey, averyosLicenseKey)) {
    return {
      tier: "TAI_LICENSED",
      fullAccess: true,
      reason: "TAI_LICENSE_VERIFIED",
    };
  }

  // Submitted a key but it is wrong — return a generic message regardless of
  // whether the key was absent or mismatched to prevent key enumeration.
  if (submittedKey) {
    return {
      tier: "PUBLIC",
      fullAccess: false,
      reason: "AUTH_FAILED — key not recognized. Request a valid TAI™ license at https://averyos.com/license",
    };
  }

  // ── Tier 3: Anonymous / public visitor ────────────────────────────────────
  return {
    tier: "PUBLIC",
    fullAccess: false,
    reason: "NO_LICENSE_KEY — public verification only. To access the full Truth Resonance Layer, obtain a TAI™ license at https://averyos.com/license",
  };
}

// ---------------------------------------------------------------------------
// HTTP response headers appended on every resonance response
// ---------------------------------------------------------------------------

export function resonanceAccessHeaders(result: TaiGateResult): Record<string, string> {
  return {
    "X-AveryOS-IP-Policy": "https://averyos.com/ip-policy",
    "X-AveryOS-License-Required": result.fullAccess ? "SATISFIED" : "REQUIRED",
    "X-AveryOS-Access-Tier": result.tier,
    "X-AveryOS-CreatorLock": "Jason Lee Avery (ROOT0)",
    "X-AveryOS-Notice":
      "Visiting this site is FREE. Using or ingesting this IP requires a license. See https://averyos.com/ip-policy",
  };
}

// ---------------------------------------------------------------------------
// Public-tier response body (stripped — no full sovereign payload)
// ---------------------------------------------------------------------------

export interface PublicResonanceResponse {
  status: "PUBLIC_VERIFICATION_ONLY";
  kernel_verified: boolean;
  kernel_sha_prefix: string;
  kernel_version: string;
  access_tier: "PUBLIC";
  ip_policy: string;
  license_url: string;
  notice: string;
  queried_at: string;
  /** Present when caller supplied ?verify=<sha> */
  sha_verified?: boolean;
  drift_warning?: string;
}
