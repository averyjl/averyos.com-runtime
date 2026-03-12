/**
 * lib/security/keys.ts
 *
 * Sovereign Key Loader — AveryOS™ Phase 109.3 / GATE 109.3.1 / Phase 110.2 GATE 110.2.1
 *
 * Provides two key-loading paths:
 *
 * 1. `getSovereignKeys()` — loads from `AVERYOS_PRIVATE_KEY_B64` / `AVERYOS_PUBLIC_KEY_B64`
 *    (Base64-encoded PKCS#8 private key + SPKI public key, from .NET ExportPkcs8PrivateKey /
 *    ExportSubjectPublicKeyInfo).
 *
 * 2. `getSovereignKeysFromXml()` — loads from a single `AVERYOS_PRIVATE_KEY_B64` that holds
 *    a Base64-encoded XML string produced by .NET `RSA.ToXmlString(true)`.  This is the
 *    legacy-compatible path for environments where ExportPkcs8PrivateKey is unavailable.
 *    Converts the .NET XML RSAKeyValue into JWK form, then imports via Web Crypto API.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SovereignKeyPair {
  /** RS256-capable private CryptoKey for signing. null if key material is absent or malformed. */
  privateKey:    CryptoKey | null;
  /** RS256-capable public CryptoKey for verification. null if key material is absent or malformed. */
  publicKey:     CryptoKey | null;
  /** Whether both keys were successfully loaded. */
  active:        boolean;
  /** Key ID — always "averyos-sovereign-key-{KERNEL_VERSION}". */
  kid:           string;
  /** Kernel SHA-512 anchor. */
  kernelSha:     string;
  kernelVersion: string;
}

// ── Cloudflare env shape ──────────────────────────────────────────────────────

interface SovereignEnv {
  /** Base64-encoded RSA private key (PKCS#8 or PKCS#1 DER). */
  AVERYOS_PRIVATE_KEY_B64?: string;
  /** Base64-encoded RSA public key (SPKI or PKCS#1 DER). */
  AVERYOS_PUBLIC_KEY_B64?:  string;
}

// ── Key import helpers ────────────────────────────────────────────────────────

/** RS256 algorithm descriptor for key import. */
const RS256_ALGO: RsaHashedImportParams = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
};

/**
 * Attempt to import a Base64-encoded DER private key.
 * Tries PKCS#8 format first (standard Web Crypto), then falls back gracefully.
 * Returns null on any failure.
 */
async function importPrivateKey(b64: string): Promise<CryptoKey | null> {
  let der: ArrayBuffer;
  try {
    der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  } catch {
    return null;
  }

  // Attempt PKCS#8 import (standard Web Crypto format)
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      der,
      RS256_ALGO,
      true,
      ["sign"],
    );
  } catch {
    // PKCS#8 failed — key may be raw PKCS#1; return null rather than throw
    return null;
  }
}

/**
 * Attempt to import a Base64-encoded DER public key.
 * Tries SPKI format first (standard Web Crypto), then falls back gracefully.
 * Returns null on any failure.
 */
async function importPublicKey(b64: string): Promise<CryptoKey | null> {
  let der: ArrayBuffer;
  try {
    der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  } catch {
    return null;
  }

  // Attempt SPKI import (X.509 SubjectPublicKeyInfo — standard Web Crypto format)
  try {
    return await crypto.subtle.importKey(
      "spki",
      der,
      RS256_ALGO,
      true,
      ["verify"],
    );
  } catch {
    // SPKI failed — key may be raw PKCS#1 RSAPublicKey; return null rather than throw
    return null;
  }
}

// ── Core Export ───────────────────────────────────────────────────────────────

/**
 * Load the AveryOS™ sovereign RSA key pair from Cloudflare secrets.
 *
 * Reads `AVERYOS_PRIVATE_KEY_B64` and `AVERYOS_PUBLIC_KEY_B64` from the
 * provided environment object and imports them using `crypto.subtle.importKey`
 * (`pkcs8` for the private key, `spki` for the public key).
 *
 * @param env  Cloudflare Worker environment bindings (or any object with the
 *             `AVERYOS_PRIVATE_KEY_B64` / `AVERYOS_PUBLIC_KEY_B64` fields).
 * @returns    SovereignKeyPair with loaded keys (or nulls on failure).
 */
export async function getSovereignKeys(env: SovereignEnv): Promise<SovereignKeyPair> {
  const kid = `averyos-sovereign-key-${KERNEL_VERSION}`;

  const [privateKey, publicKey] = await Promise.all([
    env.AVERYOS_PRIVATE_KEY_B64
      ? importPrivateKey(env.AVERYOS_PRIVATE_KEY_B64)
      : Promise.resolve(null),
    env.AVERYOS_PUBLIC_KEY_B64
      ? importPublicKey(env.AVERYOS_PUBLIC_KEY_B64)
      : Promise.resolve(null),
  ]);

  return {
    privateKey,
    publicKey,
    active:        privateKey !== null && publicKey !== null,
    kid,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };
}

// ── XML-B64 Key Parser (GATE 110.2.1) ─────────────────────────────────────────

/**
 * Extract a required XML element value from an RSAKeyValue XML string.
 * Returns the raw Base64 string (standard, not URL-safe) from the element body.
 * Returns null if the element is absent or empty.
 */
