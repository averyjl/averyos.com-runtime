/**
 * lib/compliance/clockEngine.ts
 *
 * Compliance Clock Engine — AveryOS™ Phase 103.5 / Gate 103.5
 *
 * Implements the 72-hour Settlement Deadline (Liability Clock) logic.
 *
 * When a "Notice of Violation" (NOV) is issued to an entity recorded in the
 * kaas_ledger, a 72-hour settlement window begins.  If the entity settles
 * within the window, the statutory liability is cleared.  If the window
 * expires without settlement, the record transitions to ESCALATED and the
 * entity's ASN is promoted to the Public Unauthorised Registry.
 *
 * Clock States:
 *   PENDING    — NOV issued; 72-hour window active
 *   SETTLED    — Payment received; liability cleared
 *   ESCALATED  — Window expired; record promoted to public registry
 *   EXEMPTED   — Entity holds a valid TAI_LICENSE_KEY (no action required)
 *
 * Statutory Basis:
 *   17 U.S.C. § 504(c)(2) — Statutory damages up to $150,000 per work for
 *   willful infringement.  The 72-hour window constitutes a "good-faith
 *   administrative settlement" offer prior to formal litigation.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Duration of the settlement window in milliseconds (72 hours). */
export const SETTLEMENT_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

/** Duration of the settlement window in hours — used for display. */
export const SETTLEMENT_WINDOW_HOURS = 72;

// ── Types ──────────────────────────────────────────────────────────────────────

export type ClockState = "PENDING" | "SETTLED" | "ESCALATED" | "EXEMPTED";

/** A compliance clock record stored in D1 or returned to callers. */
export interface ComplianceClock {
  /** Unique identifier (UUIDv4 or D1 row ID). */
  clock_id: string;
  /** ASN of the entity under notice. */
  asn: string;
  /** Organisation / entity name (optional, derived from ASN lookup). */
  org_name: string | null;
  /** ISO-8601 timestamp when the Notice of Violation was issued. */
  issued_at: string;
  /** ISO-8601 timestamp when the 72-hour window expires. */
  deadline_at: string;
  /** Current state of the compliance clock. */
  state: ClockState;
  /** ISO-8601 timestamp when state last changed (null = no change yet). */
  state_changed_at: string | null;
  /** SHA-512 anchor for the NOV record. */
  kernel_sha: string;
  /** AveryOS™ kernel version at time of issuance. */
  kernel_version: string;
}

