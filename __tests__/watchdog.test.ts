/**
 * __tests__/watchdog.test.ts
 *
 * AveryOS™ GabrielOS™ Watchdog — 100% coverage test suite
 * Phase 117.7 GATE 117.7.4
 *
 * Verifies:
 *   1. haltBoot() produces a valid HaltBootResult with all required fields.
 *   2. HALT_BOOT fires a Tier-9 Audit Alert (alertFired = true).
 *   3. haltSha512 is a valid 128-char hex SHA-512.
 *   4. autoHealHint is populated for every HaltReason.
 *   5. getHaltLog() / hasHalted() reflect the halt state correctly.
 *   6. watchdogPulse() returns healthy=false after a halt.
 *   7. bubbleUpgrade() calls D1 with the correct fields.
 *   8. Multiple consecutive halts accumulate in the log.
 *
 * Run with: node --experimental-strip-types --test __tests__/watchdog.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  haltBoot,
  watchdogPulse,
  getHaltLog,
  hasHalted,
  bubbleUpgrade,
  type HaltBootInput,
  type HaltReason,
} from "../lib/forensics/watchdog";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Minimal HALT_BOOT input for testing. */
function makeInput(overrides?: Partial<HaltBootInput>): HaltBootInput {
  return {
    module: "test/watchdog",
    reason: "RTV_FAILURE",
    detail: "Test RTV failure detail",
    phase:  "117.7",
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("haltBoot()", () => {
  test("returns a valid HaltBootResult with all required fields", async () => {
    const input  = makeInput();
    const result = await haltBoot(input);

    assert.equal(typeof result, "object");
    assert.equal(typeof result.ts,            "string",  "ts must be a string");
    assert.equal(typeof result.module,        "string",  "module must be a string");
    assert.equal(typeof result.reason,        "string",  "reason must be a string");
    assert.equal(typeof result.detail,        "string",  "detail must be a string");
    assert.equal(typeof result.haltSha512,    "string",  "haltSha512 must be a string");
    assert.equal(typeof result.autoHealHint,  "string",  "autoHealHint must be a string");
    assert.equal(typeof result.alertFired,    "boolean", "alertFired must be a boolean");
    assert.equal(typeof result.d1Written,     "boolean", "d1Written must be a boolean");
  });

  test("module and reason are echoed back correctly", async () => {
    const input  = makeInput({ module: "lib/security/sovereignFetch", reason: "CERT_PINNING_VIOLATION" });
    const result = await haltBoot(input);

    assert.equal(result.module, "lib/security/sovereignFetch");
    assert.equal(result.reason, "CERT_PINNING_VIOLATION");
    assert.equal(result.detail, input.detail);
  });

  test("haltSha512 is a valid 128-char hex SHA-512", async () => {
    const result = await haltBoot(makeInput());
    assert.match(result.haltSha512, /^[0-9a-f]{128}$/, "haltSha512 must be 128 hex chars");
  });

  test("alertFired is true (Tier-9 alert is dispatched fire-and-forget)", async () => {
    const result = await haltBoot(makeInput());
    assert.equal(result.alertFired, true, "Tier-9 alert must be fired on every HALT_BOOT");
  });

  test("driftSha512 is null when no sha512 is supplied", async () => {
    const result = await haltBoot(makeInput());
    assert.equal(result.driftSha512, null);
  });

  test("driftSha512 echoes the supplied sha512", async () => {
    const driftSha = KERNEL_SHA;
    const result   = await haltBoot(makeInput({ sha512: driftSha }));
    assert.equal(result.driftSha512, driftSha);
  });

  test("autoHealHint is non-empty for every HaltReason", async () => {
    const reasons: HaltReason[] = [
      "RTV_FAILURE",
      "CERT_PINNING_VIOLATION",
      "CONSTITUTION_DRIFT",
      "TIME_MESH_OUTLIER",
      "HALLUCINATION_DETECTED",
      "SIMULATION_VIOLATION",
      "KERNEL_MISMATCH",
      "UNANCHORED_STATE",
      "INTERNAL_MODULE_FAILURE",
      "MANUAL_HALT",
    ];

    for (const reason of reasons) {
      const result = await haltBoot(makeInput({ reason }));
      assert.ok(
        result.autoHealHint.length > 0,
        `autoHealHint must not be empty for reason: ${reason}`,
      );
    }
  });

  test("d1Written is false when no db binding is provided", async () => {
    const result = await haltBoot(makeInput({ db: null }));
    assert.equal(result.d1Written, false);
  });

  test("d1Written is true when a valid D1 stub is provided", async () => {
    let d1Called = false;
    const mockDb = {
      prepare: () => ({
        bind: (..._args: unknown[]) => ({
          run: async () => { d1Called = true; },
        }),
      }),
    };

    const result = await haltBoot(makeInput({ db: mockDb as never }));
    assert.equal(result.d1Written, true, "d1Written must be true when D1 stub is supplied");
    assert.equal(d1Called, true,         "D1 prepare/bind/run chain must be called");
  });

  test("ts is an ISO-9 formatted string (9 fractional digits)", async () => {
    const result = await haltBoot(makeInput());
    assert.match(
      result.ts,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/,
      "ts must match ISO-9 format with 9 fractional digits",
    );
  });
});

describe("getHaltLog() / hasHalted()", () => {
  test("getHaltLog() returns an array", () => {
    const log = getHaltLog();
    assert.ok(Array.isArray(log), "getHaltLog must return an array");
  });

  test("getHaltLog() accumulates entries across multiple halts", async () => {
    const beforeCount = getHaltLog().length;
    await haltBoot(makeInput({ reason: "KERNEL_MISMATCH"          }));
    await haltBoot(makeInput({ reason: "UNANCHORED_STATE"         }));
    await haltBoot(makeInput({ reason: "INTERNAL_MODULE_FAILURE"  }));
    const afterCount = getHaltLog().length;
    assert.equal(afterCount, beforeCount + 3, "3 new halts must be recorded");
  });

  test("hasHalted() returns true after at least one haltBoot()", async () => {
    // At least one haltBoot has run before this test from the preceding suite.
    assert.equal(hasHalted(), true, "hasHalted must return true once a halt has occurred");
  });
});

describe("watchdogPulse()", () => {
  test("returns the expected shape", async () => {
    const pulse = await watchdogPulse();
    assert.ok("healthy"       in pulse, "healthy property required");
    assert.ok("ts"            in pulse, "ts property required");
    assert.ok("haltCount"     in pulse, "haltCount property required");
    assert.ok("kernelSha"     in pulse, "kernelSha property required");
    assert.ok("kernelVersion" in pulse, "kernelVersion property required");
  });

  test("kernelSha and kernelVersion match sovereign constants", async () => {
    const pulse = await watchdogPulse();
    assert.equal(pulse.kernelSha,    KERNEL_SHA,    "kernelSha must match KERNEL_SHA");
    assert.equal(pulse.kernelVersion, KERNEL_VERSION, "kernelVersion must match KERNEL_VERSION");
  });

  test("healthy=false after HALT_BOOT events have occurred", async () => {
    // Multiple halts have been triggered in preceding tests
    const pulse = await watchdogPulse();
    assert.equal(pulse.healthy, false, "healthy must be false after halt events");
  });

  test("haltCount reflects the accumulated halt log length", async () => {
    const logLen = getHaltLog().length;
    const pulse  = await watchdogPulse();
    assert.equal(pulse.haltCount, logLen, "haltCount must equal getHaltLog().length");
  });
});

describe("bubbleUpgrade()", () => {
  test("calls D1 prepare/bind/run with the expected fields", async () => {
    const capturedSql: string[] = [];
    const capturedArgs: unknown[][] = [];

    const mockDb = {
      prepare: (sql: string) => {
        capturedSql.push(sql);
        return {
          bind: (...args: unknown[]) => {
            capturedArgs.push(args);
            return { run: async () => {} };
          },
        };
      },
    };

    const haltResult = await haltBoot(makeInput({ reason: "CONSTITUTION_DRIFT" }));
    await bubbleUpgrade({
      haltResult,
      upgradeDesc: "Test upgrade description for CONSTITUTION_DRIFT",
      db:          mockDb as never,
    });

    assert.equal(capturedSql.length, 1, "D1 prepare must be called once");
    assert.ok(
      capturedSql[0]?.includes("sovereign_upgrades"),
      "SQL must target sovereign_upgrades table",
    );
    assert.equal(capturedArgs.length, 1, "bind must be called once");
    const args = capturedArgs[0] ?? [];
    // args: [trigger_halt_sha512, reason, upgrade_description, kernel_sha, kernel_version, authored_at]
    assert.equal(args[0], haltResult.haltSha512,        "arg[0] must be the halt SHA-512");
    assert.equal(args[1], "CONSTITUTION_DRIFT",          "arg[1] must be the halt reason");
    assert.equal(args[3], KERNEL_SHA,                    "arg[3] must be KERNEL_SHA");
    assert.equal(args[4], KERNEL_VERSION,                "arg[4] must be KERNEL_VERSION");
  });

  test("bubbleUpgrade handles D1 write failures gracefully", async () => {
    const haltResult = await haltBoot(makeInput({ reason: "MANUAL_HALT" }));
    const brokenDb   = {
      prepare: () => ({
        bind: () => ({
          run: async () => { throw new Error("D1 connection refused"); },
        }),
      }),
    };

    // Must not throw — failure is logged, not propagated
    await assert.doesNotReject(
      () => bubbleUpgrade({ haltResult, upgradeDesc: "test", db: brokenDb as never }),
      "bubbleUpgrade must not throw when D1 write fails",
    );
  });
});

describe("HALT_BOOT + Tier-9 Audit Alert loop (GATE 117.7.4)", () => {
  test("Full HALT → Alert → Bubble loop produces a valid chain", async () => {
    let d1RunCalled = 0;
    const mockDb = {
      prepare: () => ({
        bind: (..._args: unknown[]) => ({
          run: async () => { d1RunCalled += 1; },
        }),
      }),
    };

    // Step 1: HALT_BOOT
    const halt = await haltBoot({
      module:  "lib/security/sovereignFetch",
      reason:  "RTV_FAILURE",
      detail:  "Stripe RTV failed — HALT_BOOT triggered",
      phase:   "117.7",
      sha512:  KERNEL_SHA,
      db:      mockDb as never,
    });

    // Step 2: Verify halt attributes
    assert.equal(halt.reason,     "RTV_FAILURE");
    assert.equal(halt.alertFired, true,          "Tier-9 alert must fire");
    assert.equal(halt.d1Written,  true,          "D1 must be written");
    assert.match(halt.haltSha512, /^[0-9a-f]{128}$/);

    // Step 3: Bubble upgrade to TAI fleet
    await bubbleUpgrade({
      haltResult:  halt,
      upgradeDesc: "Auto-Heal: Upgraded RTV timeout to 20s and added retry logic.",
      db:          mockDb as never,
    });

    // D1 was called for the halt log (1) + the upgrade bubble (1)
    assert.equal(d1RunCalled, 2, "D1 must be called twice: once for halt, once for upgrade bubble");

    // Step 4: Watchdog pulse reflects the halt
    const pulse = await watchdogPulse();
    assert.equal(pulse.healthy, false,     "Watchdog must report unhealthy after HALT_BOOT");
    assert.ok(   pulse.haltCount > 0,      "haltCount must be > 0 after HALT_BOOT");
  });
});
