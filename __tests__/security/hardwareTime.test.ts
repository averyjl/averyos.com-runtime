/**
 * __tests__/security/hardwareTime.test.ts
 *
 * AveryOS™ World-Class QA — lib/security/hardwareTime.ts
 *
 * Covers every exported symbol:
 *   - HardwarePulse / AstDelta interfaces (shape checks)
 *   - astStart()               — returns a HardwarePulse
 *   - astEnd()                 — returns a HardwarePulse
 *   - astDelta()               — Physical Delta from two HardwarePulses
 *   - hardwareNowMs()          — returns current epoch ms
 *   - physicalClockAvailable() — boolean reflecting runtime capability
 *   - clockPhysicalityStatus() — "PHYSICAL" | "LATENT"
 *
 * Perspectives: forensic_timing · adversarial_probe · platform_neutrality
 *
 * Run with:
 *   node --loader ./__tests__/loader.mjs --experimental-strip-types \
 *     --test __tests__/security/hardwareTime.test.ts
 *
 * ⛓️⚓⛓️  TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  type HardwarePulse,
  type AstDelta,
  astStart,
  astEnd,
  astDelta,
  hardwareNowMs,
  physicalClockAvailable,
  clockPhysicalityStatus,
} from "../../lib/security/hardwareTime";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Assert that a value looks like an ISO-9 timestamp (YYYY-MM-DDTHH:MM:SS.nnnnnnnnnZ). */
function assertIso9Shape(value: string, label: string): void {
  assert.match(
    value,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/,
    `${label} is not ISO-9: "${value}"`,
  );
}

/** Assert the shape of a HardwarePulse object. */
function assertHardwarePulseShape(pulse: HardwarePulse, label: string): void {
  assert.equal(typeof pulse.hrNs,   "bigint", `${label}.hrNs must be bigint`);
  assert.equal(typeof pulse.wallMs, "number", `${label}.wallMs must be number`);
  assert.equal(typeof pulse.iso9,   "string", `${label}.iso9 must be string`);
  assert.ok(pulse.hrNs >= 0n,                 `${label}.hrNs must be non-negative`);
  assert.ok(pulse.wallMs > 0,                 `${label}.wallMs must be positive`);
  assertIso9Shape(pulse.iso9, `${label}.iso9`);
}

// ── astStart() ────────────────────────────────────────────────────────────────

describe("astStart()", () => {
  test("returns a HardwarePulse with the correct shape", () => {
    const pulse = astStart();
    assertHardwarePulseShape(pulse, "astStart()");
  });

  test("hrNs is a bigint", () => {
    const pulse = astStart();
    assert.equal(typeof pulse.hrNs, "bigint");
  });

  test("wallMs is a recent Unix epoch (> 2025-01-01)", () => {
    const pulse = astStart();
    const jan2025 = new Date("2025-01-01T00:00:00Z").getTime();
    assert.ok(pulse.wallMs > jan2025, `wallMs (${pulse.wallMs}) must be after 2025-01-01`);
  });

  test("iso9 is a valid ISO-9 string", () => {
    const pulse = astStart();
    assertIso9Shape(pulse.iso9, "astStart().iso9");
  });

  test("two consecutive calls produce non-decreasing hrNs", () => {
    const p1 = astStart();
    const p2 = astStart();
    assert.ok(p2.hrNs >= p1.hrNs, "Second astStart().hrNs must be >= first (monotone clock)");
  });

  test("two consecutive calls produce non-decreasing wallMs", () => {
    const p1 = astStart();
    const p2 = astStart();
    assert.ok(p2.wallMs >= p1.wallMs, "Second astStart().wallMs must be >= first");
  });
});

// ── astEnd() ──────────────────────────────────────────────────────────────────

describe("astEnd()", () => {
  test("returns a HardwarePulse with the correct shape", () => {
    const pulse = astEnd();
    assertHardwarePulseShape(pulse, "astEnd()");
  });

  test("hrNs from astEnd() is >= hrNs from a preceding astStart()", () => {
    const start = astStart();
    const end   = astEnd();
    assert.ok(end.hrNs >= start.hrNs, "astEnd().hrNs must be >= astStart().hrNs");
  });

  test("wallMs from astEnd() is >= wallMs from preceding astStart()", () => {
    const start = astStart();
    const end   = astEnd();
    assert.ok(end.wallMs >= start.wallMs, "astEnd().wallMs must be >= astStart().wallMs");
  });
});

// ── astDelta() ────────────────────────────────────────────────────────────────

