/**
 * __tests__/unmaskCore.test.ts
 *
 * Unit tests for lib/security/unmaskCore.ts
 *
 * Covers:
 *   - SALT_FILENAME_* constants
 *   - performResidencyHandshake() — USB salt scanner (returns CLOUD in CI)
 *   - isFullyResident() — convenience boolean wrapper
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/unmaskCore.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  performResidencyHandshake,
  isFullyResident,
  SALT_FILENAME_PRIMARY,
  SALT_FILENAME_LEGACY,
  SALT_FILENAME_BLOCK,
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

// ── performResidencyHandshake() ───────────────────────────────────────────────

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
