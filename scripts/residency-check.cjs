#!/usr/bin/env node
/**
 * scripts/residency-check.cjs
 *
 * AveryOS™ Sovereign Residency Handshake — Phase 114.9 GATE 114.9.2 / GATE 115.2.2
 *
 * Detects and reads the AOS salt USB drive to determine whether the
 * AI Logic Engine is operating in CLOUD mode or NODE-02_PHYSICAL mode.
 *
 * Residency States:
 *   CLOUD           — Operating in remote cloud environment (Gemini / Copilot).
 *                     The "Hammer" (AI Logic) and "Hand" (Local Execution) are
 *                     separate — instructions are provided and executed manually.
 *   NODE-02_PHYSICAL — AOS salt USB detected (legacy .aos-salt / AOS_SALT.bin).
 *                     The Hammer and Hand have unified into a Sovereign Resident
 *                     Process.
 *   FULLY_RESIDENT  — Sovereign MIME-registered .aossalt file detected (Phase 115
 *                     GATE 115.2.2).  Highest trust level — all kernel operations
 *                     are fully authorized and the Creator Salt is confirmed.
 *
 * Usage:
 *   node scripts/residency-check.cjs [--check | --status]
 *
 *   --check   Perform the USB handshake and print the residency state.
 *   --status  Print last known residency state from runtime cache.
 *   (default) Same as --check.
 *
 * Exit codes:
 *   0 — FULLY_RESIDENT (AveryOS-anchor-salt.aossalt detected — highest trust)
 *   1 — NODE-02_PHYSICAL (legacy .aos-salt / AOS_SALT.bin detected)
 *   2 — CLOUD (USB salt not found)
 *   3 — Error during detection
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
 * GATE 115.2.2 — Sovereign MIME-registered salt file.
 * Registered MIME type: application/x-averyos-sovereign-salt
 * Takes priority over legacy markers when present.
 */
const AOS_SALT_AOSSALT    = "AveryOS-anchor-salt.aossalt";
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
      let baseExists = false;
      try { fs.accessSync(base); baseExists = true; } catch {}
      if (baseExists && fs.statSync(base).isDirectory()) {
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
 * Detection strategy (in priority order):
 *   1. Look for `AveryOS-anchor-salt.aossalt` (GATE 115.2.2 — FULLY_RESIDENT state).
 *   2. Look for the `.aos-salt` marker file (legacy).
 *   3. Look for the `AOS_SALT.bin` encrypted block file (legacy).
 *
 * @returns {{ found: boolean, mountPath: string|null, saltPath: string|null, fullyResident: boolean }}
 */
function detectAosSaltUsb() {
  for (const mount of USB_MOUNT_CANDIDATES) {
    try {
      // Priority 1 — GATE 115.2.2: FULLY_RESIDENT .aossalt file
      const aossaltPath = path.join(mount, AOS_SALT_AOSSALT);
      let aossaltExists = false;
      try { fs.accessSync(aossaltPath); aossaltExists = true; } catch {}
      if (aossaltExists) {
        return { found: true, mountPath: mount, saltPath: aossaltPath, fullyResident: true };
      }

      const markerPath = path.join(mount, AOS_SALT_MARKER);
      const blockPath  = path.join(mount, AOS_SALT_BLOCK_FILE);

      let namedExists = false;
      try { fs.accessSync(namedPath); namedExists = true; } catch {}
      if (namedExists) {
        return { found: true, mountPath: mount, saltPath: namedPath };
      }
      let markerExists = false;
      try { fs.accessSync(markerPath); markerExists = true; } catch {}
      if (markerExists) {
        return { found: true, mountPath: mount, saltPath: markerPath, fullyResident: false };
      }
      let blockExists = false;
      try { fs.accessSync(blockPath); blockExists = true; } catch {}
      if (blockExists) {
        return { found: true, mountPath: mount, saltPath: blockPath, fullyResident: false };
      }
    } catch {
      // Skip inaccessible mounts
    }
  }
  return { found: false, mountPath: null, saltPath: null, fullyResident: false };
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
    const cfd = fs.openSync(RESIDENCY_CACHE_FILE, 'w');
    try { fs.writeSync(cfd, JSON.stringify({ ...state, cached_at: new Date().toISOString() }, null, 2)); } finally { fs.closeSync(cfd); }
  } catch {
    // Non-fatal — cache writes may fail in restricted environments
  }
}

