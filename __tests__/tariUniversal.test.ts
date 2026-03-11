/**
 * __tests__/tariUniversal.test.ts
 *
 * Unit tests for lib/tariUniversal.ts — computeTariRetroactiveDebt()
 *
 * Uses the Node.js built-in test runner (node:test).
 * Run with: node --experimental-strip-types --test __tests__/tariUniversal.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeTariRetroactiveDebt,
  TARI_LIABILITY_USD,
  type AuditLogEntry,
} from "../lib/tariUniversal";

// ── Helper ────────────────────────────────────────────────────────────────────

function entry(event_type: string, extras?: Partial<AuditLogEntry>): AuditLogEntry {
  return { event_type, ...extras };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TARI_LIABILITY_USD", () => {
  test("contains all canonical event types with correct USD amounts", () => {
    assert.equal(TARI_LIABILITY_USD["UNALIGNED_401"],       1_017.00);
    assert.equal(TARI_LIABILITY_USD["ALIGNMENT_DRIFT"],     5_000.00);
    assert.equal(TARI_LIABILITY_USD["PAYMENT_FAILED"],     10_000.00);
    assert.equal(TARI_LIABILITY_USD["POW_SOLVED"],              0.00);
    assert.equal(TARI_LIABILITY_USD["HN_WATCHER"],              0.00);
    assert.equal(TARI_LIABILITY_USD["DER_HIGH_VALUE"],      1_017.00);
    assert.equal(TARI_LIABILITY_USD["DER_SETTLEMENT"],     10_000.00);
    assert.equal(TARI_LIABILITY_USD["CONFLICT_ZONE_PROBE"],     0.00);
    assert.equal(TARI_LIABILITY_USD["LEGAL_SCAN"],              0.00);
    assert.equal(TARI_LIABILITY_USD["PEER_ACCESS"],             0.00);
    assert.equal(TARI_LIABILITY_USD["KAAS_BREACH"],    10_000_000.00);
    assert.equal(TARI_LIABILITY_USD["SOVEREIGN_SETTLEMENT"],    0.00);
  });
});

describe("computeTariRetroactiveDebt()", () => {
  test("returns zero debt for empty entries array", () => {
    const result = computeTariRetroactiveDebt([]);
    assert.equal(result.totalCents, 0);
    assert.equal(result.totalUsd, 0);
    assert.equal(result.eventCount, 0);
    assert.deepEqual(result.breakdown, {});
  });

  test("returns zero debt for zero-liability event types only", () => {
    const result = computeTariRetroactiveDebt([
      entry("PEER_ACCESS"),
      entry("LEGAL_SCAN"),
      entry("POW_SOLVED"),
      entry("HN_WATCHER"),
    ]);
    assert.equal(result.totalCents, 0);
    assert.equal(result.totalUsd, 0);
    assert.equal(result.eventCount, 4);
  });

  test("accumulates UNALIGNED_401 at $1,017.00 per event", () => {
    const result = computeTariRetroactiveDebt([
      entry("UNALIGNED_401"),
      entry("UNALIGNED_401"),
    ]);
    assert.equal(result.totalCents, 2 * 101_700);           // $2,034.00 in cents
    assert.equal(result.totalUsd,   2 * 1_017.00);
    assert.equal(result.eventCount, 2);
    assert.equal(result.breakdown["UNALIGNED_401"]!.count,      2);
    assert.equal(result.breakdown["UNALIGNED_401"]!.totalCents, 2 * 101_700);
  });

  test("accumulates KAAS_BREACH at $10,000,000.00 per event", () => {
    const result = computeTariRetroactiveDebt([entry("KAAS_BREACH")]);
    assert.equal(result.totalCents, 1_000_000_000);  // $10M in cents
    assert.equal(result.totalUsd,   10_000_000.00);
    assert.equal(result.eventCount, 1);
  });

  test("accumulates mixed event types correctly", () => {
    const entries: AuditLogEntry[] = [
      entry("UNALIGNED_401"),     // $1,017.00 → 101,700 cents
      entry("ALIGNMENT_DRIFT"),   // $5,000.00 → 500,000 cents
      entry("PAYMENT_FAILED"),    // $10,000.00 → 1,000,000 cents
      entry("PEER_ACCESS"),       // $0.00
      entry("DER_HIGH_VALUE"),    // $1,017.00 → 101,700 cents
    ];
    const result = computeTariRetroactiveDebt(entries);

    const expected = 101_700 + 500_000 + 1_000_000 + 0 + 101_700;
    assert.equal(result.totalCents, expected);
    assert.equal(result.totalUsd,   expected / 100);
    assert.equal(result.eventCount, 5);
  });

  test("defaults unknown event_type to $0 (PEER_ACCESS equivalent)", () => {
    const result = computeTariRetroactiveDebt([
      entry("UNKNOWN_EVENT_TYPE_XYZ"),
    ]);
    assert.equal(result.totalCents, 0);
    assert.equal(result.totalUsd, 0);
    assert.equal(result.eventCount, 1);
  });

  test("defaults missing event_type to PEER_ACCESS ($0)", () => {
    // @ts-expect-error — intentionally testing missing event_type
    const result = computeTariRetroactiveDebt([{}]);
    assert.equal(result.totalCents, 0);
    assert.equal(result.eventCount, 1);
  });

  test("breakdown tracks per-event-type totals independently", () => {
    const result = computeTariRetroactiveDebt([
      entry("UNALIGNED_401"),
      entry("UNALIGNED_401"),
      entry("DER_SETTLEMENT"),
    ]);
    assert.equal(result.breakdown["UNALIGNED_401"]!.count, 2);
    assert.equal(result.breakdown["UNALIGNED_401"]!.totalCents, 2 * 101_700);
    assert.equal(result.breakdown["DER_SETTLEMENT"]!.count, 1);
    assert.equal(result.breakdown["DER_SETTLEMENT"]!.totalCents, 1_000_000);
  });

  test("breakdown totalUsd matches totalCents / 100 for each event type", () => {
    const result = computeTariRetroactiveDebt([
      entry("ALIGNMENT_DRIFT"),
      entry("PAYMENT_FAILED"),
    ]);
    for (const [, data] of Object.entries(result.breakdown)) {
      assert.equal(data.totalUsd, data.totalCents / 100);
    }
  });

  test("handles large input (10,000 events) efficiently", () => {
    const entries = Array.from({ length: 10_000 }, () => entry("UNALIGNED_401"));
    const result  = computeTariRetroactiveDebt(entries);
    assert.equal(result.eventCount, 10_000);
    assert.equal(result.totalCents, 10_000 * 101_700);
  });

  test("preserves ip_address and asn metadata on entries (no mutation)", () => {
    const input: AuditLogEntry[] = [
      entry("LEGAL_SCAN", { ip_address: "1.2.3.4", asn: "36459" }),
    ];
    computeTariRetroactiveDebt(input);
    // Input entries must not be mutated
    assert.equal(input[0]!.ip_address, "1.2.3.4");
    assert.equal(input[0]!.asn, "36459");
  });
});