/** Result returned by `checkClockState()`. */
export interface ClockCheckResult {
  clock_id: string;
  asn: string;
  state: ClockState;
  /** Milliseconds remaining in the window (0 if expired or resolved). */
  remaining_ms: number;
  /** Human-readable time remaining (e.g. "47h 23m"). */
  remaining_display: string;
  /** True if the 72-hour window has passed without settlement. */
  is_expired: boolean;
  deadline_at: string;
  issued_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Format milliseconds as "Xh Ym" for display.
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return "0h 0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours   = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/**
 * Compute the deadline ISO string for a clock starting now.
 */
export function computeDeadline(issuedAtMs: number): string {
  return new Date(issuedAtMs + SETTLEMENT_WINDOW_MS).toISOString();
}

// ── Clock Factory ──────────────────────────────────────────────────────────────

/**
 * Create a new ComplianceClock record for the given ASN.
 *
 * This does NOT persist the record — callers are responsible for inserting
 * the returned object into D1 / KV storage.
 *
 * @param asn      - Client ASN (e.g. "8075")
 * @param orgName  - Optional organisation name
 * @param clockId  - Optional pre-generated ID (defaults to a timestamp-based key)
 */
export function createComplianceClock(
  asn: string,
  orgName?: string | null,
  clockId?: string,
): ComplianceClock {
  const now        = Date.now();
  const issuedAt   = new Date(now).toISOString();
  const deadlineAt = computeDeadline(now);
  const id         = clockId ?? `clock_${asn}_${now}`;

  return {
    clock_id:        id,
    asn,
    org_name:        orgName ?? null,
    issued_at:       issuedAt,
    deadline_at:     deadlineAt,
    state:           "PENDING",
    state_changed_at: null,
    kernel_sha:      KERNEL_SHA,
    kernel_version:  KERNEL_VERSION,
  };
}

// ── State Checker ──────────────────────────────────────────────────────────────

/**
 * Evaluate the current state of a compliance clock at the given point in time.
 *
 * If the clock is still PENDING and the deadline has passed, the returned
 * `state` will be ESCALATED and `is_expired` will be true.  Callers should
 * persist this state change back to storage.
 *
 * @param clock  - The ComplianceClock record to evaluate.
 * @param nowMs  - Current time in milliseconds (defaults to Date.now()).
 */
export function checkClockState(
  clock: ComplianceClock,
  nowMs: number = Date.now(),
): ClockCheckResult {
  const deadlineMs  = new Date(clock.deadline_at).getTime();
  const remainingMs = Math.max(0, deadlineMs - nowMs);
  const isExpired   = nowMs >= deadlineMs;

  let effectiveState: ClockState = clock.state;
  if (clock.state === "PENDING" && isExpired) {
    effectiveState = "ESCALATED";
  }

  return {
    clock_id:         clock.clock_id,
    asn:              clock.asn,
    state:            effectiveState,
    remaining_ms:     remainingMs,
    remaining_display: formatRemainingTime(remainingMs),
    is_expired:       isExpired,
    deadline_at:      clock.deadline_at,
    issued_at:        clock.issued_at,
  };
}

// ── Batch Reconciliation ───────────────────────────────────────────────────────

/**
 * Reconcile a list of compliance clocks, returning those that need a state
 * update (i.e. PENDING clocks whose 72-hour window has expired).
 *
 * Usage (cron / reconciliation job):
 *   const toEscalate = reconcileClocks(allPendingClocks);
 *   for (const r of toEscalate) { await markEscalated(r.clock_id); }
 *
 * @param clocks - Array of ComplianceClock records with state === "PENDING".
 * @param nowMs  - Current time in milliseconds (defaults to Date.now()).
 */
export function reconcileClocks(
  clocks: ComplianceClock[],
  nowMs: number = Date.now(),
): ClockCheckResult[] {
  return clocks
    .map(c => checkClockState(c, nowMs))
    .filter(r => r.is_expired && r.state === "ESCALATED");
}

// ── SQL Helpers (D1) ───────────────────────────────────────────────────────────

/**
 * Returns the SQL INSERT statement for creating the compliance_clocks table.
 * Suitable for use in a migration script.
 */
export const CREATE_COMPLIANCE_CLOCKS_SQL = `
CREATE TABLE IF NOT EXISTS compliance_clocks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  clock_id         TEXT    NOT NULL UNIQUE,
  asn              TEXT    NOT NULL,
  org_name         TEXT,
  issued_at        TEXT    NOT NULL,
  deadline_at      TEXT    NOT NULL,
  state            TEXT    NOT NULL DEFAULT 'PENDING',
  state_changed_at TEXT,
  kernel_sha       TEXT    NOT NULL,
  kernel_version   TEXT    NOT NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
`.trim();

/**
 * Returns the INSERT SQL and bound parameters for persisting a ComplianceClock
 * into D1.
 *
 * @example
 * const { sql, params } = clockInsertParams(clock);
 * await db.prepare(sql).bind(...params).run();
 */
export function clockInsertParams(clock: ComplianceClock): {
  sql: string;
  params: [string, string, string | null, string, string, string, string, string];
} {
  return {
    sql: `INSERT OR IGNORE INTO compliance_clocks
            (clock_id, asn, org_name, issued_at, deadline_at, state, kernel_sha, kernel_version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      clock.clock_id,
      clock.asn,
      clock.org_name,
      clock.issued_at,
      clock.deadline_at,
      clock.state,
      clock.kernel_sha,
      clock.kernel_version,
    ],
  };
}