function extractXmlElement(xml: string, tag: string): string | null {
  // eslint-disable-next-line security/detect-non-literal-regexp -- tag is always a hardcoded RSA field name (Modulus, Exponent, etc.), never user input
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const match = re.exec(xml);
  const value = match?.[1]?.trim();
  return value || null;
}

/**
 * Convert a standard Base64 string (as used in .NET XML exports) to
 * Base64URL format (as required by JWK).
 */
function b64ToB64url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Parse a .NET RSAKeyValue XML string and import both keys via Web Crypto JWK.
 *
 * .NET `RSA.ToXmlString(true)` produces XML with these elements:
 *   Modulus, Exponent, P, Q, DP, DQ, InverseQ, D  (D is only in the private key export)
 *
 * The function derives both the private key (via JWK `rsa-private`) and the
 * public key (via JWK `rsa-public`, using only Modulus + Exponent).
 *
 * Returns null for either key on parse or import failure.
 *
 * @param xmlString  Raw XML string from .NET ToXmlString(true) output.
 * @returns          Pair of CryptoKey objects (or nulls on failure).
 */
async function importKeysFromXmlString(
  xmlString: string,
): Promise<{ privateKey: CryptoKey | null; publicKey: CryptoKey | null }> {
  const n  = extractXmlElement(xmlString, "Modulus");
  const e  = extractXmlElement(xmlString, "Exponent");
  const d  = extractXmlElement(xmlString, "D");
  const p  = extractXmlElement(xmlString, "P");
  const q  = extractXmlElement(xmlString, "Q");
  const dp = extractXmlElement(xmlString, "DP");
  const dq = extractXmlElement(xmlString, "DQ");
  const qi = extractXmlElement(xmlString, "InverseQ");

  if (!n || !e) {
    // Minimum required fields for any key
    return { privateKey: null, publicKey: null };
  }

  // ── Import public key from JWK ──────────────────────────────────────────
  let publicKey: CryptoKey | null = null;
  try {
    const publicJwk = {
      kty: "RSA",
      n:   b64ToB64url(n),
      e:   b64ToB64url(e),
      alg: "RS256",
      key_ops: ["verify"],
    };
    publicKey = await crypto.subtle.importKey(
      "jwk",
      publicJwk,
      RS256_ALGO,
      true,
      ["verify"],
    );
  } catch {
    publicKey = null;
  }

  // ── Import private key from JWK (requires D, P, Q, DP, DQ, QI) ─────────
  let privateKey: CryptoKey | null = null;
  if (d && p && q && dp && dq && qi) {
    try {
      const privateJwk = {
        kty: "RSA",
        n:   b64ToB64url(n),
        e:   b64ToB64url(e),
        d:   b64ToB64url(d),
        p:   b64ToB64url(p),
        q:   b64ToB64url(q),
        dp:  b64ToB64url(dp),
        dq:  b64ToB64url(dq),
        qi:  b64ToB64url(qi),
        alg: "RS256",
        key_ops: ["sign"],
      };
      privateKey = await crypto.subtle.importKey(
        "jwk",
        privateJwk,
        RS256_ALGO,
        true,
        ["sign"],
      );
    } catch {
      privateKey = null;
    }
  }

  return { privateKey, publicKey };
}

/**
 * Load the AveryOS™ sovereign RSA key pair from a Base64-encoded .NET XML key bundle.
 *
 * Reads `AVERYOS_PRIVATE_KEY_B64` from the provided environment object.  The value
 * is expected to be a Base64-encoded XML string produced by .NET's
 * `RSA.ToXmlString(true)` — this is the legacy-compatible path for environments
 * where `ExportPkcs8PrivateKey()` is unavailable (e.g. older .NET Framework 4.8).
 *
 * The function decodes the Base64 bundle to the XML string, extracts the RSA
 * parameters (Modulus, Exponent, D, P, Q, DP, DQ, InverseQ), converts them to
 * JWK form, and imports them via `crypto.subtle.importKey`.
 *
 * @param env  Cloudflare Worker environment bindings (must include AVERYOS_PRIVATE_KEY_B64).
 * @returns    SovereignKeyPair with loaded keys (or nulls on failure).
 */
export async function getSovereignKeysFromXml(env: SovereignEnv): Promise<SovereignKeyPair> {
  const kid = `averyos-sovereign-key-${KERNEL_VERSION}`;

  if (!env.AVERYOS_PRIVATE_KEY_B64) {
    return {
      privateKey:    null,
      publicKey:     null,
      active:        false,
      kid,
      kernelSha:     KERNEL_SHA,
      kernelVersion: KERNEL_VERSION,
    };
  }

  // Decode the outer Base64 layer to retrieve the XML string
  let xmlString: string;
  try {
    xmlString = atob(env.AVERYOS_PRIVATE_KEY_B64);
  } catch {
    return {
      privateKey:    null,
      publicKey:     null,
      active:        false,
      kid,
      kernelSha:     KERNEL_SHA,
      kernelVersion: KERNEL_VERSION,
    };
  }

  const { privateKey, publicKey } = await importKeysFromXmlString(xmlString);

  return {
    privateKey,
    publicKey,
    active:        privateKey !== null && publicKey !== null,
    kid,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };
}
