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
 * lib/security/unmaskCore.ts
 *
 * AveryOS™ Master Unmasking Logic — Phase 116.3 GATE 116.3.1 / Phase 128.2 GATE 128.2.3
 *
 * Resident Handshake protocol that verifies the local USB salt file
 * (AveryOS-anchor-salt.aossalt) and returns the residency state.
 *
 * This module runs in Node.js / Electron main process context only.
 * It is NOT imported into Cloudflare Worker bundles.
 *
 * Residency states:
 *   FULLY_RESIDENT  — AveryOS-anchor-salt.aossalt present on USB (highest trust)
 *   NODE-02_PHYSICAL — Legacy .aos-salt / AOS_SALT.bin detected
 *   CLOUD           — No USB salt found
 *
 * ── SnapChain Signature Standard (GATE 128.2.3) ────────────────────────────
 * Ed25519 (Curve25519) is the canonical SnapChain digital-signature algorithm
 * for all AveryOS™ capsule and VaultChain attestations.  Every capsule hash
 * committed to the sovereign ledger MUST be signed with an Ed25519 key pair
 * whose public key is registered in the SNAPCHAIN_REGISTRY_PATH.
 *
 * Algorithm summary:
 *   Curve:       Curve25519 (Bernstein et al., 2006)
 *   Scheme:      EdDSA (Edwards-curve Digital Signature Algorithm — RFC 8032)
 *   JWS alg:     EdDSA  (registered in IANA JOSE Algorithms — RFC 8037)
 *   JWK key_type: OKP   (Octet Key Pair)
 *   JWK crv:     Ed25519
 *   Key size:    32-byte private scalar → 32-byte compressed public key
 *   Signature:   64 bytes (deterministic — no random nonce required)
 *   Security:    ~128-bit equivalent (comparable to P-256 / RSA-3072)
 *
 * Why Ed25519 for SnapChain?
 *   1. Deterministic — same key + message always produces the same signature,
 *      eliminating k-reuse vulnerabilities inherent in ECDSA.
 *   2. Fast — sign and verify operations complete in microseconds on Node-02.
 *   3. Compact — 64-byte signatures and 32-byte public keys minimise
 *      on-chain capsule overhead in the VaultChain ledger.
 *   4. Side-channel resistant — the Curve25519 arithmetic is designed to
 *      execute in constant time, resisting timing attacks on sovereign nodes.
 *   5. Standards-aligned — RFC 8032 (EdDSA) + RFC 8037 (JWK OKP) ensure
 *      cross-platform verification by any C2PA-compliant toolchain.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import path from "path";
import crypto from "crypto";

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Salt file constants ────────────────────────────────────────────────────────
export const SALT_FILENAME_PRIMARY  = "AveryOS-anchor-salt.aossalt";
export const SALT_FILENAME_LEGACY   = ".aos-salt";
export const SALT_FILENAME_BLOCK    = "AOS_SALT.bin";

// ── SnapChain Ed25519 Signature Standard (GATE 128.2.3) ────────────────────────
// These constants define the canonical cryptographic algorithm used to sign
// every capsule hash and VaultChain attestation in the AveryOS™ sovereign ledger.

/** The signing algorithm used by SnapChain — Ed25519 (Edwards-curve DSA). */
export const SNAPCHAIN_ALGORITHM    = "Ed25519" as const;

/** The underlying elliptic curve — Curve25519 (Bernstein, 2006). */
export const SNAPCHAIN_CURVE        = "Curve25519" as const;

/** JOSE JWS algorithm identifier for EdDSA over Curve25519 (RFC 8037). */
export const SNAPCHAIN_JWS_ALG      = "EdDSA" as const;

/** JOSE JWK key type for Ed25519 octet key pairs (RFC 8037). */
export const SNAPCHAIN_KEY_TYPE     = "OKP" as const;

/** JOSE JWK crv parameter for Ed25519 (RFC 8037). */
export const SNAPCHAIN_JWK_CRV      = "Ed25519" as const;

/** Ed25519 private key length in bytes (32-byte scalar). */
export const SNAPCHAIN_PRIVKEY_BYTES = 32 as const;

/** Ed25519 public key length in bytes (32-byte compressed point — same size as private scalar). */
export const SNAPCHAIN_PUBKEY_BYTES  = SNAPCHAIN_PRIVKEY_BYTES;

/** Ed25519 signature length in bytes (deterministic R‖S output — 2 × SNAPCHAIN_PRIVKEY_BYTES). */
export const SNAPCHAIN_SIG_BYTES     = (SNAPCHAIN_PRIVKEY_BYTES * 2) as 64;

/** Well-known file path (relative to repo root) where SnapChain public keys are registered. */
export const SNAPCHAIN_REGISTRY_PATH = "VaultBridge/snapchain-registry.json" as const;