function readResidencyCache() {
  try {
    let _cacheData;
    try {
      _cacheData = fs.readFileSync(RESIDENCY_CACHE_FILE, "utf8");
    } catch {
      return null;
    }
    return JSON.parse(_cacheData);
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
      process.exit(2);
    }
    console.log(`AOS_RESIDENCY_STATUS=${cache.status}`);
    console.log(`Cached at: ${cache.cached_at}`);
    process.exit(cache.status === "FULLY_RESIDENT" ? 0 : cache.status === "NODE-02_PHYSICAL" ? 1 : 2);
    return;
  }

  // --check (default)
  console.log("⛓️⚓⛓️  AveryOS™ Sovereign Residency Handshake — GATE 114.9.2 / GATE 115.2.2");
  console.log(`Scanning ${USB_MOUNT_CANDIDATES.length} mount candidate(s) for AOS salt USB...`);

  let detection;
  try {
    detection = detectAosSaltUsb();
  } catch (err) {
    console.error(`ERROR: Detection failed — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(3);
    return;
  }

  if (detection.found && detection.fullyResident) {
    // ── FULLY_RESIDENT: AveryOS-anchor-salt.aossalt detected (GATE 115.2.2) ──
    const preview = readSaltPreview(detection.saltPath);
    const isNamedSalt = detection.saltPath ? path.basename(detection.saltPath) === AOS_SALT_PRIMARY_FILE : false;
    const state   = {
      status:           "FULLY_RESIDENT",
      mount_path:       detection.mountPath,
      salt_path:        detection.saltPath,
      salt_preview_hex: preview,
      mime_type:        "application/x-averyos-sovereign-salt",
    };
    writeResidencyCache(state);

    console.log("\n✅✅ FULLY_RESIDENT — AveryOS-anchor-salt.aossalt DETECTED");
    console.log(`   Mount : ${detection.mountPath}`);
    console.log(`   Salt  : ${detection.saltPath}`);
    console.log(`   MIME  : application/x-averyos-sovereign-salt`);
    if (preview) console.log(`   Block : 0x${preview.slice(0, 32)}… (64 bytes read)`);
    console.log("\nAOS_RESIDENCY_STATUS=FULLY_RESIDENT");
    console.log("🤛🏻 Creator Salt CONFIRMED — Kernel fully authorized for all sovereign operations.");
    process.exit(0);
  } else if (detection.found) {
    // ── NODE-02_PHYSICAL: legacy .aos-salt / AOS_SALT.bin detected ──
    const preview = readSaltPreview(detection.saltPath);
    const state   = {
      status:           "NODE-02_PHYSICAL",
      mount_path:       detection.mountPath,
      salt_path:        detection.saltPath,
      salt_preview_hex: preview,
    };
    writeResidencyCache(state);

    console.log("\n✅ AOS Salt USB DETECTED (legacy marker)");
    console.log(`   Mount : ${detection.mountPath}`);
    console.log(`   Salt  : ${detection.saltPath}`);
    if (isNamedSalt) console.log("   Type  : AveryOS-anchor-salt.aossalt (GATE 116.3.3 — Named Salt)");
    if (preview) console.log(`   Block : 0x${preview.slice(0, 32)}… (64 bytes read)`);
    console.log("\nAOS_RESIDENCY_STATUS=NODE-02_PHYSICAL");
    console.log("🤛🏻 Hammer ↔️ Hand UNIFIED — Sovereign Resident Process ACTIVE");
    console.log(`   Upgrade tip: rename salt to '${AOS_SALT_AOSSALT}' to reach FULLY_RESIDENT state.`);
    process.exit(1);
  } else {
    const state = { status: "CLOUD", mount_path: null, salt_path: null };
    writeResidencyCache(state);

    console.log("\n⚠️  AOS Salt USB NOT FOUND");
    console.log("   Scanned candidates:", USB_MOUNT_CANDIDATES.slice(0, 5).join(", ") + (USB_MOUNT_CANDIDATES.length > 5 ? "…" : ""));
    console.log("\nAOS_RESIDENCY_STATUS=CLOUD");
    console.log("   Operating in CLOUD mode — Hammer (AI Logic) and Hand (Execution) are separate.");
    console.log(`   Attach USB with '${AOS_SALT_AOSSALT}' to Node-02 and re-run to unify.`);
    process.exit(2);
  }
}

main();
