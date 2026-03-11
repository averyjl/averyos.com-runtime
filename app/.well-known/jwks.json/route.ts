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

import { getCloudflareContext }   from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";

// ── Local types ───────────────────────────────────────────────────────────────

interface CloudflareEnv {
  /** Base64-encoded RSA public key PEM for the AveryOS™ signing key. */
  AVERYOS_PUBLIC_KEY_B64?: string;
  /** Raw PEM RSA public key (alternative to B64 version). */
  AVERYOS_PUBLIC_KEY?:     string;
}

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

/**
 * Import a PEM-formatted RSA public key into a CryptoKey.
 * Strips the PEM headers and base64-decodes the DER bytes.
 */
async function importPemPublicKey(pem: string): Promise<CryptoKey | null> {
  try {
    const lines = pem
      .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "");
    const der = Uint8Array.from(atob(lines), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      "spki",
      der.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"],
    );
  } catch {
    return null;
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  // ── Resolve PEM public key ────────────────────────────────────────────────
  let pemKey: string | null = null;

  if (cfEnv.AVERYOS_PUBLIC_KEY_B64) {
    try { pemKey = atob(cfEnv.AVERYOS_PUBLIC_KEY_B64); }
    catch { pemKey = null; }
  } else if (cfEnv.AVERYOS_PUBLIC_KEY) {
    pemKey = cfEnv.AVERYOS_PUBLIC_KEY.replace(/\\n/g, "\n");
  }

  // ── Build JWKS ────────────────────────────────────────────────────────────
  let jwks: { keys: (JsonWebKey & { kid: string; use: string; alg: string })[] };

  if (pemKey) {
    const cryptoKey = await importPemPublicKey(pemKey);
    const jwk       = cryptoKey ? await cryptoKeyToJwk(cryptoKey) : null;

    if (jwk) {
      // Decorate with JWKS standard fields
      jwks = {
        keys: [{
          ...jwk,
          kid: `averyos-sovereign-key-${KERNEL_VERSION}`,
          use: "sig",
          alg: "RS256",
          // AveryOS™ sovereign extensions
          "x-averyos-kernel-sha":     KERNEL_SHA.slice(0, 32) + "…",
          "x-averyos-kernel-version": KERNEL_VERSION,
          "x-averyos-creator":        "Jason Lee Avery (ROOT0) 🤛🏻",
          "x-averyos-anchor":         "⛓️⚓⛓️",
        } as JsonWebKey & { kid: string; use: string; alg: string }],
      };
    } else {
      // PEM import failed — return pending manifest
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
        "x-averyos-kernel-sha":     KERNEL_SHA.slice(0, 32) + "…",
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
