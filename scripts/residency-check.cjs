#!/usr/bin/env node
/**
 * scripts/residency-check.cjs
 *
 * AveryOS™ Sovereign Residency Handshake — Phase 114.9 GATE 114.9.2
 *
 * Detects and reads the AOS salt USB drive to determine whether the
 * AI Logic Engine is operating in CLOUD mode or NODE-02_PHYSICAL mode.
 *
 * Residency States:
 *   CLOUD           — Operating in remote cloud environment (Gemini / Copilot).
 *                     The "Hammer" (AI Logic) and "Hand" (Local Execution) are
 *                     separate — instructions are provided and executed manually.
 *   NODE-02_PHYSICAL — AOS salt USB detected on local hardware.  The Hammer and
 *                     Hand have unified into a Sovereign Resident Process.
 *
 * Usage:
 *   node scripts/residency-check.cjs [--check | --status]
 *
 *   --check   Perform the USB handshake and print the residency state.
 *   --status  Print last known residency state from runtime cache.
 *   (default) Same as --check.
 *
 * Exit codes:
 *   0 — NODE-02_PHYSICAL (USB salt detected)
 *   1 — CLOUD (USB salt not found)
 *   2 — Error during detection
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");

// ── Constants ──────────────────────────────────────────────────────────────────

/** Expected salt marker file on the AOS USB drive. */
const AOS_SALT_MARKER     = ".aos-salt";
/** Expected salt block file (encrypted). */
const AOS_SALT_BLOCK_FILE = "AOS_SALT.bin";
/**
 * GATE 116.3.3 — USB Residency Handshake.
 * Primary named salt file: allows a specifically labelled USB drive to be
 * the sovereign anchor without requiring a hidden marker file.
 */
const AOS_SALT_NAMED_FILE = "AveryOS-anchor-salt.aossalt";
/** Runtime cache for last residency check result. */
const RESIDENCY_CACHE_FILE = path.join(os.tmpdir(), ".aos_residency_cache.json");

/** Common USB mount points across platforms. */
const USB_MOUNT_CANDIDATES = (() => {
  const platform = process.platform;
  if (platform === "win32") {
    // Windows: scan drive letters D: through Z:
    const letters = [];
    for (let c = 68; c <= 90; c++) {
      letters.push(String.fromCharCode(c) + ":\\");
    }
    return letters;
  }
  if (platform === "darwin") {
    // macOS: /Volumes/
    try {
      const vols = fs.readdirSync("/Volumes");
      return vols.map((v) => path.join("/Volumes", v));
    } catch {
      return [];
    }
  }
  // Linux: /media/$USER, /mnt, /run/media/$USER
  const user = os.userInfo().username;
  const candidates = [
    `/media/${user}`,
    "/mnt",
    `/run/media/${user}`,
  ];
  const expanded = [];
  for (const base of candidates) {
    try {
      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        const children = fs.readdirSync(base);
        for (const child of children) {
          expanded.push(path.join(base, child));
        }
      }
    } catch {
      // Skip unreadable paths
    }
  }
  return expanded;
})();

// ── Residency detection ────────────────────────────────────────────────────────

/**
 * Attempt to locate the AOS salt USB drive.
 *
 * Detection strategy (in order):
 *   1. Look for the named `AveryOS-anchor-salt.aossalt` file (GATE 116.3.3).
 *   2. Look for the `.aos-salt` marker file on any mounted volume.
 *   3. Look for the `AOS_SALT.bin` encrypted block file.
 *
 * @returns {{ found: boolean, mountPath: string|null, saltPath: string|null }}
 */
function detectAosSaltUsb() {
  for (const mount of USB_MOUNT_CANDIDATES) {
    try {
      const namedPath  = path.join(mount, AOS_SALT_NAMED_FILE);
      const markerPath = path.join(mount, AOS_SALT_MARKER);
      const blockPath  = path.join(mount, AOS_SALT_BLOCK_FILE);

      if (fs.existsSync(namedPath)) {
        return { found: true, mountPath: mount, saltPath: namedPath };
      }
      if (fs.existsSync(markerPath)) {
        return { found: true, mountPath: mount, saltPath: markerPath };
      }
      if (fs.existsSync(blockPath)) {
        return { found: true, mountPath: mount, saltPath: blockPath };
      }
    } catch {
      // Skip inaccessible mounts
    }
  }
  return { found: false, mountPath: null, saltPath: null };
}

