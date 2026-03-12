/**
 * __tests__/timePrecision.test.ts
 *
 * Unit tests for lib/timePrecision.ts — formatIso9()
 *
 * Covers:
 *   - Correct 9-digit fractional second formatting
 *   - Handling of Date objects, ISO strings, and edge cases
 *   - Lexicographic ordering property (important for D1 time-range queries)
 *
 * Perspective: human_developer + documentation
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/timePrecision.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatIso9 } from "../lib/timePrecision";

// ── Format shape ──────────────────────────────────────────────────────────────

describe("formatIso9() — output shape", () => {
  test("output ends with Z", () => {
    const result = formatIso9(new Date("2026-01-15T12:34:56.789Z"));
    assert.ok(result.endsWith("Z"), `Expected Z suffix, got: ${result}`);
  });

  test("output has exactly 9 fractional digits", () => {
    const result = formatIso9(new Date("2026-01-15T12:34:56.789Z"));
    const match  = result.match(/\.(\d+)Z$/);
    assert.ok(match, "No fractional digits found");
    assert.equal(match![1]!.length, 9, `Expected 9 digits, got: ${match![1]}`);
  });

  test("output is a valid ISO-8601 string parseable by Date", () => {
    const result = formatIso9(new Date("2026-01-15T00:00:00.000Z"));
    assert.ok(!isNaN(Date.parse(result)), `Not parseable: ${result}`);
  });

  test("preserves milliseconds and pads the sub-ms portion with zeros", () => {
    const result = formatIso9(new Date("2026-03-12T01:06:58.938Z"));
    assert.ok(result.includes(".938000000Z"), `Got: ${result}`);
  });

  test("pads milliseconds correctly when ms is single digit", () => {
    const result = formatIso9(new Date("2026-01-01T00:00:00.005Z"));
    assert.ok(result.includes(".005000000Z"), `Got: ${result}`);
  });

  test("pads milliseconds correctly when ms is zero", () => {
    const result = formatIso9(new Date("2026-01-01T00:00:00.000Z"));
    assert.ok(result.includes(".000000000Z"), `Got: ${result}`);
  });

  test("pads milliseconds correctly when ms is two digits", () => {
    const result = formatIso9(new Date("2026-01-01T00:00:00.042Z"));
    assert.ok(result.includes(".042000000Z"), `Got: ${result}`);
  });
});

// ── Input types ───────────────────────────────────────────────────────────────

describe("formatIso9() — input variants", () => {
  test("accepts a Date object", () => {
    const d      = new Date("2026-06-15T08:00:00.123Z");
    const result = formatIso9(d);
    assert.ok(result.startsWith("2026-06-15T08:00:00.123"));
  });

  test("accepts an ISO string", () => {
    const result = formatIso9("2026-06-15T08:00:00.456Z");
    assert.ok(result.startsWith("2026-06-15T08:00:00.456"));
  });

  test("uses current time when called with no argument", () => {
    const before = Date.now();
    const result = formatIso9();
    const after  = Date.now();
    const parsed = Date.parse(result);
    assert.ok(parsed >= before && parsed <= after, `Timestamp ${result} not in [before, after]`);
  });

  test("uses current time when called with null", () => {
    const before = Date.now();
    const result = formatIso9(null);
    const after  = Date.now();
    const parsed = Date.parse(result);
    assert.ok(parsed >= before && parsed <= after);
  });

  test("passes through non-parseable string as-is", () => {
    const result = formatIso9("not-a-date");
    assert.equal(result, "not-a-date");
  });
});

// ── Lexicographic ordering ────────────────────────────────────────────────────

describe("formatIso9() — lexicographic ordering", () => {
  test("earlier time sorts before later time lexicographically", () => {
    const earlier = formatIso9(new Date("2026-01-01T00:00:00.000Z"));
    const later   = formatIso9(new Date("2026-01-01T00:00:01.000Z"));
    assert.ok(earlier < later, `Expected "${earlier}" < "${later}"`);
  });

  test("same millisecond produces same string", () => {
    const d  = new Date("2026-03-12T01:06:58.938Z");
    const r1 = formatIso9(d);
    const r2 = formatIso9(d);
    assert.equal(r1, r2);
  });

  test("ten consecutive milliseconds produce strictly ordered strings", () => {
    const timestamps = Array.from({ length: 10 }, (_, i) =>
      formatIso9(new Date(1_700_000_000_000 + i * 1000)) // 1-second intervals
    );
    for (let i = 0; i < timestamps.length - 1; i++) {
      assert.ok(
        timestamps[i]! < timestamps[i + 1]!,
        `Order violation at index ${i}: "${timestamps[i]}" vs "${timestamps[i + 1]}"`,
      );
    }
  });
});

// ── QA Engine compatibility ───────────────────────────────────────────────────

describe("formatIso9() — QA Engine compatibility", () => {
  test("output length is always 30 characters (YYYY-MM-DDTHH:mm:ss.nnnnnnnnnZ)", () => {
    const samples = [
      "2026-01-01T00:00:00.000Z",
      "2026-06-15T12:34:56.789Z",
      "2026-12-31T23:59:59.999Z",
    ];
    for (const input of samples) {
      const result = formatIso9(new Date(input));
      assert.equal(result.length, 30, `Expected length 30 for "${result}"`);
    }
  });
});
