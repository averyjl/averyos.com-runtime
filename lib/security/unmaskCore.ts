/**
 * lib/security/unmaskCore.ts
 *
 * AveryOS™ Master Unmasking Logic — Phase 116.3 GATE 116.3.1
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
 * ── SnapChain Signature Standard ─────────────────────────────────────────────
 * All SnapChain identity packets are signed using the Ed25519 signature
 * algorithm (Edwards-curve Digital Signature Algorithm — EdDSA on Curve25519).
 * Ed25519 is the canonical AveryOS™ signing standard because it provides:
 *   • High security (128-bit security level, RFC 8032)
 *   • Sub-millisecond signing and verification performance
 *   • Deterministic signatures — no per-call randomness required
 *   • Compact 64-byte signatures and 32-byte public keys
 * The `verifier_signature` field in every SnapChain packet MUST be a valid
 * Ed25519 (Curve25519) signature over the packet's canonical digest.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Salt file constants ────────────────────────────────────────────────────────
export const SALT_FILENAME_PRIMARY  = "AveryOS-anchor-salt.aossalt";
export const SALT_FILENAME_LEGACY   = ".aos-salt";
export const SALT_FILENAME_BLOCK    = "AOS_SALT.bin";

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
export function enumerateVolumesDir(volumesRoot: string): string[] {
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
export function getUsbMountCandidates(): string[] {
  if (process.platform === "win32") { // platform-specific: covered on Windows only
    const letters: string[] = [];
    for (let c = 68; c <= 90; c++) letters.push(String.fromCharCode(c) + ":\\");
    return letters;
  }
  if (process.platform === "darwin") { // platform-specific: covered on macOS only
    try {
      return enumerateVolumesDir("/Volumes");
    } catch { return []; }
  }
  // Linux: restrict to three conventional removable-media directories.
  // /mnt subdirectories are enumerated via readdirSync; each child entry is
  // sanitised with sanitisePathComponent() and later validated by
  // validateSaltPath() (which only permits the three known salt filenames)
  // before any fs.existsSync call — preventing access to sensitive system mounts.
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
        result.push(...enumerateMountChildren(base));
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
export function enumerateMountChildren(base: string): string[] {
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
export function readSaltData(saltPath: string): { previewHex: string | null; sha512: string | null } {
  const safe = validateSaltPath(saltPath);
  if (!safe) return { previewHex: null, sha512: null };
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
export function scanMountsForSalt(
  candidates: string[],
  timestamp: string,
): HandshakeResult | null {
  for (const mount of candidates) {
    try {
      // Priority 1: FULLY_RESIDENT — AveryOS-anchor-salt.aossalt
      const primaryPath = validateSaltPath(path.join(mount, SALT_FILENAME_PRIMARY));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated by validateSaltPath()
      if (primaryPath && fs.existsSync(primaryPath)) {
        const { previewHex, sha512 } = readSaltData(primaryPath);
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
          const { previewHex, sha512 } = readSaltData(legPath);
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
export function performResidencyHandshake(): HandshakeResult {
  const candidates = getUsbMountCandidates();
  const timestamp  = new Date().toISOString();

  const found = scanMountsForSalt(candidates, timestamp);
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
export function isFullyResident(): boolean {
  return performResidencyHandshake().state === "FULLY_RESIDENT";
}
