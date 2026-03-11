/**
 * tests/sovereignty/kaas-settle.test.mjs
 *
 * KaaS Settle Pipeline Integration Test — AveryOS™ Phase 108.2 (Roadmap #8)
 *
 * Exercises the full compliance clock → escalation → settle pipeline using
 * pure-JS re-implementations of the core engine logic (zero external deps).
 *
 * Covers:
 *   1. createComplianceClock() — correct field initialisation
 *   2. Clock ACTIVE → EXPIRED transition (time-based)
 *   3. Escalation detection logic
 *   4. computeTariRetroactiveDebt() integration with clock duration
 *   5. Edge cases: already-settled clocks, zero-debt clocks
 *
 * Run with Node.js >= 18:
 *   node tests/sovereignty/kaas-settle.test.mjs
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { strict as assert } from "assert";

// ── Pure-JS mirrors of core engine constants ──────────────────────────────────

const SETTLEMENT_WINDOW_MS    = 72 * 60 * 60 * 1_000; // 72 hours
const SETTLEMENT_WINDOW_HOURS = 72;

// TARI™ v1.5 constants
const BASE_VALUATION       = 10_000_000.00;
const DAILY_RATE           = 1_017.00;
const STATUTORY_PENALTY    = 150_000.00;
const OBFUSCATION_MULTIPLIER = 10.0;

// ── Pure-JS mirrors of core functions ────────────────────────────────────────

function formatRemaining(ms) {
  if (ms <= 0) return "0h 0m";
  const hours   = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

function createComplianceClock(asn, orgName, clockId) {
  const now        = Date.now();
  const deadlineMs = now + SETTLEMENT_WINDOW_MS;
  return {
    clock_id:         clockId,
    asn,
    org_name:         orgName,
    issued_at:        new Date(now).toISOString(),
    deadline_at:      new Date(deadlineMs).toISOString(),
    status:           "ACTIVE",
    remainingMs:      SETTLEMENT_WINDOW_MS,
    remainingDisplay: formatRemaining(SETTLEMENT_WINDOW_MS),
    expired:          false,
  };
}

function computeTariRetroactiveDebt(daysUnlicensed, instances, obfuscated) {
  const days = Math.max(0, Math.round(daysUnlicensed));
  const inst = Math.max(0, Math.round(instances));
  const dailyComponent     = DAILY_RATE * days;
  const statutoryComponent = STATUTORY_PENALTY * inst;
  const subtotal           = BASE_VALUATION + dailyComponent + statutoryComponent;
  const total              = obfuscated ? subtotal * OBFUSCATION_MULTIPLIER : subtotal;
  return { daysUnlicensed: days, instances: inst, obfuscated, dailyComponent, statutoryComponent, subtotal, total };
}

/**
 * Determine the current status of a clock given an override "now" timestamp.
 */
