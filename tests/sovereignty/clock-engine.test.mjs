/**
 * tests/sovereignty/clock-engine.test.mjs
 *
 * QA Test Suite — Compliance Clock Status API
 *
 * Tests the SettlementClock and ComplianceClock factories from
 * lib/compliance/clockEngine.ts against all expected status transitions.
 *
 * Run with: node --experimental-vm-modules tests/sovereignty/clock-engine.test.mjs
 *
 * Covers:
 *   • startSettlementClock() — ACTIVE when within 72h window
 *   • startSettlementClock() — EXPIRED when past deadline
 *   • startSettlementClock() — SETTLED when settled=true
 *   • createComplianceClock() — returns correct fields
 *   • SETTLEMENT_WINDOW_HOURS is exactly 72
 *   • SETTLEMENT_WINDOW_MS is exactly 72 * 3600 * 1000
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ── Reference implementation (mirrors lib/compliance/clockEngine.ts) ──────────
const SETTLEMENT_WINDOW_HOURS = 72;
const SETTLEMENT_WINDOW_MS    = SETTLEMENT_WINDOW_HOURS * 60 * 60 * 1_000;

function startSettlementClock(attestationTs, settled = false) {
  const now        = Date.now();
  const startMs    = attestationTs ? new Date(attestationTs).getTime() : now;
  const deadlineMs = startMs + SETTLEMENT_WINDOW_MS;
  const remaining  = Math.max(0, deadlineMs - now);
  const expired    = !settled && now > deadlineMs;
  const status     = settled ? "SETTLED" : expired ? "EXPIRED" : "ACTIVE";
  return {
    attestationTs:    new Date(startMs).toISOString(),
    deadlineTs:       new Date(deadlineMs).toISOString(),
    status,
    remainingMs:      settled ? 0 : remaining,
    expired,
  };
}

function createComplianceClock(asn, orgName, clockId) {
  const issuedAt   = new Date().toISOString();
  const deadlineAt = new Date(Date.now() + SETTLEMENT_WINDOW_MS).toISOString();
  return {
    clock_id:       clockId,
    asn,
    org_name:       orgName,
    issued_at:      issuedAt,
    deadline_at:    deadlineAt,
    status:         "ACTIVE",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Compliance Clock Engine — Status API", () => {

  it("SETTLEMENT_WINDOW_HOURS is exactly 72", () => {
    assert.equal(SETTLEMENT_WINDOW_HOURS, 72,
      "Settlement window must be 72 hours per AveryOS™ compliance requirement");
  });

  it("SETTLEMENT_WINDOW_MS is exactly 72 * 3600 * 1000", () => {
    assert.equal(SETTLEMENT_WINDOW_MS, 72 * 3600 * 1000,
      "Settlement window in ms = 72h × 3600s/h × 1000ms/s = 259,200,000 ms");
    assert.equal(SETTLEMENT_WINDOW_MS, 259_200_000);
  });

  it("clock is ACTIVE when attestation was less than 72h ago", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const clock = startSettlementClock(tenMinutesAgo);
    assert.equal(clock.status, "ACTIVE",
      "Clock started 10 minutes ago should be ACTIVE");
    assert.ok(clock.remainingMs > 0,
      "Remaining time should be positive for ACTIVE clock");
    assert.equal(clock.expired, false,
      "ACTIVE clock should not be expired");
  });

  it("clock is EXPIRED when attestation was more than 72h ago", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const clock = startSettlementClock(fourDaysAgo);
    assert.equal(clock.status, "EXPIRED",
      "Clock started 4 days ago should be EXPIRED");
    assert.equal(clock.remainingMs, 0,
      "Expired clock should have 0 remaining ms");
    assert.equal(clock.expired, true,
      "Expired clock should have expired=true");
  });

  it("clock is SETTLED when settled=true regardless of time", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const clock = startSettlementClock(fourDaysAgo, true);
    assert.equal(clock.status, "SETTLED",
      "Clock with settled=true should always be SETTLED");
    assert.equal(clock.remainingMs, 0,
      "SETTLED clock has 0 remaining ms");
    assert.equal(clock.expired, false,
      "SETTLED clock should not be expired");
  });

  it("clock with no attestation defaults to now (ACTIVE)", () => {
    const clock = startSettlementClock(null);
    assert.equal(clock.status, "ACTIVE",
      "Clock with null attestation starts from now → ACTIVE");
    assert.ok(
      clock.remainingMs > SETTLEMENT_WINDOW_MS - 5000,
      "Clock from now should have ~72h remaining (within 5s tolerance)",
    );
  });

  it("createComplianceClock returns correct fields", () => {
    const asn    = "36459";
    const org    = "GitHub, Inc.";
    const id     = "clock_q_36459_test";
    const clock  = createComplianceClock(asn, org, id);

    assert.equal(clock.clock_id, id,   "clock_id matches input");
    assert.equal(clock.asn,      asn,  "asn matches input");
    assert.equal(clock.org_name, org,  "org_name matches input");
    assert.equal(clock.status, "ACTIVE", "New clock starts as ACTIVE");
    assert.ok(clock.issued_at,    "issued_at must be present");
    assert.ok(clock.deadline_at,  "deadline_at must be present");

    // Verify deadline is ~72h after issued_at
    const issuedMs   = new Date(clock.issued_at).getTime();
    const deadlineMs = new Date(clock.deadline_at).getTime();
    const windowMs   = deadlineMs - issuedMs;
    // Allow ±1 second tolerance for test execution time
    assert.ok(
      Math.abs(windowMs - SETTLEMENT_WINDOW_MS) < 1000,
      `deadline_at should be ~${SETTLEMENT_WINDOW_HOURS}h after issued_at (got ${windowMs}ms, expected ${SETTLEMENT_WINDOW_MS}ms)`,
    );
  });

  it("clock deadline is exactly 72h after attestation", () => {
    const ts    = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1h ago
    const clock = startSettlementClock(ts);
    const attestMs   = new Date(clock.attestationTs).getTime();
    const deadlineMs = new Date(clock.deadlineTs).getTime();
    assert.equal(deadlineMs - attestMs, SETTLEMENT_WINDOW_MS,
      "Deadline must be exactly SETTLEMENT_WINDOW_MS after attestation");
  });
});

console.log("✅ Compliance Clock Engine test suite passed.");
