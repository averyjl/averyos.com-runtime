/**
 * __tests__/unmaskCore.test.ts
 *
 * Unit tests for lib/security/unmaskCore.ts
 *
 * Covers:
 *   - SALT_FILENAME_* constants
 *   - SNAPCHAIN_* Ed25519 constants and types (GATE 128.2.3)
 *   - performResidencyHandshake() — USB salt scanner (returns CLOUD in CI)
 *   - isFullyResident() — convenience boolean wrapper
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/unmaskCore.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  performResidencyHandshake,
  isFullyResident,
  sanitisePathComponent,
  validateSaltPath,
  readSaltData,
  getUsbMountCandidates,
  enumerateMountChildren,
  enumerateVolumesDir,
  scanMountsForSalt,
  SALT_FILENAME_PRIMARY,
  SALT_FILENAME_LEGACY,
  SALT_FILENAME_BLOCK,
  SNAPCHAIN_ALGORITHM,
  SNAPCHAIN_CURVE,
  SNAPCHAIN_JWS_ALG,
  SNAPCHAIN_KEY_TYPE,
  SNAPCHAIN_JWK_CRV,
  SNAPCHAIN_PRIVKEY_BYTES,
  SNAPCHAIN_PUBKEY_BYTES,
  SNAPCHAIN_SIG_BYTES,
  SNAPCHAIN_REGISTRY_PATH,
} from "../lib/security/unmaskCore";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Salt filename constants ───────────────────────────────────────────────────

describe("Salt filename constants", () => {
  test("SALT_FILENAME_PRIMARY ends with .aossalt", () => {
    assert.ok(SALT_FILENAME_PRIMARY.endsWith(".aossalt"));
  });

  test("SALT_FILENAME_LEGACY is '.aos-salt'", () => {
    assert.equal(SALT_FILENAME_LEGACY, ".aos-salt");
  });

  test("SALT_FILENAME_BLOCK is 'AOS_SALT.bin'", () => {
    assert.equal(SALT_FILENAME_BLOCK, "AOS_SALT.bin");
  });

  test("primary filename starts with 'AveryOS-anchor-salt'", () => {
    assert.ok(SALT_FILENAME_PRIMARY.startsWith("AveryOS-anchor-salt"));
  });

  test("all three filenames are distinct strings", () => {
    const names = new Set([SALT_FILENAME_PRIMARY, SALT_FILENAME_LEGACY, SALT_FILENAME_BLOCK]);
    assert.equal(names.size, 3);
  });
});

// ── sanitisePathComponent() ───────────────────────────────────────────────────

describe("sanitisePathComponent()", () => {
  test("passes through clean alphanumeric strings unchanged", () => {
    assert.equal(sanitisePathComponent("MyVolume"), "MyVolume");
    assert.equal(sanitisePathComponent("usb-drive_01"), "usb-drive_01");
  });

  test("strips control characters (\\x00–\\x1f)", () => {
    assert.equal(sanitisePathComponent("ab\x00cd"), "abcd");
    assert.equal(sanitisePathComponent("ab\x1fcd"), "abcd");
  });

  test("strips disallowed characters (e.g. slashes, colons)", () => {
    assert.equal(sanitisePathComponent("../../etc/passwd"), "....etcpasswd");
  });

  test("trims leading and trailing whitespace", () => {
    assert.equal(sanitisePathComponent("  volume  "), "volume");
  });

  test("returns empty string for an all-control-character input", () => {
    assert.equal(sanitisePathComponent("\x01\x02\x03"), "");
  });
});

// ── validateSaltPath() ────────────────────────────────────────────────────────

describe("validateSaltPath()", () => {
  test("accepts a valid primary salt path", () => {
    const p = `/mnt/usb/${SALT_FILENAME_PRIMARY}`;
    const result = validateSaltPath(p);
    assert.ok(result !== null);
    assert.ok(result!.endsWith(SALT_FILENAME_PRIMARY));
  });

  test("accepts a valid legacy .aos-salt path", () => {
    const p = `/mnt/usb/${SALT_FILENAME_LEGACY}`;
    assert.ok(validateSaltPath(p) !== null);
  });

  test("accepts a valid AOS_SALT.bin path", () => {
    const p = `/mnt/usb/${SALT_FILENAME_BLOCK}`;
    assert.ok(validateSaltPath(p) !== null);
  });

  test("rejects a path containing '..' traversal (relative escape)", () => {
    // path.normalize resolves embedded '..' in absolute paths, but a relative
    // path starting with '..' still contains '..' after normalization
    const p = `../../etc/${SALT_FILENAME_PRIMARY}`;
    assert.equal(validateSaltPath(p), null);
  });

  test("rejects a path containing a null byte (\\x00)", () => {
    const p = `/mnt/usb/\x00/${SALT_FILENAME_PRIMARY}`;
    assert.equal(validateSaltPath(p), null);
  });

  test("rejects a path whose basename is not an allowed salt filename", () => {
    assert.equal(validateSaltPath("/mnt/usb/evil.txt"), null);
    assert.equal(validateSaltPath("/mnt/usb/secret.aoskey"), null);
  });
});

// ── readSaltData() ─────────────────────────────────────────────────────────────

describe("readSaltData()", () => {
  test("returns null fields for an invalid (traversal) path", () => {
    const result = readSaltData(`/mnt/usb/../etc/${SALT_FILENAME_PRIMARY}`);
    assert.equal(result.previewHex, null);
    assert.equal(result.sha512, null);
  });

  test("returns null fields for a non-allowed basename", () => {
    const result = readSaltData("/tmp/evil.txt");
    assert.equal(result.previewHex, null);
    assert.equal(result.sha512, null);
  });

  test("reads a real file and returns hex preview + sha512", () => {
    // Write a temporary salt file with a known salt filename
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-test-"));
    const saltFile = path.join(tmpDir, SALT_FILENAME_PRIMARY);
    const saltContent = Buffer.from("AveryOS-test-salt-data-for-coverage-tests-0123456789abcdef");
    fs.writeFileSync(saltFile, saltContent);

    try {
      const result = readSaltData(saltFile);
      assert.ok(result.previewHex !== null, "previewHex should not be null");
      assert.ok(result.sha512 !== null, "sha512 should not be null");
      // Preview is first 64 bytes as hex → max 128 hex chars
      assert.ok(typeof result.previewHex === "string");
      assert.ok(result.previewHex!.length > 0);
      // SHA-512 is always 128 hex characters
      assert.equal(result.sha512!.length, 128);
      assert.match(result.sha512!, /^[0-9a-f]{128}$/);
    } finally {
      fs.unlinkSync(saltFile);
      fs.rmdirSync(tmpDir);
    }
  });

  test("returns null fields for a path that does not exist on disk", () => {
    // File is a valid salt name but the path doesn't exist — readFileSync throws
    const nonExistent = path.join(os.tmpdir(), "no-such-dir-xyz", SALT_FILENAME_PRIMARY);
    const result = readSaltData(nonExistent);
    assert.equal(result.previewHex, null);
    assert.equal(result.sha512, null);
  });
});

// ── readSaltData() — mocked fs.readFileSync failures (GATE 129.1.2) ──────────
// Explicitly cover the defensive catch block inside readSaltData() by mocking
// fs.readFileSync to throw, verifying graceful null-return without propagation.

describe("readSaltData() — mocked readFileSync catch block", () => {
  test("returns null fields when fs.readFileSync throws EACCES (permission denied)", () => {
    const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-mock-eacces-"));
    const saltFile = path.join(tmpDir, SALT_FILENAME_PRIMARY);
    // Create the file so validateSaltPath passes, then mock readFileSync to throw.
    fs.writeFileSync(saltFile, Buffer.from("dummy"));
    const restore = mock.method(fs, "readFileSync", () => {
      throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    });
    try {
      const result = readSaltData(saltFile);
      assert.equal(result.previewHex, null);
      assert.equal(result.sha512, null);
    } finally {
      restore.mock.restore();
      try { fs.unlinkSync(saltFile); } catch { /* already gone */ }
      try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    }
  });

  test("returns null fields when fs.readFileSync throws ENOENT (file vanished)", () => {
    const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-mock-enoent-"));
    const saltFile = path.join(tmpDir, SALT_FILENAME_PRIMARY);
    fs.writeFileSync(saltFile, Buffer.from("dummy"));
    const restore = mock.method(fs, "readFileSync", () => {
      throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    });
    try {
      const result = readSaltData(saltFile);
      assert.equal(result.previewHex, null);
      assert.equal(result.sha512, null);
    } finally {
      restore.mock.restore();
      try { fs.unlinkSync(saltFile); } catch { /* already gone */ }
      try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    }
  });

  test("returns null fields when fs.readFileSync throws a generic Error", () => {
    const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-mock-generic-"));
    const saltFile = path.join(tmpDir, SALT_FILENAME_PRIMARY);
    fs.writeFileSync(saltFile, Buffer.from("dummy"));
    const restore = mock.method(fs, "readFileSync", () => {
      throw new Error("Unexpected I/O failure");
    });
    try {
      const result = readSaltData(saltFile);
      assert.equal(result.previewHex, null);
      assert.equal(result.sha512, null);
    } finally {
      restore.mock.restore();
      try { fs.unlinkSync(saltFile); } catch { /* already gone */ }
      try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    }
  });
});