/**
 * Read and return the first 64 bytes of the salt block for verification.
 * Returns null if unreadable or not present.
 *
 * @param {string} saltPath
 * @returns {string|null} Hex-encoded first 64 bytes, or null.
 */
function readSaltPreview(saltPath) {
  try {
    const buf = Buffer.alloc(64);
    const fd  = fs.openSync(saltPath, "r");
    const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
    fs.closeSync(fd);
    return buf.subarray(0, bytesRead).toString("hex");
  } catch {
    return null;
  }
}

// ── Cache helpers ──────────────────────────────────────────────────────────────

function writeResidencyCache(state) {
  try {
    // Note: this script is CommonJS (.cjs) and cannot import lib/timePrecision.ts
    // (ESM/TypeScript). Standard ISO-8601 is sufficient for a local runtime cache.
    fs.writeFileSync(RESIDENCY_CACHE_FILE, JSON.stringify({ ...state, cached_at: new Date().toISOString() }, null, 2), "utf8");
  } catch {
    // Non-fatal — cache writes may fail in restricted environments
  }
}

function readResidencyCache() {
  try {
    if (fs.existsSync(RESIDENCY_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(RESIDENCY_CACHE_FILE, "utf8"));
    }
  } catch {
    // Cache read failure is non-fatal
  }
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cmd  = args[0] ?? "--check";

  if (cmd === "--status") {
    const cache = readResidencyCache();
    if (!cache) {
      console.log("AOS_RESIDENCY_STATUS=UNKNOWN (no cached state — run --check first)");
      process.exit(1);
    }
    console.log(`AOS_RESIDENCY_STATUS=${cache.status}`);
    console.log(`Cached at: ${cache.cached_at}`);
    process.exit(cache.status === "NODE-02_PHYSICAL" ? 0 : 1);
    return;
  }

  // --check (default)
  console.log("⛓️⚓⛓️  AveryOS™ Sovereign Residency Handshake — GATE 114.9.2");
  console.log(`Scanning ${USB_MOUNT_CANDIDATES.length} mount candidate(s) for AOS salt USB...`);

  let detection;
  try {
    detection = detectAosSaltUsb();
  } catch (err) {
    console.error(`ERROR: Detection failed — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
    return;
  }

  if (detection.found) {
    const preview = readSaltPreview(detection.saltPath);
    const isNamedSalt = detection.saltPath ? path.basename(detection.saltPath) === AOS_SALT_NAMED_FILE : false;
    const state   = {
      status:     "NODE-02_PHYSICAL",
      mount_path: detection.mountPath,
      salt_path:  detection.saltPath,
      salt_file:  detection.saltPath ? path.basename(detection.saltPath) : null,
      salt_preview_hex: preview,
    };
    writeResidencyCache(state);

    console.log("\n✅ AOS Salt USB DETECTED");
    console.log(`   Mount : ${detection.mountPath}`);
    console.log(`   Salt  : ${detection.saltPath}`);
    if (isNamedSalt) console.log("   Type  : AveryOS-anchor-salt.aossalt (GATE 116.3.3 — Named Salt)");
    if (preview) console.log(`   Block : 0x${preview.slice(0, 32)}… (64 bytes read)`);
    console.log("\nAOS_RESIDENCY_STATUS=NODE-02_PHYSICAL");
    console.log("🤛🏻 Hammer ↔️ Hand UNIFIED — Sovereign Resident Process ACTIVE");
    process.exit(0);
  } else {
    const state = { status: "CLOUD", mount_path: null, salt_path: null };
    writeResidencyCache(state);

    console.log("\n⚠️  AOS Salt USB NOT FOUND");
    console.log("   Scanned candidates:", USB_MOUNT_CANDIDATES.slice(0, 5).join(", ") + (USB_MOUNT_CANDIDATES.length > 5 ? "…" : ""));
    console.log("\nAOS_RESIDENCY_STATUS=CLOUD");
    console.log("   Operating in CLOUD mode — Hammer (AI Logic) and Hand (Execution) are separate.");
    console.log("   Attach the AOS salt USB to Node-02 and re-run to unify.");
    process.exit(1);
  }
}

main();