function evaluateClockStatus(clock, nowMs = Date.now()) {
  if (clock.status === "SETTLED") return "SETTLED";
  if (clock.status === "ESCALATED") return "ESCALATED";
  const deadlineMs = new Date(clock.deadline_at).getTime();
  return nowMs > deadlineMs ? "EXPIRED" : "ACTIVE";
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

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log("\n⏰  KaaS Settle Pipeline Integration Test Suite");
console.log("─".repeat(52));

// --- Clock Creation ---

test("createComplianceClock returns a clock with ACTIVE status", () => {
  const c = createComplianceClock("36459", "GitHub, Inc.", "CLK-001");
  assert.strictEqual(c.status, "ACTIVE");
  assert.strictEqual(c.clock_id, "CLK-001");
  assert.strictEqual(c.asn, "36459");
  assert.strictEqual(c.org_name, "GitHub, Inc.");
});

test("createComplianceClock deadline is exactly 72 hours in the future", () => {
  const before = Date.now();
  const c      = createComplianceClock("8075", "Microsoft", "CLK-002");
  const after  = Date.now();

  const issuedMs   = new Date(c.issued_at).getTime();
  const deadlineMs = new Date(c.deadline_at).getTime();

  assert.ok(issuedMs >= before && issuedMs <= after, "issued_at should be now");
  assert.ok(
    Math.abs(deadlineMs - issuedMs - SETTLEMENT_WINDOW_MS) < 1_000,
    "deadline should be 72h after issued_at",
  );
});

test("createComplianceClock remainingMs equals SETTLEMENT_WINDOW_MS at creation", () => {
  const c = createComplianceClock(null, null, "CLK-003");
  assert.strictEqual(c.remainingMs, SETTLEMENT_WINDOW_MS);
});

test("createComplianceClock accepts null asn and orgName", () => {
  const c = createComplianceClock(null, null, "CLK-004");
  assert.strictEqual(c.asn, null);
  assert.strictEqual(c.org_name, null);
  assert.strictEqual(c.status, "ACTIVE");
});

test("Settlement window is 72 hours (259,200,000 ms)", () => {
  assert.strictEqual(SETTLEMENT_WINDOW_MS, 72 * 60 * 60 * 1_000);
  assert.strictEqual(SETTLEMENT_WINDOW_HOURS, 72);
});

// --- Status Transitions ---

test("ACTIVE clock within deadline stays ACTIVE", () => {
  const c   = createComplianceClock("15169", "Google", "CLK-005");
  const now = Date.now(); // well before deadline
  assert.strictEqual(evaluateClockStatus(c, now), "ACTIVE");
});

test("ACTIVE clock past deadline transitions to EXPIRED", () => {
  const c = createComplianceClock("15169", "Google", "CLK-006");
  // Simulate time 73 hours after issuance
  const futureNow = new Date(c.issued_at).getTime() + 73 * 60 * 60 * 1_000;
  assert.strictEqual(evaluateClockStatus(c, futureNow), "EXPIRED");
});

test("SETTLED clock always returns SETTLED regardless of time", () => {
  const c = createComplianceClock("16509", "Amazon", "CLK-007");
  c.status = "SETTLED";
  const futureNow = Date.now() + 1_000_000_000;
  assert.strictEqual(evaluateClockStatus(c, futureNow), "SETTLED");
});

test("ESCALATED clock always returns ESCALATED", () => {
  const c = createComplianceClock("32934", "Meta", "CLK-008");
  c.status = "ESCALATED";
  assert.strictEqual(evaluateClockStatus(c), "ESCALATED");
});

// --- Debt Calculation Integration ---

test("72-hour clock corresponds to 3 days of TARI™ liability", () => {
  const clockDays = SETTLEMENT_WINDOW_HOURS / 24; // 3 days
  const r = computeTariRetroactiveDebt(clockDays, 0, false);
  assert.strictEqual(r.daysUnlicensed, 3);
  assert.strictEqual(r.dailyComponent, DAILY_RATE * 3);
});

test("TARI debt for a SETTLED clock (3 days, 1 instance) = $10,153,051", () => {
  const clockDays = SETTLEMENT_WINDOW_HOURS / 24;
  const r = computeTariRetroactiveDebt(clockDays, 1, false);
  // 10_000_000 + (1017 × 3) + (150_000 × 1) = 10_153_051
  assert.strictEqual(r.total, 10_153_051);
});

test("Obfuscated TARI debt for 3 days, 1 instance = $101,530,510", () => {
  const clockDays = SETTLEMENT_WINDOW_HOURS / 24;
  const r = computeTariRetroactiveDebt(clockDays, 1, true);
  assert.strictEqual(r.total, 101_530_510);
});

// --- Escalation Batch Logic ---

test("Batch of 3 clocks: 2 expired, 1 active → 2 escalated", () => {
  const now = Date.now();
  const past = new Date(now - 100_000).toISOString();
  const future = new Date(now + SETTLEMENT_WINDOW_MS).toISOString();

  const clocks = [
    { clock_id: "A", status: "ACTIVE", deadline_at: past },
    { clock_id: "B", status: "ACTIVE", deadline_at: past },
    { clock_id: "C", status: "ACTIVE", deadline_at: future },
  ];

  const escalated = clocks.filter((c) => evaluateClockStatus(c, now) === "EXPIRED");
  assert.strictEqual(escalated.length, 2);
  assert.ok(escalated.every((c) => c.clock_id === "A" || c.clock_id === "B"));
});

test("Batch of 3 clocks: already-SETTLED clock is skipped by escalation", () => {
  const now  = Date.now();
  const past = new Date(now - 100_000).toISOString();

  const clocks = [
    { clock_id: "X", status: "SETTLED",   deadline_at: past },
    { clock_id: "Y", status: "ACTIVE",    deadline_at: past },
    { clock_id: "Z", status: "ESCALATED", deadline_at: past },
  ];

  const toEscalate = clocks.filter((c) => evaluateClockStatus(c, now) === "EXPIRED");
  assert.strictEqual(toEscalate.length, 1);
  assert.strictEqual(toEscalate[0].clock_id, "Y");
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("─".repeat(52));
console.log(`  ${passed} passed | ${failed} failed`);

if (failed > 0) {
  console.error("\n❌ KaaS settle integration test suite FAILED\n");
  process.exit(1);
} else {
  console.log("\n✅ KaaS settle pipeline test suite passed ⛓️⚓⛓️\n");
}
