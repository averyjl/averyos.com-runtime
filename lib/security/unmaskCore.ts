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
function sanitisePathComponent(s: string): string {
  return s.replace(/[\x00-\x1f]/g, "").replace(/[^a-zA-Z0-9_.\-@ ]/g, "").trim();
}

// ── Path validator ─────────────────────────────────────────────────────────────
function validateSaltPath(saltPath: string): string | null {
  const norm = path.normalize(saltPath);
  if (norm.includes("\x00") || norm.includes("..")) return null;
  const base = path.basename(norm);
  if (!ALLOWED_SALT_FILENAMES.has(base)) return null;
  return norm;
}

// ── USB mount candidates (platform-aware) ──────────────────────────────────────
function getUsbMountCandidates(): string[] {
  if (process.platform === "win32") {
    const letters: string[] = [];
    for (let c = 68; c <= 90; c++) letters.push(String.fromCharCode(c) + ":\\");
    return letters;
  }
  if (process.platform === "darwin") {
    try {
      return fs
        .readdirSync("/Volumes")
        .map((v) => {
          const safe = sanitisePathComponent(v);
          return safe ? path.join("/Volumes", safe) : null;
        })
        .filter((v): v is string => v !== null);
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
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- base validated against allowedRe above
      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- base validated against allowedRe above
        fs.readdirSync(base).forEach((c) => {
          const safe = sanitisePathComponent(c);
          if (safe) result.push(path.join(base, safe));
        });
      }
    } catch { /* skip inaccessible mount bases */ }
  }
  return result;
}

// ── Salt file reader (first 64 bytes as hex + full SHA-512) ──────────────────
function readSaltData(saltPath: string): { previewHex: string | null; sha512: string | null } {
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
