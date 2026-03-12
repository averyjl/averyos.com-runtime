/**
 * lib/security/keys.ts
 *
 * Sovereign Key Loader — AveryOS™ Phase 111 / GATE 111.3
 *
 * Provides `getSovereignKeys()` which loads the AveryOS™ RSA signing key pair
 * from Cloudflare secrets (`AVERYOS_PRIVATE_KEY_B64` / `AVERYOS_PUBLIC_KEY_B64`)
 * using the Web Crypto API (`crypto.subtle.importKey`).
 *
 * Key format expectations (tried in order):
 *   1. Base64-encoded PKCS#8 DER private / SPKI DER public
 *      (from .NET `RSA.ExportPkcs8PrivateKey()` / `RSA.ExportSubjectPublicKeyInfo()`).
 *   2. Base64-encoded .NET XML key format
 *      (from .NET `RSA.ToXmlString(true)` for private / `RSA.ToXmlString(false)` for public).
 *      Parsed via `importKey("jwk", ...)` after extracting Modulus/Exponent fields.
 *
 * Note: Web Crypto API's `importKey` only supports PKCS#8 for private keys and SPKI
 * for public keys. PKCS#1 RSAPrivateKey / RSAPublicKey formats (produced by .NET's
 * `ExportRSAPrivateKey()` / `ExportRSAPublicKey()`) are NOT directly supported — use
 * the PKCS#8/SPKI export methods or the XML bridge format instead.
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

// ── .NET XML key bridge ───────────────────────────────────────────────────────

/**
 * Extract a named RSA XML element's text content from a .NET ToXmlString() output.
 * Uses simple string-split to avoid a non-literal RegExp constructor.
 *
 * @param xml       The XML string produced by .NET `RSA.ToXmlString()`.
 * @param openTag   The full opening tag, e.g. `"<Modulus>"`.
 * @param closeTag  The full closing tag, e.g. `"</Modulus>"`.
 * @returns         The trimmed text content between the tags, or `null` if absent.
 */
function extractXmlField(xml: string, openTag: string, closeTag: string): string | null {
  const start = xml.indexOf(openTag);
  if (start === -1) return null;
  const valueStart = start + openTag.length;
  const end = xml.indexOf(closeTag, valueStart);
  if (end === -1) return null;
  const value = xml.slice(valueStart, end).trim();
  return value.length > 0 ? value : null;
}

/**
 * Convert standard Base64 (with `+` and `/` characters) to Base64url format
 * (with `-` and `_` characters) and strip `=` padding.
 * .NET emits standard Base64 in `ToXmlString()` output, while the JWK standard
 * requires Base64url — this helper normalises between the two.
 *
 * @param b64  Standard Base64-encoded string.
 * @returns    Base64url-encoded string without padding.
 */
function base64ToBase64url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Try to parse a string as a Base64-encoded .NET XML RSA key (ToXmlString output)
 * and return the extracted fields, or null if it is not XML-key material.
 */
function parseXmlKeyMaterial(b64: string): {
  modulus: string;
  exponent: string;
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
} | null {
  let xml: string;
  try {
    xml = atob(b64);
  } catch {
    return null;
  }

  if (!xml.includes("<RSAKeyValue>")) return null;

  const modulus  = extractXmlField(xml, "<Modulus>",   "</Modulus>");
  const exponent = extractXmlField(xml, "<Exponent>",  "</Exponent>");
  if (!modulus || !exponent) return null;

  const d  = extractXmlField(xml, "<D>",         "</D>")         ?? undefined;
  const p  = extractXmlField(xml, "<P>",         "</P>")         ?? undefined;
  const q  = extractXmlField(xml, "<Q>",         "</Q>")         ?? undefined;
  const dp = extractXmlField(xml, "<DP>",        "</DP>")        ?? undefined;
  const dq = extractXmlField(xml, "<DQ>",        "</DQ>")        ?? undefined;
  const qi = extractXmlField(xml, "<InverseQ>",  "</InverseQ>")  ?? undefined;

  return {
    modulus:  base64ToBase64url(modulus),
    exponent: base64ToBase64url(exponent),
    ...(d  !== undefined && { d:  base64ToBase64url(d)  }),
    ...(p  !== undefined && { p:  base64ToBase64url(p)  }),
    ...(q  !== undefined && { q:  base64ToBase64url(q)  }),
    ...(dp !== undefined && { dp: base64ToBase64url(dp) }),
    ...(dq !== undefined && { dq: base64ToBase64url(dq) }),
    ...(qi !== undefined && { qi: base64ToBase64url(qi) }),
  };
}

/**
 * Attempt to import a Base64-encoded DER private key.
 * Tries PKCS#8 format first (standard Web Crypto), then falls back to
 * .NET XML key format (ToXmlString(true)) via JWK bridge.
 * Returns null on any failure.
 */
async function importPrivateKey(b64: string): Promise<CryptoKey | null> {
  // ── Attempt 1: PKCS#8 DER ────────────────────────────────────────────────
  try {
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
    return await crypto.subtle.importKey("pkcs8", der, RS256_ALGO, true, ["sign"]);
  } catch {
    // PKCS#8 failed — try XML bridge below
  }

  // ── Attempt 2: .NET XML key format (Base64-encoded XML string) ───────────
  try {
    const fields = parseXmlKeyMaterial(b64);
    if (!fields || !fields.d) return null;   // private key requires D component

    const jwk: JsonWebKey = {
      kty: "RSA",
      alg: "RS256",
      key_ops: ["sign"],
      n:   fields.modulus,
      e:   fields.exponent,
      d:   fields.d,
      ...(fields.p  !== undefined && { p:  fields.p  }),
      ...(fields.q  !== undefined && { q:  fields.q  }),
      ...(fields.dp !== undefined && { dp: fields.dp }),
      ...(fields.dq !== undefined && { dq: fields.dq }),
      ...(fields.qi !== undefined && { qi: fields.qi }),
    };

    return await crypto.subtle.importKey("jwk", jwk, RS256_ALGO, true, ["sign"]);
  } catch {
    return null;
  }
}

/**
 * Attempt to import a Base64-encoded DER public key.
 * Tries SPKI format first (standard Web Crypto), then falls back to
 * .NET XML key format (ToXmlString(false)) via JWK bridge.
 * Returns null on any failure.
 */
async function importPublicKey(b64: string): Promise<CryptoKey | null> {
  // ── Attempt 1: SPKI DER ──────────────────────────────────────────────────
  try {
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
    return await crypto.subtle.importKey("spki", der, RS256_ALGO, true, ["verify"]);
  } catch {
    // SPKI failed — try XML bridge below
  }

  // ── Attempt 2: .NET XML key format (Base64-encoded XML string) ───────────
  try {
    const fields = parseXmlKeyMaterial(b64);
    if (!fields) return null;

    const jwk: JsonWebKey = {
      kty: "RSA",
      alg: "RS256",
      key_ops: ["verify"],
      n: fields.modulus,
      e: fields.exponent,
    };

    return await crypto.subtle.importKey("jwk", jwk, RS256_ALGO, true, ["verify"]);
  } catch {
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
