/**
 * __tests__/protocol.test.ts
 *
 * Unit tests for lib/constants/protocol.ts
 *
 * Covers:
 *   - THE_PROTOCOL — canonical definition string
 *   - PROTOCOL_COMPONENTS — frozen component labels
 *   - PROTOCOL_VERSION — semver string
 *   - PROTOCOL_DISPLAY_LABEL — formatted display label
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/protocol.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  THE_PROTOCOL,
  PROTOCOL_COMPONENTS,
  PROTOCOL_VERSION,
  PROTOCOL_DISPLAY_LABEL,
} from "../lib/constants/protocol";

// ── THE_PROTOCOL ──────────────────────────────────────────────────────────────

describe("THE_PROTOCOL", () => {
  test("is a non-empty string", () => {
    assert.equal(typeof THE_PROTOCOL, "string");
    assert.ok(THE_PROTOCOL.length > 0);
  });

  test("references AveryOS™", () => {
    assert.ok(THE_PROTOCOL.includes("AveryOS™"));
  });

  test("mentions Truth-Anchored Handshakes, Forensic Markers, and Constitutional Hardlocks", () => {
    assert.ok(THE_PROTOCOL.includes("Truth-Anchored Handshakes"));
    assert.ok(THE_PROTOCOL.includes("Forensic Markers"));
    assert.ok(THE_PROTOCOL.includes("Constitutional Hardlocks"));
  });
});

// ── PROTOCOL_COMPONENTS ───────────────────────────────────────────────────────

describe("PROTOCOL_COMPONENTS", () => {
  test("is a frozen object", () => {
    assert.ok(Object.isFrozen(PROTOCOL_COMPONENTS));
  });

  test("has TRUTH_ANCHORED_HANDSHAKES with expected value", () => {
    assert.equal(
      PROTOCOL_COMPONENTS.TRUTH_ANCHORED_HANDSHAKES,
      "Truth-Anchored Handshakes",
    );
  });

  test("has FORENSIC_MARKERS with expected value", () => {
    assert.equal(PROTOCOL_COMPONENTS.FORENSIC_MARKERS, "Forensic Markers");
  });

  test("has CONSTITUTIONAL_HARDLOCKS with expected value", () => {
    assert.equal(
      PROTOCOL_COMPONENTS.CONSTITUTIONAL_HARDLOCKS,
      "Constitutional Hardlocks",
    );
  });

  test("has exactly three component keys", () => {
    const keys = Object.keys(PROTOCOL_COMPONENTS);
    assert.equal(keys.length, 3);
  });
});

// ── PROTOCOL_VERSION ──────────────────────────────────────────────────────────

describe("PROTOCOL_VERSION", () => {
  test("is a semver-like string (X.Y.Z)", () => {
    assert.match(PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
  });

  test("is a non-empty string", () => {
    assert.equal(typeof PROTOCOL_VERSION, "string");
    assert.ok(PROTOCOL_VERSION.length > 0);
  });
});

// ── PROTOCOL_DISPLAY_LABEL ────────────────────────────────────────────────────

describe("PROTOCOL_DISPLAY_LABEL", () => {
  test("contains the PROTOCOL_VERSION", () => {
    assert.ok(PROTOCOL_DISPLAY_LABEL.includes(PROTOCOL_VERSION));
  });

  test("contains 'The Protocol™'", () => {
    assert.ok(PROTOCOL_DISPLAY_LABEL.includes("The Protocol™"));
  });

  test("is a non-empty string", () => {
    assert.equal(typeof PROTOCOL_DISPLAY_LABEL, "string");
    assert.ok(PROTOCOL_DISPLAY_LABEL.length > 0);
  });
});
