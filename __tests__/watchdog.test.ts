/**
 * __tests__/watchdog.test.ts
 *
 * Unit tests for lib/forensics/watchdog.ts
 *
 * Covers:
 *   - USI_PENALTY_USD and SILENCE_WINDOW_MS constants
 *   - recordStepC() — persists Step C echo to in-memory ledger
 *   - raiseSilenceViolation() — creates USI violation with $10,000 penalty
 *   - checkForSilence() — returns null when echo present; raises USI on silence
 *   - getUsiLog() — returns all raised violations
 *   - getEchoLedger() — returns all recorded echoes
 *   - watchdogPulse() — batch silence checker
 *   - ensureWatchdogTables() — schema DDL smoke test (null db → no throw)
 *
 * Perspective: sovereign_enforcer (watchdog) + human_developer (operator)
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/watchdog.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  USI_PENALTY_USD,
  SILENCE_WINDOW_MS,
  recordStepC,
  raiseSilenceViolation,
  checkForSilence,
  getUsiLog,
  getEchoLedger,
  watchdogPulse,
  type StepCEcho,
  type UsiViolation,
} from "../lib/forensics/watchdog";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Constants ─────────────────────────────────────────────────────────────────

describe("watchdog constants", () => {
  test("USI_PENALTY_USD is $10,000", () => {
    assert.strictEqual(USI_PENALTY_USD, 10_000);
  });

  test("SILENCE_WINDOW_MS is 30,000 ms (30 seconds)", () => {
    assert.strictEqual(SILENCE_WINDOW_MS, 30_000);
  });
});

// ── StepCEcho helpers ─────────────────────────────────────────────────────────

function makeEcho(overrides: Partial<StepCEcho> = {}): StepCEcho {
  return {
    requestId:          "req-test-001",
    moduleId:           "STRIPE",
    initiatedAt:        new Date(Date.now() - 200).toISOString(),
    responseReceivedAt: new Date(Date.now() - 100).toISOString(),
    echoConfirmedAt:    new Date().toISOString(),
    cfRay:              "abc123-LHR",
    physicalityStatus:  "PHYSICAL_TRUTH",
    ...overrides,
  };
}

// ── recordStepC ───────────────────────────────────────────────────────────────

describe("recordStepC", () => {
  test("records a Step C echo in the in-memory ledger", async () => {
    const echo = makeEcho({ requestId: "req-record-001" });
    await recordStepC(echo);
    const ledger = getEchoLedger();
    assert.ok(ledger.has("req-record-001"), "echo should be in ledger");
    const stored = ledger.get("req-record-001")!;
    assert.strictEqual(stored.moduleId, "STRIPE");
    assert.strictEqual(stored.physicalityStatus, "PHYSICAL_TRUTH");
  });

  test("stores cfRay correctly", async () => {
    const echo = makeEcho({ requestId: "req-ray-001", cfRay: "xyz999-SFO" });
    await recordStepC(echo);
    const stored = getEchoLedger().get("req-ray-001");
    assert.ok(stored, "echo must be stored");
    assert.strictEqual(stored.cfRay, "xyz999-SFO");
  });

  test("handles null cfRay (non-Cloudflare endpoint)", async () => {
    const echo = makeEcho({ requestId: "req-noray-001", cfRay: null, physicalityStatus: "LATENT_ARTIFACT" });
    await recordStepC(echo);
    const stored = getEchoLedger().get("req-noray-001");
    assert.ok(stored, "echo must be stored");
    assert.strictEqual(stored.cfRay, null);
    assert.strictEqual(stored.physicalityStatus, "LATENT_ARTIFACT");
  });

  test("does not throw when db is null (no persistence)", async () => {
    const echo = makeEcho({ requestId: "req-nodb-001" });
    await assert.doesNotReject(() => recordStepC(echo, null));
  });
});

// ── raiseSilenceViolation ─────────────────────────────────────────────────────

describe("raiseSilenceViolation", () => {
  test("returns a USI violation with $10,000 penalty", async () => {
    const v: UsiViolation = await raiseSilenceViolation("NODE02", "Test silence violation", null);
    assert.strictEqual(v.penaltyUsd, USI_PENALTY_USD);
    assert.strictEqual(v.moduleId, "NODE02");
    assert.ok(v.id.startsWith("USI-NODE02-"), `id should start with USI-NODE02-, got: ${v.id}`);
    assert.strictEqual(v.kernelSha,     KERNEL_SHA);
    assert.strictEqual(v.kernelVersion, KERNEL_VERSION);
  });

  test("violation reason is preserved", async () => {
    const reason = "Specific silence reason for test";
    const v = await raiseSilenceViolation("D1", reason, null);
    assert.strictEqual(v.reason, reason);
  });

  test("violation appears in getUsiLog()", async () => {
    const moduleBefore = "R2-UNIQUE-" + Date.now();
    await raiseSilenceViolation(moduleBefore, "test", null);
    const log = getUsiLog();
    const found = log.find(v => v.moduleId === moduleBefore);
    assert.ok(found, "violation should appear in USI log");
  });

  test("does not throw when db is null", async () => {
    await assert.doesNotReject(() =>
      raiseSilenceViolation("TARI", "null db test", null),
    );
  });
});

// ── checkForSilence ───────────────────────────────────────────────────────────

describe("checkForSilence", () => {
  test("returns null when Step C echo is already recorded", async () => {
    const requestId = "req-check-present-" + Date.now();
    await recordStepC(makeEcho({ requestId }));
    const result = await checkForSilence(requestId, "VAULTCHAIN", new Date().toISOString(), 30_000, null);
    assert.strictEqual(result, null);
  });

  test("returns null when still within the silence window (recent initiation)", async () => {
    const requestId = "req-check-recent-" + Date.now();
    // Initiated just now — well within 30 s window
    const initiatedAt = new Date().toISOString();
    const result = await checkForSilence(requestId, "STRIPE", initiatedAt, 30_000, null);
    assert.strictEqual(result, null, "should not raise violation within window");
  });

  test("raises USI violation when silence window has elapsed and no echo recorded", async () => {
    const requestId = "req-check-elapsed-" + Date.now();
    // Initiated 60 seconds ago — past the 30 s window
    const initiatedAt = new Date(Date.now() - 60_000).toISOString();
    const violation = await checkForSilence(requestId, "GABRIELOS", initiatedAt, 30_000, null);
    assert.ok(violation !== null, "should raise violation when window elapsed");
    assert.strictEqual(violation!.moduleId, "GABRIELOS");
    assert.strictEqual(violation!.penaltyUsd, USI_PENALTY_USD);
  });
});

// ── watchdogPulse ─────────────────────────────────────────────────────────────

describe("watchdogPulse", () => {
  test("returns empty array when all requests have echoes", async () => {
    const id1 = "pulse-echo-" + Date.now() + "-1";
    const id2 = "pulse-echo-" + Date.now() + "-2";
    await recordStepC(makeEcho({ requestId: id1, moduleId: "D1" }));
    await recordStepC(makeEcho({ requestId: id2, moduleId: "R2" }));
    const violations = await watchdogPulse([
      { requestId: id1, moduleId: "D1", initiatedAt: new Date().toISOString() },
      { requestId: id2, moduleId: "R2", initiatedAt: new Date().toISOString() },
    ], 30_000, null);
    assert.strictEqual(violations.length, 0);
  });

  test("returns violations only for timed-out requests without echoes", async () => {
    const echoId    = "pulse-mix-echo-"   + Date.now();
    const silentId  = "pulse-mix-silent-" + Date.now();
    await recordStepC(makeEcho({ requestId: echoId, moduleId: "STRIPE" }));
    const violations = await watchdogPulse([
      { requestId: echoId,   moduleId: "STRIPE",    initiatedAt: new Date().toISOString() },
      { requestId: silentId, moduleId: "SSP",        initiatedAt: new Date(Date.now() - 60_000).toISOString() },
    ], 30_000, null);
    assert.strictEqual(violations.length, 1, "exactly one violation for the silent request");
    assert.strictEqual(violations[0].moduleId, "SSP");
  });

  test("returns empty array for empty pending list", async () => {
    const violations = await watchdogPulse([], 30_000, null);
    assert.deepStrictEqual(violations, []);
  });
});

// ── getEchoLedger ─────────────────────────────────────────────────────────────

describe("getEchoLedger", () => {
  test("returns a copy (modifying return value does not affect internal state)", async () => {
    const id = "ledger-copy-" + Date.now();
    await recordStepC(makeEcho({ requestId: id }));
    const copy = getEchoLedger();
    copy.delete(id);
    // Original should still have the entry
    const original = getEchoLedger();
    assert.ok(original.has(id), "internal ledger should be unchanged");
  });
});