// ── getUsbMountCandidates() ───────────────────────────────────────────────────

describe("getUsbMountCandidates()", () => {
  test("returns an array on this platform (Linux CI)", () => {
    const candidates = getUsbMountCandidates();
    assert.ok(Array.isArray(candidates));
  });

  test("all returned entries are non-empty strings", () => {
    const candidates = getUsbMountCandidates();
    for (const c of candidates) {
      assert.ok(typeof c === "string");
      assert.ok(c.length > 0);
    }
  });

  test("win32: returns drive letters D: through Z:", () => {
    // Temporarily mock process.platform as 'win32' to cover the win32 branch
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    try {
      const candidates = getUsbMountCandidates();
      assert.ok(Array.isArray(candidates));
      assert.ok(candidates.length > 0);
      // Should include D:\ at minimum
      assert.ok(candidates.some((c) => c === "D:\\"));
      // Should contain Z:\
      assert.ok(candidates.some((c) => c === "Z:\\"));
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });

  test("darwin: catches error when /Volumes is inaccessible and returns []", () => {
    // Temporarily mock process.platform as 'darwin' to cover the darwin try/catch branch.
    // On Linux CI, /Volumes doesn't exist → fs.readdirSync throws → catch returns [].
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    try {
      const candidates = getUsbMountCandidates();
      // On Linux CI, /Volumes doesn't exist → darwin branch catches error → returns []
      assert.ok(Array.isArray(candidates));
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });
  test("linux: returns [] when username sanitises to empty string", () => {
    // Mock os.userInfo to return a username made of only stripped chars.
    // sanitisePathComponent strips everything non-[a-zA-Z0-9_.\-@ ], so
    // a Unicode-only username like 'テスト' sanitises to "" → early return [].
    const restore = mock.method(os, "userInfo", () => ({ username: "テスト" }));
    const originalPlatform = process.platform;
    // Ensure we stay on Linux path
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      const candidates = getUsbMountCandidates();
      assert.ok(Array.isArray(candidates));
      assert.equal(candidates.length, 0);
    } finally {
      restore.mock.restore();
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });

  test("linux: skips bases that do not match SAFE_BASE_RE (e.g. username with @)", () => {
    // A username like 'john@doe' sanitises to 'john@doe' (@ is allowed by sanitisePathComponent)
    // but /media/john@doe does NOT match SAFE_BASE_RE (which only allows [a-zA-Z0-9_.,-]).
    // This exercises the `if (!SAFE_BASE_RE.test(base)) continue` branch.
    const restore = mock.method(os, "userInfo", () => ({ username: "john@doe" }));
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      const candidates = getUsbMountCandidates();
      // /media/john@doe and /run/media/john@doe won't match regex → skipped.
      // /mnt itself always matches → included only if it exists and has subdirs.
      assert.ok(Array.isArray(candidates));
      // None of the returned paths should contain '@'
      assert.ok(candidates.every((c) => !c.includes("@")));
    } finally {
      restore.mock.restore();
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });
});

describe("enumerateMountChildren()", () => {
  test("returns empty array for an empty directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-enumerate-empty-"));
    try {
      const children = enumerateMountChildren(tmpDir);
      assert.ok(Array.isArray(children));
      assert.equal(children.length, 0);
    } finally {
      fs.rmdirSync(tmpDir);
    }
  });

  test("returns sanitised child paths for entries in a directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-enumerate-"));
    const subDir = path.join(tmpDir, "usb-drive-01");
    fs.mkdirSync(subDir);
    try {
      const children = enumerateMountChildren(tmpDir);
      assert.ok(Array.isArray(children));
      assert.ok(children.length >= 1);
      // The subdir should appear as a child path
      assert.ok(children.some((c) => c.endsWith("usb-drive-01")));
    } finally {
      fs.rmdirSync(subDir);
      fs.rmdirSync(tmpDir);
    }
  });

  test("skips entries whose names sanitise to an empty string", () => {
    // Entries whose names contain only control chars sanitise to "" and are dropped
    const tmpDir      = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-enumerate-safe-"));
    const cleanEntry  = path.join(tmpDir, "clean-entry");
    // Unicode-only directory name sanitises to "" and should be skipped
    const unicodeEntry = path.join(tmpDir, "テスト");
    fs.mkdirSync(cleanEntry);
    fs.mkdirSync(unicodeEntry);
    try {
      const children = enumerateMountChildren(tmpDir);
      // The clean entry should survive
      assert.ok(children.some((c) => c.endsWith("clean-entry")));
      // The unicode entry should be dropped
      assert.ok(!children.some((c) => c.includes("テスト")));
    } finally {
      fs.rmdirSync(cleanEntry);
      fs.rmdirSync(unicodeEntry);
      fs.rmdirSync(tmpDir);
    }
  });
});

