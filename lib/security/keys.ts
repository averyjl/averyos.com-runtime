/**
 * lib/security/keys.ts
 *
 * Sovereign Key Loader — AveryOS™ Phase 109.3 / GATE 109.3.1
 *
 * Provides `getSovereignKeys()` which loads the AveryOS™ RSA signing key pair
 * from Cloudflare secrets (`AVERYOS_PRIVATE_KEY_B64` / `AVERYOS_PUBLIC_KEY_B64`)
 * using the Web Crypto API (`crypto.subtle.importKey`).
 *
 * Key format expectations:
 *   - Private key: Base64-encoded PKCS#8 DER (from .NET `RSA.ExportPkcs8PrivateKey()`).
 *   - Public key:  Base64-encoded SubjectPublicKeyInfo (SPKI) DER
 *                  (from .NET `RSA.ExportSubjectPublicKeyInfo()`).
 *
 * Note: Web Crypto API's `importKey` only supports PKCS#8 for private keys and SPKI
 * for public keys. PKCS#1 RSAPrivateKey / RSAPublicKey formats (produced by .NET's
 * `ExportRSAPrivateKey()` / `ExportRSAPublicKey()`) are NOT directly supported — use
 * the PKCS#8/SPKI export methods instead.
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