describe("astDelta()", () => {
  test("returns an AstDelta with the correct shape", () => {
    const start = astStart();
    const end   = astEnd();
    const delta: AstDelta = astDelta(start, end);
    assert.equal(typeof delta.ms,      "number", "delta.ms must be number");
    assert.equal(typeof delta.ns,      "bigint", "delta.ns must be bigint");
    assert.equal(typeof delta.display, "string", "delta.display must be string");
  });

  test("ms is non-negative", () => {
    const start = astStart();
    const end   = astEnd();
    const delta = astDelta(start, end);
    assert.ok(delta.ms >= 0, "delta.ms must be non-negative");
  });

  test("ns is non-negative bigint", () => {
    const start = astStart();
    const end   = astEnd();
    const delta = astDelta(start, end);
    assert.ok(delta.ns >= 0n, "delta.ns must be non-negative");
  });

  test("display string ends with 's'", () => {
    const start = astStart();
    const end   = astEnd();
    const delta = astDelta(start, end);
    assert.ok(delta.display.endsWith("s"), `display must end with 's': "${delta.display}"`);
  });

  test("display string has format '<whole>.<9-digit-frac>s'", () => {
    const start = astStart();
    const end   = astEnd();
    const delta = astDelta(start, end);
    // Bounded quantifier {1,20} prevents ReDoS on the whole-seconds portion.
    assert.match(delta.display, /^\d{1,20}\.\d{9}s$/, `display format mismatch: "${delta.display}"`);
  });

  test("delta from same pulse (start === end) produces 0ns", () => {
    const start = astStart();
    // Use same pulse for both start and end
    const delta = astDelta(start, start);
    assert.equal(delta.ns, 0n,  "Same-pulse delta must be 0ns");
    assert.equal(delta.ms, 0,   "Same-pulse delta must be 0ms");
  });

  test("astDelta handles inverted pulses (end.hrNs < start.hrNs) without throwing", () => {
    // Construct artificial inverted pulses — end has smaller hrNs than start.
    const now = astStart();
    const invertedStart: HardwarePulse = { hrNs: now.hrNs + 1_000n, wallMs: now.wallMs, iso9: now.iso9 };
    const invertedEnd:   HardwarePulse = { hrNs: now.hrNs,           wallMs: now.wallMs, iso9: now.iso9 };
    // Verify that astDelta does not throw on inverted order
    assert.doesNotThrow(() => astDelta(invertedStart, invertedEnd));
    const delta = astDelta(invertedStart, invertedEnd);
    // The implementation clamps to 0 when end < start
    assert.equal(delta.ns, 0n, "Inverted pulses must produce 0ns delta");
    assert.equal(delta.ms, 0,  "Inverted pulses must produce 0ms delta");
  });

  test("ms is consistent with ns (within 1ms rounding)", () => {
    const start = astStart();
    // Busy-wait for at least ~1ms to ensure a non-trivial delta
    const limit = BigInt(Date.now() + 2) * 1_000_000n;
    while (astEnd().hrNs < start.hrNs + 1_000_000n && BigInt(Date.now()) * 1_000_000n < limit) {
      // spin
    }
    const end   = astEnd();
    const delta = astDelta(start, end);
    const expectedMs = Number(delta.ns / 1_000_000n);
    assert.equal(delta.ms, expectedMs, "delta.ms must match delta.ns / 1,000,000");
  });

  test("display seconds part matches ns value", () => {
    const start = astStart();
    const end   = astEnd();
    const delta = astDelta(start, end);
    const wholeSeconds = Number(delta.ns / 1_000_000_000n);
    // Bounded quantifier {1,20} prevents ReDoS on the captured whole-seconds group.
    const match = delta.display.match(/^(\d{1,20})\./);
    assert.ok(match, "display must start with a whole number");
    assert.equal(Number(match![1]), wholeSeconds, "display whole-seconds must match delta.ns / 1e9");
  });
});

// ── hardwareNowMs() ───────────────────────────────────────────────────────────

describe("hardwareNowMs()", () => {
  test("returns a number", () => {
    assert.equal(typeof hardwareNowMs(), "number");
  });

  test("returns a recent Unix epoch ms (> 2025-01-01)", () => {
    const jan2025 = new Date("2025-01-01T00:00:00Z").getTime();
    assert.ok(hardwareNowMs() > jan2025);
  });

  test("returns a positive integer", () => {
    const now = hardwareNowMs();
    assert.ok(Number.isInteger(now), "hardwareNowMs() must be an integer");
    assert.ok(now > 0, "hardwareNowMs() must be positive");
  });

  test("two consecutive calls are non-decreasing", () => {
    const t1 = hardwareNowMs();
    const t2 = hardwareNowMs();
    assert.ok(t2 >= t1, "Second call must be >= first call");
  });

  test("is close to Date.now() (within 100ms)", () => {
    const ours  = hardwareNowMs();
    const native = Date.now();
    assert.ok(Math.abs(native - ours) < 100, "hardwareNowMs() must be within 100ms of Date.now()");
  });
});