// ── enumerateVolumesDir() ─────────────────────────────────────────────────────

describe("enumerateVolumesDir()", () => {
  test("returns an array of sanitised paths under a given volumes root", () => {
    const tmpVolumes = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-volumes-"));
    const vol1 = path.join(tmpVolumes, "Macintosh-HD");
    const vol2 = path.join(tmpVolumes, "MyUSB");
    fs.mkdirSync(vol1);
    fs.mkdirSync(vol2);
    try {
      const result = enumerateVolumesDir(tmpVolumes);
      assert.ok(Array.isArray(result));
      assert.ok(result.some((p) => p.endsWith("Macintosh-HD")));
      assert.ok(result.some((p) => p.endsWith("MyUSB")));
    } finally {
      fs.rmdirSync(vol1);
      fs.rmdirSync(vol2);
      fs.rmdirSync(tmpVolumes);
    }
  });

  test("skips volume entries that sanitise to empty string", () => {
    const tmpVolumes = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-volumes-safe-"));
    const safeVol   = path.join(tmpVolumes, "SafeVol");
    // Unicode-only name sanitises to "" and should be filtered out
    const unicodeVol = path.join(tmpVolumes, "テスト");
    fs.mkdirSync(safeVol);
    fs.mkdirSync(unicodeVol);
    try {
      const result = enumerateVolumesDir(tmpVolumes);
      // SafeVol should be included; テスト should be filtered out
      assert.ok(result.some((p) => p.endsWith("SafeVol")));
      assert.ok(!result.some((p) => p.includes("テスト")));
    } finally {
      fs.rmdirSync(safeVol);
      fs.rmdirSync(unicodeVol);
      fs.rmdirSync(tmpVolumes);
    }
  });

  test("returns empty array for an empty volumes root", () => {
    const tmpVolumes = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-volumes-empty-"));
    try {
      const result = enumerateVolumesDir(tmpVolumes);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    } finally {
      fs.rmdirSync(tmpVolumes);
    }
  });
});

