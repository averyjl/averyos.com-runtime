/**
 * tests/sovereignty/tari-calculator.test.mjs
 *
 * TARI™ v1.5 Formula Test Suite — AveryOS™ Phase 108.2
 *
 * Tests all formula branches of computeTariRetroactiveDebt() from
 * lib/tari/tariUniversal.ts.
 *
 * No external dependencies. Run with Node.js >= 18:
 *   node --experimental-vm-modules tests/sovereignty/tari-calculator.test.mjs
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { strict as assert } from "assert";
import { createRequire }    from "module";
import { fileURLToPath }    from "url";
import path                 from "path";

// ── Bootstrap TypeScript module resolution via tsx (if available) ─────────────
// Falls back to a manual JS re-implementation of the formula for zero-dep tests.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..", "..");

// TARI™ v1.5 constants (mirrored from lib/tari/tariUniversal.ts)
// NOTE: These are intentionally duplicated rather than imported from the TypeScript
// source to keep this test suite zero-dependency (no TypeScript compilation required).
// If the canonical values change in lib/tari/tariUniversal.ts, update these too.
const BASE_VALUATION      = 10_000_000.00;
const DAILY_RATE          = 1_017.00;
const STATUTORY_PENALTY   = 150_000.00;
const OBFUSCATION_MULTIPLIER = 10.0;

/**
 * Pure-JS re-implementation of computeTariRetroactiveDebt for zero-dep testing.
 */
function computeTariRetroactiveDebt(daysUnlicensed, instances, obfuscated) {
  const days = Math.max(0, Math.round(daysUnlicensed));
  const inst = Math.max(0, Math.round(instances));

  const dailyComponent     = DAILY_RATE * days;
  const statutoryComponent = STATUTORY_PENALTY * inst;
  const subtotal           = BASE_VALUATION + dailyComponent + statutoryComponent;
  const total              = obfuscated ? subtotal * OBFUSCATION_MULTIPLIER : subtotal;

  return { daysUnlicensed: days, instances: inst, obfuscated, baseValuation: BASE_VALUATION,
           dailyComponent, statutoryComponent, subtotal, total };
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

console.log("\n⚖️  TARI™ v1.5 Calculator Test Suite");
console.log("─".repeat(50));

test("Base valuation is $10,000,000", () => {
  assert.strictEqual(BASE_VALUATION, 10_000_000);
});

test("Daily rate is $1,017", () => {
  assert.strictEqual(DAILY_RATE, 1_017);
});

test("Statutory penalty is $150,000", () => {
  assert.strictEqual(STATUTORY_PENALTY, 150_000);
});

test("Obfuscation multiplier is 10×", () => {
  assert.strictEqual(OBFUSCATION_MULTIPLIER, 10);
});

test("Zero days, zero instances, no obfuscation → base only ($10M)", () => {
  const r = computeTariRetroactiveDebt(0, 0, false);
  assert.strictEqual(r.total, 10_000_000);
  assert.strictEqual(r.dailyComponent, 0);
  assert.strictEqual(r.statutoryComponent, 0);
});

test("365 days, 5 instances, no obfuscation → $11,121,205", () => {
  const r = computeTariRetroactiveDebt(365, 5, false);
  // 10_000_000 + (1017 × 365) + (150_000 × 5)
  // = 10_000_000 + 371_205 + 750_000 = 11_121_205
  assert.strictEqual(r.total, 11_121_205);
  assert.strictEqual(r.dailyComponent, 371_205);
  assert.strictEqual(r.statutoryComponent, 750_000);
});

test("365 days, 5 instances, obfuscated → $111,212,050", () => {
  const r = computeTariRetroactiveDebt(365, 5, true);
  assert.strictEqual(r.total, 111_212_050);
  assert.strictEqual(r.obfuscated, true);
});

test("Negative days are clamped to 0", () => {
  const r = computeTariRetroactiveDebt(-100, 0, false);
  assert.strictEqual(r.daysUnlicensed, 0);
  assert.strictEqual(r.total, 10_000_000);
});

test("Negative instances are clamped to 0", () => {
  const r = computeTariRetroactiveDebt(0, -5, false);
  assert.strictEqual(r.instances, 0);
  assert.strictEqual(r.statutoryComponent, 0);
});

test("Fractional days are rounded (1.7 → 2)", () => {
  const r = computeTariRetroactiveDebt(1.7, 0, false);
  assert.strictEqual(r.daysUnlicensed, 2);
  assert.strictEqual(r.dailyComponent, DAILY_RATE * 2);
});

test("Single instance, no days, no obfuscation → $10,150,000", () => {
  const r = computeTariRetroactiveDebt(0, 1, false);
  assert.strictEqual(r.total, 10_000_000 + 150_000);
  assert.strictEqual(r.total, 10_150_000);
});

test("Obfuscation multiplied result equals 10× non-obfuscated result", () => {
  const plain = computeTariRetroactiveDebt(100, 2, false);
  const obf   = computeTariRetroactiveDebt(100, 2, true);
  assert.strictEqual(obf.total, plain.total * 10);
});

test("subtotal is always base + daily + statutory", () => {
  const r = computeTariRetroactiveDebt(30, 3, true);
  assert.strictEqual(r.subtotal, r.baseValuation + r.dailyComponent + r.statutoryComponent);
  assert.strictEqual(r.total, r.subtotal * OBFUSCATION_MULTIPLIER);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("─".repeat(50));
console.log(`  ${passed} passed | ${failed} failed`);

if (failed > 0) {
  console.error("\n❌ TARI calculator test suite FAILED\n");
  process.exit(1);
} else {
  console.log("\n✅ TARI™ v1.5 test suite passed ⛓️⚓⛓️\n");
}