/**
 * SnapChainAlgorithm — discriminated-union type identifying Ed25519 as the
 * sole valid algorithm for SnapChain signatures.  Any capsule signed with
 * a different algorithm must be rejected as non-compliant.
 */
export type SnapChainAlgorithm = typeof SNAPCHAIN_ALGORITHM;

/**
 * SnapChainPublicKeyRecord — the shape of a single entry in
 * SNAPCHAIN_REGISTRY_PATH.  Consumers MUST verify `algorithm === "Ed25519"`
 * before trusting the `publicKeyHex` value.
 */
export interface SnapChainPublicKeyRecord {
  /** Ed25519 compressed public key (32 bytes encoded as 64 lowercase hex chars). */
  publicKeyHex: string;
  /** Must equal SNAPCHAIN_ALGORITHM ("Ed25519"). */
  algorithm:    SnapChainAlgorithm;
  /** ISO-8601 timestamp at which this key was registered. */
  registeredAt: string;
  /** Human-readable label, e.g. "Node-02 PC Key v1". */
  label:        string;
}

// ── Residency states ──────────────────────────────────────────────────────────
export type ResidencyState = "FULLY_RESIDENT" | "NODE-02_PHYSICAL" | "CLOUD";

// ── Result types ──────────────────────────────────────────────────────────────
export interface HandshakeResult {
  state:         ResidencyState;
  found:         boolean;
  mountPath:     string | null;
  saltPath:      string | null;
  previewHex:    string | null;
  saltSha512:    string | null;
  kernelVersion: string;
  kernelSha:     string;
  timestamp:     string;
}

// ── Allowed salt filenames (immutable set — no user input accepted) ─────────
const ALLOWED_SALT_FILENAMES = new Set([
  SALT_FILENAME_PRIMARY,
  SALT_FILENAME_LEGACY,
  SALT_FILENAME_BLOCK,
]);

// ── Path sanitizer ─────────────────────────────────────────────────────────────
/** @internal - exported for unit testing only */
export function sanitisePathComponent(s: string): string {
  return s.replace(/[\x00-\x1f]/g, "").replace(/[^a-zA-Z0-9_.\-@ ]/g, "").trim();
}

// ── Path validator ─────────────────────────────────────────────────────────────
/** @internal - exported for unit testing only */
export function validateSaltPath(saltPath: string): string | null {
  const norm = path.normalize(saltPath);
  if (norm.includes("\x00") || norm.includes("..")) return null;
  const base = path.basename(norm);
  if (!ALLOWED_SALT_FILENAMES.has(base)) return null;
  return norm;
}

// ── USB mount candidates (platform-aware) ──────────────────────────────────────

/**
 * enumerateVolumesDir()
 *
 * Lists all sanitised volume names under a macOS-style volumes directory
 * (e.g. /Volumes).  Each entry name is sanitised before joining.
 *
 * @internal - exported for unit testing only
 */
export async function enumerateVolumesDir(volumesRoot: string): Promise<string[]> {
  const { default: fs } = await import("node:fs");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller validates volumesRoot
  return fs
    .readdirSync(volumesRoot)
    .map((v) => {
      const safe = sanitisePathComponent(v);
      return safe ? path.join(volumesRoot, safe) : null;
    })
    .filter((v): v is string => v !== null);
}

/** @internal - exported for unit testing only */
export async function getUsbMountCandidates(): Promise<string[]> {
  if (process.platform === "win32") { // platform-specific: covered on Windows only
    const letters: string[] = [];
    for (let c = 68; c <= 90; c++) letters.push(String.fromCharCode(c) + ":\\");
    return letters;
  }
  if (process.platform === "darwin") { // platform-specific: covered on macOS only
    try {
      return await enumerateVolumesDir("/Volumes");
    } catch { return []; }
  }
  // Linux: restrict to three conventional removable-media directories.
  // /mnt subdirectories are enumerated via readdirSync; each child entry is
  // sanitised with sanitisePathComponent() and later validated by
  // validateSaltPath() (which only permits the three known salt filenames)
  // before any fs.existsSync call — preventing access to sensitive system mounts.
  const { default: os } = await import("node:os");
  const { default: fs } = await import("node:fs");
  const rawUser = os.userInfo().username;
  const user    = sanitisePathComponent(rawUser);
  if (!user) return [];
  const bases   = [`/media/${user}`, "/mnt", `/run/media/${user}`];
  const result: string[] = [];
  // Allowed base directories for removable media on Linux — validated individually.
  const SAFE_BASE_RE = /^\/(?:media\/[a-zA-Z0-9_.,-]{1,64}|mnt|run\/media\/[a-zA-Z0-9_.,-]{1,64})$/;
  for (const base of bases) {
    try {
      if (!SAFE_BASE_RE.test(base)) continue;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- base validated against SAFE_BASE_RE above
      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        result.push(...(await enumerateMountChildren(base)));
      }
    } catch { /* skip inaccessible mount bases */ }
  }
  return result;
}

