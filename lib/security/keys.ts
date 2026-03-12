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
  /**
   * First half of the split Base64-encoded private key bundle.
   * Used by the Split-Key Protocol (GATE 111.3.1) when the full key exceeds
   * the Cloudflare 1 KB secret limit. Concatenated with PART2 at runtime.
   */
  AVERYOS_PRIVATE_KEY_PART1?: string;
  /**
   * Second half of the split Base64-encoded private key bundle.
   * Used by the Split-Key Protocol (GATE 111.3.1) when the full key exceeds
   * the Cloudflare 1 KB secret limit. Concatenated with PART1 at runtime.
   */
  AVERYOS_PRIVATE_KEY_PART2?: string;
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
 * Detect whether a Base64 string decodes to a .NET RSAKeyValue XML bundle.
 * Returns true if the decoded value starts with an XML RSAKeyValue element.
 * Returns false on any decode failure without surfacing internal errors.
 */
function isBase64EncodedXmlKey(b64: string): boolean {
  // Quick sanity: valid Base64 consists only of [A-Za-z0-9+/=]
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return false;
  try {
    const decoded = atob(b64).trimStart();
    return decoded.startsWith("<RSAKeyValue>") || decoded.startsWith("<RSAKeyValue ");
  } catch {
    return false;
  }
}

/**
 * Load the AveryOS™ sovereign RSA key pair from Cloudflare secrets.
 *
 * Reads `AVERYOS_PRIVATE_KEY_B64` and `AVERYOS_PUBLIC_KEY_B64` from the
 * provided environment object.  Supports two key formats automatically:
 *
 * 1. **Standard DER path** (PKCS#8 private + SPKI public):
 *    Both secrets hold Base64-encoded DER binary key material produced by
 *    .NET `ExportPkcs8PrivateKey()` / `ExportSubjectPublicKeyInfo()` or
 *    by `openssl pkcs8 / openssl pkey`.
 *
 * 2. **XML-B64 auto-detect path** (GATE 111.3):
 *    If `AVERYOS_PRIVATE_KEY_B64` decodes to a .NET `RSAKeyValue` XML string
 *    (i.e. it was produced by `RSA.ToXmlString(true)` and then Base64-encoded),
 *    the function automatically delegates to `getSovereignKeysFromXml()` to
 *    extract both the private and public keys from the single XML bundle.
 *    This activates the JWKS `ACTIVE` status without requiring a separate
 *    `AVERYOS_PUBLIC_KEY_B64` secret in XML-bundle deployments.
 *
 * @param env  Cloudflare Worker environment bindings (or any object with the
 *             `AVERYOS_PRIVATE_KEY_B64` / `AVERYOS_PUBLIC_KEY_B64` fields).
 * @returns    SovereignKeyPair with loaded keys (or nulls on failure).
 */
export async function getSovereignKeys(env: SovereignEnv): Promise<SovereignKeyPair> {
  const kid = `averyos-sovereign-key-${KERNEL_VERSION}`;

  // Auto-detect XML-B64 bundle (GATE 111.3 — .NET ToXmlString(true) path)
  if (env.AVERYOS_PRIVATE_KEY_B64 && isBase64EncodedXmlKey(env.AVERYOS_PRIVATE_KEY_B64)) {
    return getSovereignKeysFromXml(env);
  }

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

// ── Split-Key Reconstructor (GATE 111.3.1) ────────────────────────────────────

/**
 * Load the AveryOS™ sovereign RSA key pair using the Split-Key Protocol.
 *
 * The Cloudflare Workers secret store enforces a 1 KB per-secret limit.
 * When the Base64-encoded key bundle exceeds this limit the operator can
 * split the bundle into two halves and store them as separate secrets:
 *   `AVERYOS_PRIVATE_KEY_PART1`  — first half of the Base64 string
 *   `AVERYOS_PRIVATE_KEY_PART2`  — second half of the Base64 string
 *
 * This function:
 *  1. Concatenates PART1 + PART2 to reconstruct the full Base64 bundle.
 *  2. Delegates to `getSovereignKeys()` with the reconstructed bundle exposed
 *     as `AVERYOS_PRIVATE_KEY_B64`, preserving all existing key-format
 *     auto-detection logic (DER PKCS#8 vs .NET XML-B64).
 *  3. Falls back to `AVERYOS_PRIVATE_KEY_B64` directly if both PART1 and
 *     PART2 are absent — this allows a seamless transition from the legacy
 *     single-secret deployment to the split-key deployment without a
 *     simultaneous secret rotation.
 *
 * @param env  Cloudflare Worker environment bindings.  Must contain either
 *             (AVERYOS_PRIVATE_KEY_PART1 + AVERYOS_PRIVATE_KEY_PART2) or the
 *             legacy AVERYOS_PRIVATE_KEY_B64.
 * @returns    SovereignKeyPair with loaded keys (or nulls on failure).
 */
export async function getReconstructedSovereignKeys(env: SovereignEnv): Promise<SovereignKeyPair> {
  const part1 = env.AVERYOS_PRIVATE_KEY_PART1 ?? "";
  const part2 = env.AVERYOS_PRIVATE_KEY_PART2 ?? "";

  // Detect misconfiguration: exactly one part is set but not both.
  // We log a console warning (not an error that could leak key material)
  // so operators can identify the issue without silently failing.
  if ((part1 && !part2) || (!part1 && part2)) {
    console.warn(
      "[AveryOS™ VaultKey] Split-key misconfiguration detected: " +
      "only one of AVERYOS_PRIVATE_KEY_PART1 / AVERYOS_PRIVATE_KEY_PART2 is set. " +
      "Both parts must be present for key reconstruction. " +
      "Falling back to AVERYOS_PRIVATE_KEY_B64.",
    );
  }

  // If both parts are present, reconstruct and override the env key slot.
  // Basic sanity: each part must contain only valid Base64 characters.
  const b64Pattern = /^[A-Za-z0-9+/]+=*$/;
  if (part1 && part2 && b64Pattern.test(part1) && b64Pattern.test(part2)) {
    const reconstructedEnv: SovereignEnv = {
      ...env,
      AVERYOS_PRIVATE_KEY_B64: part1 + part2,
    };
    return getSovereignKeys(reconstructedEnv);
  }

  // Fallback: use the legacy AVERYOS_PRIVATE_KEY_B64 directly
  return getSovereignKeys(env);
}