// ── physicalClockAvailable() ──────────────────────────────────────────────────

describe("physicalClockAvailable()", () => {
  test("returns a boolean", () => {
    const result = physicalClockAvailable();
    assert.equal(typeof result, "boolean");
  });

  test("returns true on Node.js (process.hrtime.bigint is available)", () => {
    // This test suite runs under Node.js, so PHYSICAL should be available.
    const result = physicalClockAvailable();
    assert.equal(result, true, "physicalClockAvailable() must return true in Node.js test env");
  });
});

// ── clockPhysicalityStatus() ──────────────────────────────────────────────────

describe("clockPhysicalityStatus()", () => {
  test("returns 'PHYSICAL' or 'LATENT'", () => {
    const status = clockPhysicalityStatus();
    assert.ok(
      status === "PHYSICAL" || status === "LATENT",
      `clockPhysicalityStatus() must be PHYSICAL or LATENT, got: ${status}`,
    );
  });

  test("returns 'PHYSICAL' on Node.js runtime", () => {
    const status = clockPhysicalityStatus();
    assert.equal(status, "PHYSICAL", "Status must be PHYSICAL in Node.js test environment");
  });

  test("is consistent with physicalClockAvailable()", () => {
    const available = physicalClockAvailable();
    const status    = clockPhysicalityStatus();
    if (available) {
      assert.equal(status, "PHYSICAL", "If physicalClockAvailable() is true, status must be PHYSICAL");
    } else {
      assert.equal(status, "LATENT",   "If physicalClockAvailable() is false, status must be LATENT");
    }
  });
});

// ── Integration: full AST lifecycle ──────────────────────────────────────────

describe("Integration: full AST lifecycle (astStart → astEnd → astDelta)", () => {
  test("a complete AST lifecycle produces a valid non-negative delta", () => {
    const t0    = astStart();
    const t1    = astEnd();
    const delta = astDelta(t0, t1);

    assert.ok(delta.ns  >= 0n,  "delta.ns must be non-negative");
    assert.ok(delta.ms  >= 0,   "delta.ms must be non-negative");
    assert.ok(delta.display.endsWith("s"), "display must end with 's'");
  });

  test("wallMs in the start pulse is parseable and matches iso9 date-part", () => {
    const pulse = astStart();
    const fromWall = new Date(pulse.wallMs).toISOString().slice(0, 10); // YYYY-MM-DD
    const fromIso9 = pulse.iso9.slice(0, 10);
    assert.equal(fromWall, fromIso9, "iso9 date part must match wallMs date part");
  });
});

// ── Adversarial / Edge-Case Tests ─────────────────────────────────────────────

describe("Adversarial: astDelta with artificial zero-ns pulses", () => {
  test("astDelta with hrNs=0n for both start and end returns 0 delta", () => {
    const zeroPulse: HardwarePulse = { hrNs: 0n, wallMs: Date.now(), iso9: astStart().iso9 };
    const delta = astDelta(zeroPulse, zeroPulse);
    assert.equal(delta.ns, 0n);
    assert.equal(delta.ms, 0);
    assert.equal(delta.display, "0.000000000s");
  });

  test("astDelta with very large hrNs values does not lose precision", () => {
    // Simulate a 1-hour gap: 3_600_000_000_000 ns
    const oneHourNs = 3_600_000_000_000n;
    const start: HardwarePulse = { hrNs: 0n, wallMs: 0, iso9: astStart().iso9 };
    const end:   HardwarePulse = { hrNs: oneHourNs, wallMs: 0, iso9: astStart().iso9 };
    const delta = astDelta(start, end);
    assert.equal(delta.ns, oneHourNs,        "ns must equal 1h exactly");
    assert.equal(delta.ms, 3_600_000,        "ms must equal 3,600,000");
    assert.equal(delta.display, "3600.000000000s", "display must be 3600.000000000s");
  });
});

describe("Adversarial: Multiple rapid astStart()/astEnd() calls", () => {
  test("100 rapid calls to astStart() all return valid pulses", () => {
    for (let i = 0; i < 100; i++) {
      const pulse = astStart();
      assertHardwarePulseShape(pulse, `astStart() call ${i}`);
    }
  });

  test("hardwareNowMs() called 100 times remains monotone", () => {
    let prev = hardwareNowMs();
    for (let i = 0; i < 100; i++) {
      const now = hardwareNowMs();
      assert.ok(now >= prev, `hardwareNowMs() must be monotone at call ${i}`);
      prev = now;
    }
  });
});