/**
 * enumerateMountChildren()
 *
 * Lists all sanitised child entries of a mount base directory.
 * Each entry is sanitised with sanitisePathComponent() before being added.
 *
 * @internal - exported for unit testing only
 */
export async function enumerateMountChildren(base: string): Promise<string[]> {
  const { default: fs } = await import("node:fs");
  const result: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller validates base
  fs.readdirSync(base).forEach((c) => {
    const safe = sanitisePathComponent(c);
    if (safe) result.push(path.join(base, safe));
  });
  return result;
}

// ── Salt file reader (first 64 bytes as hex + full SHA-512) ──────────────────
/** @internal - exported for unit testing only */
export async function readSaltData(saltPath: string): Promise<{ previewHex: string | null; sha512: string | null }> {
  const safe = validateSaltPath(saltPath);
  if (!safe) return { previewHex: null, sha512: null };
  const { default: fs } = await import("node:fs");
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path validated by validateSaltPath() above
    const buf = fs.readFileSync(safe);
    const previewHex = buf.subarray(0, 64).toString("hex");
    const sha512     = crypto.createHash("sha512").update(buf).digest("hex");
    return { previewHex, sha512 };
  } catch { return { previewHex: null, sha512: null }; }
}

/**
 * scanMountsForSalt()
 *
 * Core inner loop of the Resident Handshake — given a list of mount-point
 * candidates, scans each one for the sovereign salt file and returns the
 * first match as a HandshakeResult, or null if no salt is found.
 *
 * @internal - exported for unit testing only
 */
export async function scanMountsForSalt(
  candidates: string[],
  timestamp: string,
): Promise<HandshakeResult | null> {
  const { default: fs } = await import("node:fs");
  for (const mount of candidates) {
    try {
      // Priority 1: FULLY_RESIDENT — AveryOS-anchor-salt.aossalt
      const primaryPath = validateSaltPath(path.join(mount, SALT_FILENAME_PRIMARY));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated by validateSaltPath()
      if (primaryPath && fs.existsSync(primaryPath)) {
        const { previewHex, sha512 } = await readSaltData(primaryPath);
        return {
          state:         "FULLY_RESIDENT",
          found:         true,
          mountPath:     mount,
          saltPath:      primaryPath,
          previewHex,
          saltSha512:    sha512,
          kernelVersion: KERNEL_VERSION,
          kernelSha:     KERNEL_SHA,
          timestamp,
        };
      }

      // Priority 2: NODE-02_PHYSICAL — legacy markers
      for (const legacyName of [SALT_FILENAME_LEGACY, SALT_FILENAME_BLOCK]) {
        const legPath = validateSaltPath(path.join(mount, legacyName));
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated by validateSaltPath()
        if (legPath && fs.existsSync(legPath)) {
          const { previewHex, sha512 } = await readSaltData(legPath);
          return {
            state:         "NODE-02_PHYSICAL",
            found:         true,
            mountPath:     mount,
            saltPath:      legPath,
            previewHex,
            saltSha512:    sha512,
            kernelVersion: KERNEL_VERSION,
            kernelSha:     KERNEL_SHA,
            timestamp,
          };
        }
      }
    } catch { /* skip inaccessible mounts */ }
  }
  return null;
}

/**
 * performResidencyHandshake()
 *
 * Scans all USB mount candidates for the sovereign salt file and returns
 * the current residency state.  This is the core of the Master Unmasking
 * Logic — when FULLY_RESIDENT is returned, the kernel is authorized to
 * activate all sovereign operations.
 */
export async function performResidencyHandshake(): Promise<HandshakeResult> {
  const candidates = await getUsbMountCandidates();
  const timestamp  = new Date().toISOString();

  const found = await scanMountsForSalt(candidates, timestamp);
  if (found) return found;

  return {
    state:         "CLOUD",
    found:         false,
    mountPath:     null,
    saltPath:      null,
    previewHex:    null,
    saltSha512:    null,
    kernelVersion: KERNEL_VERSION,
    kernelSha:     KERNEL_SHA,
    timestamp,
  };
}

/**
 * isFullyResident()
 *
 * Convenience wrapper — returns true when the Node-02 physical USB salt is
 * present and the residency state is FULLY_RESIDENT.
 */
export async function isFullyResident(): Promise<boolean> {
  return (await performResidencyHandshake()).state === "FULLY_RESIDENT";
}
