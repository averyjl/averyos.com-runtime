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
 * GET /api/v1/jwks
 *
 * Sovereign JWKS Hardlock Endpoint — AveryOS™ Phase 109.3 / GATE 109.3.2
 *
 * Returns the AveryOS™ RS256 public signing key in JSON Web Key Set format.
 * Loads key material via `getSovereignKeys()` (lib/security/keys.ts) which
 * reads `AVERYOS_PUBLIC_KEY_B64` (and optionally `AVERYOS_PRIVATE_KEY_B64`)
 * from Cloudflare secrets.
 *
 * When key material is present and successfully parsed, the response body
 * includes `"x-averyos-status": "ACTIVE"` and the canonical key ID
 * `averyos-sovereign-key-v3.6.2`.  When key material is absent or malformed,
 * the endpoint returns a `PENDING_KEY_DEPLOYMENT` placeholder so that
 * consumers can handle the unactivated state gracefully.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }     from "@opennextjs/cloudflare";
import { getSovereignKeys }         from "../../../../lib/security/keys";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Export a CryptoKey to JWK format.  Returns null on failure.
 */
async function cryptoKeyToJwk(key: CryptoKey): Promise<JsonWebKey | null> {
  try {
    return await crypto.subtle.exportKey("jwk", key);
  } catch {
    return null;
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as Record<string, string | undefined>;

  // GATE 111.6.1 — pass all triple-part keys so JWKS shows ACTIVE with split-key protocol
  const keyPair = await getSovereignKeys({
    AVERYOS_PRIVATE_KEY_B64:        cfEnv.AVERYOS_PRIVATE_KEY_B64,
    AVERYOS_PUBLIC_KEY_B64:         cfEnv.AVERYOS_PUBLIC_KEY_B64,
    AVERYOS_PRIVATE_KEY_B64_1_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_1_OF_3,
    AVERYOS_PRIVATE_KEY_B64_2_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_2_OF_3,
    AVERYOS_PRIVATE_KEY_B64_3_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_3_OF_3,
  });

  const baseUrl = new URL(request.url).origin;

  // ── Active path — key material loaded ─────────────────────────────────────
  if (keyPair.active && keyPair.publicKey) {
    const jwk = await cryptoKeyToJwk(keyPair.publicKey);

    if (jwk) {
      const jwks = {
        keys: [
          {
            ...jwk,
            kid: keyPair.kid,
            use: "sig",
            alg: "RS256",
            // AveryOS™ sovereign extensions
            "x-averyos-status":         "ACTIVE",
            "x-averyos-kernel-sha":     KERNEL_SHA,
            "x-averyos-kernel-version": KERNEL_VERSION,
            "x-averyos-creator":        "Jason Lee Avery (ROOT0) 🤛🏻",
            "x-averyos-anchor":         "⛓️⚓⛓️",
          } as JsonWebKey & { kid: string; use: string; alg: string },
        ],
      };

      return new Response(JSON.stringify(jwks, null, 2), {
        status: 200,
        headers: buildHeaders(baseUrl),
      });
    }
  }

  // ── Pending path — no usable key material ─────────────────────────────────
  const jwks = {
    keys: [
      {
        kty: "RSA",
        use: "sig",
        alg: "RS256",
        kid: keyPair.kid,
        "x-averyos-status":         "PENDING_KEY_DEPLOYMENT",
        "x-averyos-kernel-sha":     KERNEL_SHA,
        "x-averyos-kernel-version": KERNEL_VERSION,
        "x-averyos-creator":        "Jason Lee Avery (ROOT0) 🤛🏻",
        "x-averyos-anchor":         "⛓️⚓⛓️",
        "x-averyos-contact":        `${baseUrl}/licensing/enterprise`,
        "x-averyos-note":
          "Key material pending deployment. Set AVERYOS_PUBLIC_KEY_B64 and " +
          "AVERYOS_PRIVATE_KEY_B64 in Cloudflare secrets to activate sovereign signing.",
      } as unknown as JsonWebKey & { kid: string; use: string; alg: string },
    ],
  };

  return new Response(JSON.stringify(jwks, null, 2), {
    status: 200,
    headers: buildHeaders(baseUrl),
  });
}

// ── Shared response headers ───────────────────────────────────────────────────

function buildHeaders(baseUrl: string): Record<string, string> {
  return {
    "Content-Type":                "application/json",
    "Cache-Control":               "public, max-age=3600",
    "X-AveryOS-Kernel":            KERNEL_VERSION,
    "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
    "X-JWKS-Issuer":               baseUrl,
    "Access-Control-Allow-Origin": "*",
  };
}