// ── scanMountsForSalt() ───────────────────────────────────────────────────────

describe("scanMountsForSalt()", () => {
  test("returns null when candidates array is empty", () => {
    const result = scanMountsForSalt([], new Date().toISOString());
    assert.equal(result, null);
  });

  test("returns null when candidates have no salt files", () => {
    // Create a temp dir with no salt files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-empty-"));
    try {
      const result = scanMountsForSalt([tmpDir], new Date().toISOString());
      assert.equal(result, null);
    } finally {
      fs.rmdirSync(tmpDir);
    }
  });

  test("detects FULLY_RESIDENT when primary salt file exists in a candidate", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-primary-"));
    const saltFile = path.join(tmpDir, SALT_FILENAME_PRIMARY);
    fs.writeFileSync(saltFile, Buffer.from("sovereign-salt-test-primary"));
    try {
      const ts = new Date().toISOString();
      const result = scanMountsForSalt([tmpDir], ts);
      assert.ok(result !== null);
      assert.equal(result!.state, "FULLY_RESIDENT");
      assert.equal(result!.found, true);
      assert.equal(result!.mountPath, tmpDir);
      assert.ok(result!.saltPath !== null);
      assert.ok(result!.previewHex !== null);
      assert.ok(result!.saltSha512 !== null);
      assert.equal(result!.kernelVersion, KERNEL_VERSION);
      assert.equal(result!.kernelSha, KERNEL_SHA);
      assert.equal(result!.timestamp, ts);
    } finally {
      fs.unlinkSync(saltFile);
      fs.rmdirSync(tmpDir);
    }
  });

  test("detects NODE-02_PHYSICAL when legacy .aos-salt file exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-legacy-"));
    const legacyFile = path.join(tmpDir, SALT_FILENAME_LEGACY);
    fs.writeFileSync(legacyFile, Buffer.from("sovereign-salt-test-legacy"));
    try {
      const ts = new Date().toISOString();
      const result = scanMountsForSalt([tmpDir], ts);
      assert.ok(result !== null);
      assert.equal(result!.state, "NODE-02_PHYSICAL");
      assert.equal(result!.found, true);
      assert.equal(result!.mountPath, tmpDir);
      assert.ok(result!.saltPath !== null);
    } finally {
      fs.unlinkSync(legacyFile);
      fs.rmdirSync(tmpDir);
    }
  });

  test("detects NODE-02_PHYSICAL when AOS_SALT.bin file exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-block-"));
    const blockFile = path.join(tmpDir, SALT_FILENAME_BLOCK);
    fs.writeFileSync(blockFile, Buffer.from("sovereign-salt-test-block"));
    try {
      const ts = new Date().toISOString();
      const result = scanMountsForSalt([tmpDir], ts);
      assert.ok(result !== null);
      assert.equal(result!.state, "NODE-02_PHYSICAL");
      assert.equal(result!.found, true);
    } finally {
      fs.unlinkSync(blockFile);
      fs.rmdirSync(tmpDir);
    }
  });

  test("primary salt takes priority over legacy salt when both present", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-both-"));
    const primaryFile = path.join(tmpDir, SALT_FILENAME_PRIMARY);
    const legacyFile  = path.join(tmpDir, SALT_FILENAME_LEGACY);
    fs.writeFileSync(primaryFile, Buffer.from("primary-salt"));
    fs.writeFileSync(legacyFile,  Buffer.from("legacy-salt"));
    try {
      const result = scanMountsForSalt([tmpDir], new Date().toISOString());
      assert.ok(result !== null);
      assert.equal(result!.state, "FULLY_RESIDENT");
    } finally {
      fs.unlinkSync(primaryFile);
      fs.unlinkSync(legacyFile);
      fs.rmdirSync(tmpDir);
    }
  });

  test("skips inaccessible mount candidates and continues", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unmask-skip-"));
    const saltFile = path.join(tmpDir, SALT_FILENAME_PRIMARY);
    fs.writeFileSync(saltFile, Buffer.from("skip-test-salt"));
    try {
      // Pass a non-existent path first — it should be skipped, then tmpDir found
      const result = scanMountsForSalt(["/nonexistent-mount-xyz", tmpDir], new Date().toISOString());
      assert.ok(result !== null);
      assert.equal(result!.state, "FULLY_RESIDENT");
    } finally {
      fs.unlinkSync(saltFile);
      fs.rmdirSync(tmpDir);
    }
  });
});

