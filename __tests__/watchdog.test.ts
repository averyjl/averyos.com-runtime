/**
 * __tests__/watchdog.test.ts
 *
 * Unit tests for lib/forensics/watchdog.ts — checkHaltBoot(), bubbleUpgrade(),
 * emitTier9Alert(), and the HaltBootResult/Tier9AlertInput types.
 *
 * Run with: node --experimental-strip-types --test __tests__/watchdog.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  checkHaltBoot,
  bubbleUpgrade,
  emitTier9Alert,
  WATCHDOG_MAX_NTP_DIVERGENCE_MS,
  WATCHDOG_TIER9_HALT_THRESHOLD,
  type HaltBootResult,
  type BubbleUpgradeInput,
  type Tier9AlertInput,
} from "../lib/forensics/watchdog";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── checkHaltBoot ─────────────────────────────────────────────────────────────

describe("checkHaltBoot()", () => {
  test("returns NOMINAL result when kernel anchor is intact", () => {
    const result: HaltBootResult = checkHaltBoot();

    assert.equal(result.halt, false, "halt should be false when anchor is intact");
    assert.equal(result.reason, "NOMINAL");
    assert.equal(result.severity, "INFO");
    assert.equal(result.kernel_version, KERNEL_VERSION);
    assert.equal(result.kernel_sha, KERNEL_SHA);
    assert.ok(result.checked_at, "checked_at must be present");
    // Verify ISO-8601 format
    assert.ok(!isNaN(Date.parse(result.checked_at)), "checked_at must be valid ISO-8601");
  });

  test("result has all required HaltBootResult fields", () => {
    const result = checkHaltBoot();
    assert.ok("halt"           in result, "missing: halt");
    assert.ok("reason"         in result, "missing: reason");
    assert.ok("severity"       in result, "missing: severity");
    assert.ok("kernel_version" in result, "missing: kernel_version");
    assert.ok("kernel_sha"     in result, "missing: kernel_sha");
    assert.ok("checked_at"     in result, "missing: checked_at");
  });

  test("severity is one of the allowed WatchdogSeverity values", () => {
    const result = checkHaltBoot();
    const allowed = ["INFO", "WARN", "CRITICAL", "HALT_BOOT"] as const;
    assert.ok(
      (allowed as readonly string[]).includes(result.severity),
      `severity "${result.severity}" is not a valid WatchdogSeverity`,
    );
  });
});

// ── bubbleUpgrade ─────────────────────────────────────────────────────────────

describe("bubbleUpgrade()", () => {
  test("accepts a nominal INFO finding without throwing", () => {
    const input: BubbleUpgradeInput = {
      finding: checkHaltBoot(),
      source:  "TEST",
    };
    assert.doesNotThrow(() => bubbleUpgrade(input));
  });

  test("accepts a HALT_BOOT finding without throwing", () => {
    const haltFinding: HaltBootResult = {
      halt:           true,
      reason:         "Stub HALT_BOOT for test",
      severity:       "HALT_BOOT",
      kernel_version: KERNEL_VERSION,
      kernel_sha:     KERNEL_SHA,
      checked_at:     new Date().toISOString(),
    };
    const input: BubbleUpgradeInput = { finding: haltFinding, source: "TEST_HALT" };
    assert.doesNotThrow(() => bubbleUpgrade(input));
  });

  test("accepts BubbleUpgradeInput without optional source field", () => {
    const input: BubbleUpgradeInput = { finding: checkHaltBoot() };
    assert.doesNotThrow(() => bubbleUpgrade(input));
  });
});

// ── emitTier9Alert ────────────────────────────────────────────────────────────

describe("emitTier9Alert()", () => {
  test("returns a structured record with all required fields", () => {
    const input: Tier9AlertInput = {
      entity:      "test-entity",
      event_type:  "BOT_INTRUSION",
      description: "Unit test stub Tier-9 event",
      asn:         "15169",
      ray_id:      "abc123test000001",
    };
    const record = emitTier9Alert(input);

    assert.equal(record["event"],      "TIER9_BREACH");
    assert.equal(record["entity"],     "test-entity");
    assert.equal(record["event_type"], "BOT_INTRUSION");
    assert.equal(record["asn"],        "15169");
    assert.equal(record["ray_id"],     "abc123test000001");
    assert.ok(   record["emitted_at"], "emitted_at must be present");
    assert.ok(!isNaN(Date.parse(record["emitted_at"] as string)), "emitted_at must be valid ISO-8601");
  });

  test("handles optional asn and ray_id being absent", () => {
    const input: Tier9AlertInput = {
      entity:      "minimal-entity",
      event_type:  "WAF_BLOCK",
      description: "Minimal stub Tier-9 event",
    };
    const record = emitTier9Alert(input);

    assert.equal(record["asn"],    null);
    assert.equal(record["ray_id"], null);
  });

  test("includes kernel_version and truncated kernel_sha", () => {
    const record = emitTier9Alert({
      entity: "anchor-test", event_type: "ANCHOR_CHECK", description: "Anchor fields test",
    });

    assert.equal(record["kernel_version"], KERNEL_VERSION);
    assert.ok(typeof record["kernel_sha"] === "string");
    // Truncated form includes the first 16 chars of the real sha
    assert.ok((record["kernel_sha"] as string).startsWith(KERNEL_SHA.slice(0, 16)));
  });
});

// ── Constants ────────────────────────────────────────────────────────────────

describe("Watchdog constants", () => {
  test("WATCHDOG_MAX_NTP_DIVERGENCE_MS is a positive number", () => {
    assert.ok(typeof WATCHDOG_MAX_NTP_DIVERGENCE_MS === "number");
    assert.ok(WATCHDOG_MAX_NTP_DIVERGENCE_MS > 0);
  });

  test("WATCHDOG_TIER9_HALT_THRESHOLD is a positive integer", () => {
    assert.ok(typeof WATCHDOG_TIER9_HALT_THRESHOLD === "number");
    assert.ok(WATCHDOG_TIER9_HALT_THRESHOLD > 0);
    assert.ok(Number.isInteger(WATCHDOG_TIER9_HALT_THRESHOLD));
  });
});
