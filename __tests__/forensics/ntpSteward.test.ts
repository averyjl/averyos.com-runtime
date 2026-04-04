/**
 * __tests__/forensics/ntpSteward.test.ts
 *
 * AveryOS™ World-Class QA — lib/forensics/ntpSteward.ts
 *
 * Covers every exported symbol:
 *   - StewardSyncResult / StewardState interfaces (shape checks)
 *   - startNtpSteward()   — starts polling, sets running=true
 *   - stopNtpSteward()    — clears intervals, sets running=false
 *   - getStewardState()   — returns immutable snapshot
 *   - triggerActiveSync() — returns StewardSyncResult with poolType "active"
 *   - triggerAuditSync()  — returns StewardSyncResult with poolType "audit"
 *   - onStewardSync()     — listener registration and notification
 *
 * Design note: triggerActiveSync / triggerAuditSync make real HTTP calls to
 * sovereign time sources (3 s timeout each).  To keep CI fast, network-
 * dependent tests share a single pre-fetched result captured once in a
 * module-level setup block.  Pure structural tests run without network.
 *
 * Perspectives: forensic_audit · time_integrity · adversarial_probe
 *
 * Run with:
 *   node --loader ./__tests__/loader.mjs --experimental-strip-types \
 *     --test __tests__/forensics/ntpSteward.test.ts
 *
 * ⛓️⚓⛓️  TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  type StewardSyncResult,
  type StewardState,
  startNtpSteward,
  stopNtpSteward,
  getStewardState,
  triggerActiveSync,
  triggerAuditSync,
  onStewardSync,
} from "../../lib/forensics/ntpSteward";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Assert an ISO-9 compatible timestamp string. */
function assertIso9(value: string, label: string): void {
  assert.match(
    value,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/,
    `${label} is not ISO-9: ${value}`,
  );
}

/** Assert the full StewardSyncResult schema. */
function assertSyncResultShape(result: StewardSyncResult, label: string): void {
  assert.equal(typeof result.ts,            "string",  `${label}.ts must be string`);
  assert.equal(typeof result.poolType,      "string",  `${label}.poolType must be string`);
  assert.ok(
    result.poolType === "active" || result.poolType === "audit",
    `${label}.poolType must be "active" or "audit"`,
  );
  assert.ok(result.result !== null && typeof result.result === "object", `${label}.result must be an object`);
  assert.ok(Array.isArray(result.quarantined),                           `${label}.quarantined must be an array`);
  assert.equal(typeof result.replacedSlots, "number",  `${label}.replacedSlots must be number`);
  assert.equal(typeof result.runCount,      "number",  `${label}.runCount must be number`);
  assert.equal(typeof result.kernelSha,     "string",  `${label}.kernelSha must be string`);
  assert.equal(typeof result.kernelVersion, "string",  `${label}.kernelVersion must be string`);
  assertIso9(result.ts, `${label}.ts`);
}

// ── Shared network results (fetched once to keep CI fast) ────────────────────

let sharedActiveResult: StewardSyncResult;
let sharedAuditResult:  StewardSyncResult;
let activeSyncsBeforeFetch: number;
let auditSyncsBeforeFetch:  number;

before(async () => {
  // Capture sync counts before triggering so increment tests are correct.
  const state = getStewardState();
  activeSyncsBeforeFetch = state.activeSyncs;
  auditSyncsBeforeFetch  = state.auditSyncs;

  // Single network round-trip for the entire test suite.
  sharedActiveResult = await triggerActiveSync();
  sharedAuditResult  = await triggerAuditSync();
});

after(() => {
  stopNtpSteward();
});

// ── StewardState initial / structural shape ───────────────────────────────────