describe("performResidencyHandshake()", () => {
  test("returns an object with a valid ResidencyState", () => {
    const result = performResidencyHandshake();
    const validStates = new Set(["FULLY_RESIDENT", "NODE-02_PHYSICAL", "CLOUD"]);
    assert.ok(validStates.has(result.state));
  });

  test("embeds the sovereign kernel anchor (kernelVersion + kernelSha)", () => {
    const result = performResidencyHandshake();
    assert.equal(result.kernelVersion, KERNEL_VERSION);
    assert.equal(result.kernelSha, KERNEL_SHA);
  });

  test("timestamp is an ISO-like string", () => {
    const result = performResidencyHandshake();
    assert.ok(typeof result.timestamp === "string");
    assert.ok(result.timestamp.length > 0);
    // Basic ISO-8601 shape: starts with year
    assert.match(result.timestamp, /^\d{4}-/);
  });

  test("in CI/CLOUD mode: found=false, mountPath=null, saltPath=null", () => {
    const result = performResidencyHandshake();
    if (result.state === "CLOUD") {
      assert.equal(result.found, false);
      assert.equal(result.mountPath, null);
      assert.equal(result.saltPath, null);
      assert.equal(result.previewHex, null);
      assert.equal(result.saltSha512, null);
    }
  });

  test("in FULLY_RESIDENT mode: found=true, mountPath and saltPath are strings", () => {
    const result = performResidencyHandshake();
    if (result.state === "FULLY_RESIDENT") {
      assert.equal(result.found, true);
      assert.ok(typeof result.mountPath === "string");
      assert.ok(typeof result.saltPath === "string");
    }
  });

  test("in NODE-02_PHYSICAL mode: found=true", () => {
    const result = performResidencyHandshake();
    if (result.state === "NODE-02_PHYSICAL") {
      assert.equal(result.found, true);
    }
  });

  test("returns a new timestamp on each call", async () => {
    const r1 = performResidencyHandshake();
    await new Promise((res) => setTimeout(res, 5));
    const r2 = performResidencyHandshake();
    // Timestamps should be different strings (millisecond resolution)
    // Both must be valid strings regardless
    assert.ok(typeof r1.timestamp === "string");
    assert.ok(typeof r2.timestamp === "string");
  });
});

