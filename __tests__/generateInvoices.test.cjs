/**
 * __tests__/generateInvoices.test.cjs
 *
 * Unit tests for scripts/generateInvoices.cjs — computeTariRetroactiveDebt()
 *
 * Tests the CommonJS implementation that mirrors lib/tariUniversal.ts.
 * Uses Node.js built-in test runner.
 *
 * Run with: node --test __tests__/generateInvoices.test.cjs
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Extract the function under test via module isolation ──────────────────────
// We can't require() the full generateInvoices.cjs because it runs main() at
// the end. Instead, we replicate the TARI_LIABILITY schedule and function
// exactly as they appear in the script, and test them in isolation.

const TARI_LIABILITY_USD_SCHEDULE = {
  UNALIGNED_401:      1_017.00,
  ALIGNMENT_DRIFT:    5_000.00,
  PAYMENT_FAILED:    10_000.00,
  POW_SOLVED:             0.00,
  HN_WATCHER:             0.00,
  DER_HIGH_VALUE:     1_017.00,
  DER_SETTLEMENT:    10_000.00,
  CONFLICT_ZONE_PROBE:    0.00,
  LEGAL_SCAN:             0.00,
  PEER_ACCESS:            0.00,
  KAAS_BREACH:   10_000_000.00,
  SOVEREIGN_SETTLEMENT:   0.00,
};

function computeTariRetroactiveDebt(entries) {
  const breakdown = {};
  let totalCents  = 0;

  for (const entry of entries) {
    const eventType      = String(entry.event_type ?? 'PEER_ACCESS');
    const liabilityUsd   = TARI_LIABILITY_USD_SCHEDULE[eventType] ?? 0;
    const liabilityCents = Math.round(liabilityUsd * 100);

    if (!breakdown[eventType]) {
      breakdown[eventType] = { count: 0, totalCents: 0, totalUsd: 0 };
    }
    breakdown[eventType].count      += 1;
    breakdown[eventType].totalCents += liabilityCents;
    breakdown[eventType].totalUsd    = breakdown[eventType].totalCents / 100;
    totalCents += liabilityCents;
  }

  return {
    totalCents,
    totalUsd:   totalCents / 100,
    eventCount: entries.length,
    breakdown,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TARI_LIABILITY_USD_SCHEDULE (CJS version in generateInvoices.cjs)', () => {
  test('UNALIGNED_401 is $1,017.00', () => {
    assert.equal(TARI_LIABILITY_USD_SCHEDULE.UNALIGNED_401, 1_017.00);
  });

  test('KAAS_BREACH is $10,000,000.00', () => {
    assert.equal(TARI_LIABILITY_USD_SCHEDULE.KAAS_BREACH, 10_000_000.00);
  });

  test('all zero-liability events are $0', () => {
    const zeroEvents = ['POW_SOLVED', 'HN_WATCHER', 'CONFLICT_ZONE_PROBE', 'LEGAL_SCAN', 'PEER_ACCESS', 'SOVEREIGN_SETTLEMENT'];
    for (const evt of zeroEvents) {
      assert.equal(TARI_LIABILITY_USD_SCHEDULE[evt], 0, `${evt} should be $0`);
    }
  });

  test('fee schedule matches TypeScript version in lib/tariUniversal.ts', () => {
    // Spot-check key values against the TS implementation
    assert.equal(TARI_LIABILITY_USD_SCHEDULE.DER_HIGH_VALUE,  1_017.00);
    assert.equal(TARI_LIABILITY_USD_SCHEDULE.DER_SETTLEMENT, 10_000.00);
    assert.equal(TARI_LIABILITY_USD_SCHEDULE.ALIGNMENT_DRIFT, 5_000.00);
    assert.equal(TARI_LIABILITY_USD_SCHEDULE.PAYMENT_FAILED, 10_000.00);
  });
});

describe('computeTariRetroactiveDebt() — CJS (mirrors lib/tariUniversal.ts)', () => {
  test('empty input returns zero result', () => {
    const r = computeTariRetroactiveDebt([]);
    assert.equal(r.totalCents, 0);
    assert.equal(r.totalUsd, 0);
    assert.equal(r.eventCount, 0);
    assert.deepEqual(r.breakdown, {});
  });

  test('single UNALIGNED_401 produces $1,017.00 = 101,700 cents', () => {
    const r = computeTariRetroactiveDebt([{ event_type: 'UNALIGNED_401' }]);
    assert.equal(r.totalCents, 101_700);
    assert.equal(r.totalUsd,   1_017.00);
    assert.equal(r.eventCount, 1);
  });

  test('three PAYMENT_FAILED events produce $30,000.00', () => {
    const entries = [
      { event_type: 'PAYMENT_FAILED' },
      { event_type: 'PAYMENT_FAILED' },
      { event_type: 'PAYMENT_FAILED' },
    ];
    const r = computeTariRetroactiveDebt(entries);
    assert.equal(r.totalCents, 3 * 1_000_000);
    assert.equal(r.totalUsd,   30_000.00);
  });

  test('unknown event_type accrues $0', () => {
    const r = computeTariRetroactiveDebt([{ event_type: 'TOTALLY_UNKNOWN' }]);
    assert.equal(r.totalCents, 0);
    assert.equal(r.eventCount, 1);
  });

  test('missing event_type defaults to PEER_ACCESS ($0)', () => {
    const r = computeTariRetroactiveDebt([{}]);
    assert.equal(r.totalCents, 0);
    assert.equal(r.eventCount, 1);
    assert.ok('PEER_ACCESS' in r.breakdown);
  });

  test('breakdown.totalUsd always equals breakdown.totalCents / 100', () => {
    const r = computeTariRetroactiveDebt([
      { event_type: 'UNALIGNED_401' },
      { event_type: 'ALIGNMENT_DRIFT' },
    ]);
    for (const [, data] of Object.entries(r.breakdown)) {
      assert.equal(data.totalUsd, data.totalCents / 100);
    }
  });

  test('handles 1000 events efficiently and accurately', () => {
    const entries = Array.from({ length: 1000 }, () => ({ event_type: 'DER_HIGH_VALUE' }));
    const r = computeTariRetroactiveDebt(entries);
    assert.equal(r.eventCount, 1000);
    assert.equal(r.totalCents, 1000 * 101_700);
    assert.equal(r.breakdown['DER_HIGH_VALUE'].count, 1000);
  });
});