describe("getStewardState() — state shape", () => {
  test("returns a state snapshot with all required fields", () => {
    const state: Readonly<StewardState> = getStewardState();
    assert.equal(typeof state.activeSyncs,  "number",  "activeSyncs must be number");
    assert.equal(typeof state.auditSyncs,   "number",  "auditSyncs must be number");
    assert.equal(typeof state.running,      "boolean", "running must be boolean");
    assert.ok(
      state.lastActiveSync === null || typeof state.lastActiveSync === "object",
      "lastActiveSync must be null or object",
    );
    assert.ok(
      state.lastAuditSync === null || typeof state.lastAuditSync === "object",
      "lastAuditSync must be null or object",
    );
  });

  test("activeSyncs and auditSyncs are non-negative integers", () => {
    const state = getStewardState();
    assert.ok(state.activeSyncs >= 0,   "activeSyncs must be >= 0");
    assert.ok(state.auditSyncs  >= 0,   "auditSyncs must be >= 0");
    assert.ok(Number.isInteger(state.activeSyncs), "activeSyncs must be integer");
    assert.ok(Number.isInteger(state.auditSyncs),  "auditSyncs must be integer");
  });

  test("getStewardState() returns a snapshot copy, not the internal reference", () => {
    const snapshot1 = getStewardState();
    const snapshot2 = getStewardState();
    assert.notEqual(snapshot1, snapshot2, "getStewardState() must return a new object each time");
  });

  test("lastActiveSync is populated after the before() setup sync", () => {
    const state = getStewardState();
    assert.ok(state.lastActiveSync !== null, "lastActiveSync must be set after active sync");
    assertSyncResultShape(state.lastActiveSync!, "lastActiveSync");
  });

  test("lastAuditSync is populated after the before() setup sync", () => {
    const state = getStewardState();
    assert.ok(state.lastAuditSync !== null, "lastAuditSync must be set after audit sync");
    assertSyncResultShape(state.lastAuditSync!, "lastAuditSync");
  });
});

// ── startNtpSteward() / stopNtpSteward() ──────────────────────────────────────

describe("startNtpSteward() / stopNtpSteward()", () => {
  test("startNtpSteward() sets running to true", () => {
    startNtpSteward();
    assert.equal(getStewardState().running, true);
    stopNtpSteward(); // cleanup immediately
  });

  test("stopNtpSteward() sets running to false", () => {
    startNtpSteward();
    stopNtpSteward();
    assert.equal(getStewardState().running, false);
  });

  test("calling startNtpSteward() twice does not throw", () => {
    assert.doesNotThrow(() => {
      startNtpSteward();
      startNtpSteward(); // second call — should warn, not throw
    });
    stopNtpSteward();
  });

  test("calling stopNtpSteward() when not running does not throw", () => {
    assert.doesNotThrow(() => {
      stopNtpSteward();
      stopNtpSteward(); // already stopped
    });
  });

  test("startedAt is a valid ISO-9 string after startNtpSteward()", () => {
    startNtpSteward();
    const state = getStewardState();
    assert.ok(state.startedAt !== null, "startedAt must be set after start");
    assertIso9(state.startedAt!, "state.startedAt");
    stopNtpSteward();
  });
});

// ── triggerActiveSync() — uses sharedActiveResult ─────────────────────────────

describe("triggerActiveSync() — result shape", () => {
  test("returns a valid StewardSyncResult", () => {
    assertSyncResultShape(sharedActiveResult, "sharedActiveResult");
  });

  test("poolType is 'active'", () => {
    assert.equal(sharedActiveResult.poolType, "active");
  });

  test("kernelSha matches KERNEL_SHA from sovereignConstants", () => {
    assert.equal(sharedActiveResult.kernelSha, KERNEL_SHA);
  });

  test("kernelVersion matches KERNEL_VERSION from sovereignConstants", () => {
    assert.equal(sharedActiveResult.kernelVersion, KERNEL_VERSION);
  });

  test("runCount incremented from baseline after the before() sync", () => {
    assert.ok(
      sharedActiveResult.runCount > activeSyncsBeforeFetch,
      `runCount (${sharedActiveResult.runCount}) must be greater than pre-sync count (${activeSyncsBeforeFetch})`,
    );
  });

  test("quarantined is an array", () => {
    assert.ok(Array.isArray(sharedActiveResult.quarantined));
  });

  test("replacedSlots equals quarantined.length", () => {
    assert.equal(sharedActiveResult.replacedSlots, sharedActiveResult.quarantined.length);
  });

  test("ts is a valid ISO-9 timestamp", () => {
    assertIso9(sharedActiveResult.ts, "sharedActiveResult.ts");
  });
});

