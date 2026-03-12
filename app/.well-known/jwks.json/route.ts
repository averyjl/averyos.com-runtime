/**
 * GET /.well-known/jwks.json
 *
 * OIDC JWKS Endpoint — AveryOS™ Phase 106 / Roadmap Gate 1.4
 *
 * Serves the AveryOS™ public signing key (JSON Web Key Set) to complete the
 * OIDC discovery document.  The `jwks_uri` field in the OIDC discovery
 * document at /.well-known/openid-configuration points here.
 *
 * The JWKS contains the RS256 public key used to verify AveryOS™ sovereign
 * tokens and affidavit signatures. When a private key is not configured,
 * returns a "PENDING_KEYS" manifest to allow graceful fallback.
 *
 * Enterprise consumers (Azure MDM, Google Cloud, etc.) may cache this
 * document; Cache-Control is set to max-age=3600 (1 hour).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }     from "@opennextjs/cloudflare";
import { getSovereignKeys }         from "../../../lib/security/keys";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";

// ── JWK construction helpers ──────────────────────────────────────────────────

/**
 * Convert a CryptoKey (RSA-PSS or RSASSA-PKCS1-v1_5 public key) to JWK format.
 * Returns null if the key cannot be exported.
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

  // ── Resolve key pair via the sovereign key loader ─────────────────────────
  const keyPair = await getSovereignKeys({
    AVERYOS_PRIVATE_KEY_B64: cfEnv.AVERYOS_PRIVATE_KEY_B64,
    AVERYOS_PUBLIC_KEY_B64:  cfEnv.AVERYOS_PUBLIC_KEY_B64,
  });

  // ── Build JWKS ────────────────────────────────────────────────────────────
  let jwks: { keys: (JsonWebKey & { kid: string; use: string; alg: string })[] };

  if (keyPair.publicKey) {
    const jwk = await cryptoKeyToJwk(keyPair.publicKey);

    if (jwk) {
      // Decorate with JWKS standard fields
      jwks = {
        keys: [{
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
        } as JsonWebKey & { kid: string; use: string; alg: string }],
      };
    } else {
      // Key export failed — return pending manifest
      jwks = buildPendingJwks(request);
    }
  } else {
    // No key configured — return pending manifest with sovereign anchor
    jwks = buildPendingJwks(request);
  }

  const baseUrl = new URL(request.url).origin;

  return new Response(JSON.stringify(jwks, null, 2), {
    status: 200,
    headers: {
      "Content-Type":                "application/json",
      // JWKS documents may be cached; 1-hour max-age is standard
      "Cache-Control":               "public, max-age=3600",
      "X-AveryOS-Kernel":            KERNEL_VERSION,
      "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
      "X-JWKS-Issuer":               baseUrl,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ── Pending-key manifest ──────────────────────────────────────────────────────

function buildPendingJwks(
  request: Request,
): { keys: (JsonWebKey & { kid: string; use: string; alg: string })[] } {
  const baseUrl = new URL(request.url).origin;
  return {
    keys: [
      {
        // Placeholder JWK — no actual key material
        kty: "RSA",
        use: "sig",
        alg: "RS256",
        kid: `averyos-sovereign-key-${KERNEL_VERSION}`,
        // Indicate that the key is pending deployment
        "x-averyos-status":         "PENDING_KEY_DEPLOYMENT",
        "x-averyos-kernel-sha":     KERNEL_SHA,
        "x-averyos-kernel-version": KERNEL_VERSION,
        "x-averyos-creator":        "Jason Lee Avery (ROOT0) 🤛🏻",
        "x-averyos-anchor":         "⛓️⚓⛓️",
        "x-averyos-contact":        `${baseUrl}/licensing/enterprise`,
        "x-averyos-note":
          "Key material pending deployment. Set AVERYOS_PUBLIC_KEY_B64 or " +
          "AVERYOS_PUBLIC_KEY in Cloudflare secrets to activate sovereign signing.",
      } as unknown as JsonWebKey & { kid: string; use: string; alg: string },
    ],
  };
}