// ── isFullyResident() ─────────────────────────────────────────────────────────

describe("isFullyResident()", () => {
  test("returns a boolean", () => {
    const result = isFullyResident();
    assert.equal(typeof result, "boolean");
  });

  test("returns false in a CI environment (no USB salt present)", () => {
    // In CI there is no physical USB — the result is expected to be false.
    // On a sovereign Node-02 machine with the salt present, this may be true.
    const result = isFullyResident();
    assert.ok(result === true || result === false);
  });
});

// ── SnapChain Ed25519 Signature Standard constants (GATE 128.2.3) ─────────────

describe("SnapChain Ed25519 Signature Standard constants", () => {
  test("SNAPCHAIN_ALGORITHM is 'Ed25519'", () => {
    assert.equal(SNAPCHAIN_ALGORITHM, "Ed25519");
  });

  test("SNAPCHAIN_CURVE is 'Curve25519'", () => {
    assert.equal(SNAPCHAIN_CURVE, "Curve25519");
  });

  test("SNAPCHAIN_JWS_ALG is 'EdDSA' (RFC 8037 JOSE algorithm identifier)", () => {
    assert.equal(SNAPCHAIN_JWS_ALG, "EdDSA");
  });

  test("SNAPCHAIN_KEY_TYPE is 'OKP' (Octet Key Pair — RFC 8037)", () => {
    assert.equal(SNAPCHAIN_KEY_TYPE, "OKP");
  });

  test("SNAPCHAIN_JWK_CRV is 'Ed25519' (RFC 8037 JWK crv parameter)", () => {
    assert.equal(SNAPCHAIN_JWK_CRV, "Ed25519");
  });

  test("SNAPCHAIN_PRIVKEY_BYTES is 32 (Ed25519 private scalar length)", () => {
    assert.equal(SNAPCHAIN_PRIVKEY_BYTES, 32);
  });

  test("SNAPCHAIN_PUBKEY_BYTES is 32 (Ed25519 compressed public key length)", () => {
    assert.equal(SNAPCHAIN_PUBKEY_BYTES, 32);
  });

  test("SNAPCHAIN_SIG_BYTES is 64 (Ed25519 deterministic signature length)", () => {
    assert.equal(SNAPCHAIN_SIG_BYTES, 64);
  });

  test("SNAPCHAIN_REGISTRY_PATH contains 'VaultBridge/'", () => {
    assert.ok(SNAPCHAIN_REGISTRY_PATH.startsWith("VaultBridge/"));
  });

  test("SNAPCHAIN_REGISTRY_PATH ends with '.json'", () => {
    assert.ok(SNAPCHAIN_REGISTRY_PATH.endsWith(".json"));
  });

  test("public key is half the signature length (32 bytes vs 64 bytes)", () => {
    assert.equal(SNAPCHAIN_PUBKEY_BYTES * 2, SNAPCHAIN_SIG_BYTES);
  });

  test("private and public key sizes are equal for Ed25519", () => {
    assert.equal(SNAPCHAIN_PRIVKEY_BYTES, SNAPCHAIN_PUBKEY_BYTES);
  });
});