// ── triggerAuditSync() — uses sharedAuditResult ───────────────────────────────

describe("triggerAuditSync() — result shape", () => {
  test("returns a valid StewardSyncResult", () => {
    assertSyncResultShape(sharedAuditResult, "sharedAuditResult");
  });

  test("poolType is 'audit'", () => {
    assert.equal(sharedAuditResult.poolType, "audit");
  });

  test("kernelSha matches KERNEL_SHA", () => {
    assert.equal(sharedAuditResult.kernelSha, KERNEL_SHA);
  });

  test("kernelVersion matches KERNEL_VERSION", () => {
    assert.equal(sharedAuditResult.kernelVersion, KERNEL_VERSION);
  });

  test("runCount incremented from baseline after the before() sync", () => {
    assert.ok(
      sharedAuditResult.runCount > auditSyncsBeforeFetch,
      `runCount (${sharedAuditResult.runCount}) must be greater than pre-sync count (${auditSyncsBeforeFetch})`,
    );
  });

  test("quarantined is always empty for audit syncs", () => {
    assert.equal(sharedAuditResult.quarantined.length, 0, "Audit syncs never quarantine sources");
  });

  test("replacedSlots is 0 for audit syncs", () => {
    assert.equal(sharedAuditResult.replacedSlots, 0);
  });
});

// ── onStewardSync() ───────────────────────────────────────────────────────────

describe("onStewardSync()", () => {
  test("registered listener is called on triggerActiveSync()", { timeout: 10_000 }, async () => {
    let called = false;
    onStewardSync((result) => {
      if (result.poolType === "active") called = true;
    });
    await triggerActiveSync();
    assert.equal(called, true, "Listener must be called after triggerActiveSync");
  });

  test("multiple listeners all receive the sync result", { timeout: 10_000 }, async () => {
    const received: string[] = [];
    onStewardSync(() => received.push("X"));
    onStewardSync(() => received.push("Y"));
    await triggerActiveSync();
    assert.ok(received.includes("X"), "Listener X must be called");
    assert.ok(received.includes("Y"), "Listener Y must be called");
  });
});

// ── Adversarial / Edge-Case Tests ─────────────────────────────────────────────

describe("Adversarial: State snapshot immutability", () => {
  test("mutating a getStewardState() snapshot does not affect internal state", () => {
    const snapshot = getStewardState() as StewardState;
    const originalCount = snapshot.activeSyncs;
    snapshot.activeSyncs = 99999; // adversarial mutation
    const fresh = getStewardState();
    assert.notEqual(fresh.activeSyncs, 99999, "Internal activeSyncs must be unaffected by snapshot mutation");
    // The fresh count should be >= the original (syncs only go up)
    assert.ok(fresh.activeSyncs >= originalCount, "Fresh activeSyncs must be >= original count");
  });
});

describe("Adversarial: Concurrent sync calls", () => {
  test("two concurrent triggerActiveSync calls both resolve with valid results", { timeout: 12_000 }, async () => {
    const [r1, r2] = await Promise.all([
      triggerActiveSync(),
      triggerActiveSync(),
    ]);
    assertSyncResultShape(r1, "concurrent sync 1");
    assertSyncResultShape(r2, "concurrent sync 2");
    // Both results must be non-zero run counts (not initial state)
    assert.ok(r1.runCount > 0, "r1 runCount must be positive");
    assert.ok(r2.runCount > 0, "r2 runCount must be positive");
  });
});

