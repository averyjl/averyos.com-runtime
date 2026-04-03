/**
 * __tests__/useComplianceWindow.test.ts
 *
 * Unit tests for lib/hooks/useComplianceWindow.ts
 *
 * This module exports a React hook that uses useState and useEffect.  To test
 * it in Node.js without a browser/DOM we supply two custom ESM loaders:
 *   1. loader.mjs            — resolves extensionless TypeScript imports
 *   2. react-test-loader.mjs — intercepts `react` imports and redirects them
 *                              to react-test-mock.mjs (our minimal stub)
 *
 * The stub implements:
 *   - useState(initializer) — invokes the lazy initializer immediately,
 *     returns [value, noop-setter].
 *   - useEffect(fn) — records fn in capturedEffects without executing it.
 *   - getCapturedEffects() — returns all recorded effect functions.
 *
 * Run with:
 *   node --loader ./__tests__/loader.mjs \
 *        --loader ./__tests__/react-test-loader.mjs \
 *        --experimental-strip-types \
 *        --test __tests__/useComplianceWindow.test.ts
 *
 * Coverage:
 *   - formatElapsed() — days format and hours+mins+secs format
 *   - Status determination — ACTIVE vs ELAPSED
 *   - ComplianceWindowResult shape
 *   - useEffect registration
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
// The react-test-loader.mjs intercepts 'react' at module load time, so when
// useComplianceWindow.ts imports { useState, useEffect } from "react" it gets
// our stub.  Both modules share the same react-test-mock.mjs instance.
import { useComplianceWindow } from "../lib/hooks/useComplianceWindow";
import { getCapturedEffects } from "./react-test-mock.mjs";

// ── Test helper ───────────────────────────────────────────────────────────────

/**
 * Temporarily overrides Date.now() with a fixed timestamp, runs `testFn`,
 * then always restores the original implementation.  Eliminates duplication
 * in tests that need to control the "current" time.
 */
function withMockedDate<T>(fakeNowMs: number, testFn: () => T): T {
  const origDateNow = Date.now;
  (Date as unknown as { now: () => number }).now = () => fakeNowMs;
  try {
    return testFn();
  } finally {
    (Date as unknown as { now: () => number }).now = origDateNow;
  }
}

/** Millisecond timestamp of the JWKS ACTIVE broadcast that started the clock. */
const COMPLIANCE_START_UTC_MS = new Date("2026-03-12T00:00:00Z").getTime();

// ── useComplianceWindow() ─────────────────────────────────────────────────────

describe("useComplianceWindow()", () => {
  test("returns a ComplianceWindowResult with status and label fields", () => {
    const result = useComplianceWindow();
    assert.ok("status" in result, "result should have 'status' field");
    assert.ok("label" in result, "result should have 'label' field");
    assert.ok(
      result.status === "ACTIVE" || result.status === "ELAPSED",
      `status should be 'ACTIVE' or 'ELAPSED', got '${result.status}'`,
    );
    assert.ok(typeof result.label === "string");
    assert.ok(result.label.length > 0);
  });

  test("returns ELAPSED when more than 72 hours have passed since 2026-03-12", () => {
    const result = useComplianceWindow();
    // The compliance window started 2026-03-12T00:00:00Z.
    // 72 h = 2026-03-15T00:00:00Z — always in the past at test time (2026-03-26+).
    assert.equal(result.status, "ELAPSED");
  });

  test("label uses 'Xd Yh ZZm' format when many days have elapsed", () => {
    const result = useComplianceWindow();
    // With > 72 h elapsed the days branch of formatElapsed should fire.
    // Pattern: one or more digits, 'd', space, digits, 'h', space, 2-digit 'm'
    assert.match(result.label, /^\d+d \d+h \d{2}m$/);
  });

  test("useEffect is registered by the hook (effect captured by mock)", () => {
    const effects = getCapturedEffects();
    // The hook registers an interval effect; it should appear in the captured list.
    assert.ok(effects.length >= 1, "Expected at least one useEffect to be registered");
  });
});

// ── formatElapsed() — sub-day branch (< 1 day elapsed) ───────────────────────
// To cover the 'else' branch of formatElapsed (hours+mins+secs), temporarily
// override Date.now so the computed elapsed lands within the first 24 hours.

describe("formatElapsed() — sub-day branch (< 1 day elapsed)", () => {
  test("label uses 'Xh YYm ZZs' format when less than one day has elapsed", () => {
    // Place 'now' at 2h 05m 03s after the compliance window started
    const fakeNow = COMPLIANCE_START_UTC_MS + (2 * 3600 + 5 * 60 + 3) * 1_000;
    const result = withMockedDate(fakeNow, () => useComplianceWindow());
    // 2h 5m 3s from start is still within the 72-h ACTIVE window.
    assert.equal(result.status, "ACTIVE");
    // The label should match "Xh YYm ZZs" (days branch skipped when < 1 day).
    assert.match(result.label, /^\d+h \d{2}m \d{2}s$/);
  });

  test("status is ACTIVE when elapsed is exactly 1 minute after compliance start", () => {
    const fakeNow = COMPLIANCE_START_UTC_MS + 60 * 1_000; // 1 minute after start
    const result = withMockedDate(fakeNow, () => useComplianceWindow());
    assert.equal(result.status, "ACTIVE");
    // Label: "0h 01m 00s"
    assert.match(result.label, /^0h \d{2}m \d{2}s$/);
  });
});
