/**
 * lib/kaas/reconciliationClock.ts
 *
 * Reconciliation Clock Hardlock — AveryOS™ Phase 105.1 GATE 105.1.5
 *
 * Provides the 72-hour countdown logic for all "Audit Clearance" invoices.
 *
 * Workflow:
 *   1. When a KaaS valuation row is created with status PENDING, its
 *      `created_at` timestamp starts the 72-hour window.
 *   2. resolveAuditDeadline() computes the exact deadline UTC timestamp.
 *   3. getAuditCountdown() returns a human-readable countdown string and
 *      a flag indicating whether the window has expired.
 *   4. On expiry, the entity's Alignment Score and "Unauthorized" status
 *      can be posted to the Public Ingestor Registry (via the POST endpoint).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_VERSION } from "../sovereignConstants";

/** Duration of the Audit Clearance window in milliseconds (72 hours). */
export const AUDIT_CLEARANCE_WINDOW_MS = 72 * 60 * 60 * 1_000;

/** Sentinel string returned by formatCountdownMs() when the window has expired. */
export const EXPIRED_COUNTDOWN = "EXPIRED";

// ── Countdown result ──────────────────────────────────────────────────────────

export interface AuditCountdown {
  /** ISO-8601 deadline string. */
  deadlineIso:        string;
  /** Unix timestamp (ms) of the deadline. */
  deadlineMs:         number;
  /** Remaining milliseconds (0 if expired). */
  remainingMs:        number;
  /** Human-readable countdown: "71h 59m 59s" or "EXPIRED". */
  countdownDisplay:   string;
  /** True if the 72-hour window has elapsed. */
  expired:            boolean;
  /** True if expiry is within 6 hours. */
  criticalWarning:    boolean;
  /** Tier of the entity (for escalation logic). */
  tier:               number;
  /** Kernel version for tamper-evidence. */
  kernelVersion:      string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Format a millisecond duration as "DDd HHh MMm SSs".
 */
export function formatCountdownMs(ms: number): string {
  if (ms <= 0) return EXPIRED_COUNTDOWN;
  const totalSec = Math.floor(ms / 1000);
  const days     = Math.floor(totalSec / 86_400);
  const hours    = Math.floor((totalSec % 86_400) / 3_600);
  const minutes  = Math.floor((totalSec % 3_600) / 60);
  const seconds  = totalSec % 60;
  const parts: string[] = [];
  if (days > 0)                          parts.push(`${days}d`);
  parts.push(`${String(hours).padStart(2, "0")}h`);
  parts.push(`${String(minutes).padStart(2, "0")}m`);
  parts.push(`${String(seconds).padStart(2, "0")}s`);
  return parts.join(" ");
}

/**
 * Compute the deadline timestamp for an audit clearance window.
 *
 * @param createdAt  ISO-8601 or Unix-ms timestamp when the valuation was created
 * @returns          Deadline as a Unix millisecond timestamp
 */
export function resolveAuditDeadline(createdAt: string | number): number {
  const base = typeof createdAt === "number"
    ? createdAt
    : new Date(createdAt).getTime();
  return base + AUDIT_CLEARANCE_WINDOW_MS;
}

/**
 * Get a full countdown object for an audit clearance invoice.
 *
 * @param createdAt  ISO-8601 or Unix-ms timestamp of invoice creation
 * @param tier       KaaS tier of the entity (1–10); tier ≥ 9 escalates faster
 */
export function getAuditCountdown(
  createdAt: string | number,
  tier: number = 1,
): AuditCountdown {
  const nowMs        = Date.now();
  const deadlineMs   = resolveAuditDeadline(createdAt);
  const remainingMs  = Math.max(0, deadlineMs - nowMs);
  const expired      = remainingMs === 0;
  const criticalWarning = !expired && remainingMs <= 6 * 60 * 60 * 1_000;

  return {
    deadlineIso:      new Date(deadlineMs).toISOString(),
    deadlineMs,
    remainingMs,
    countdownDisplay: formatCountdownMs(remainingMs),
    expired,
    criticalWarning,
    tier,
    kernelVersion:    KERNEL_VERSION,
  };
}

/**
 * Determine whether a batch of audit rows has any expired or critical invoices.
 *
 * @param rows  Array of objects with `created_at` and optional `tier` fields
 */
export function auditBatchStatus(
  rows: Array<{ created_at: string | null; tier?: number | null }>,
): {
  expiredCount:  number;
  criticalCount: number;
  pendingCount:  number;
  countdowns:    AuditCountdown[];
} {
  let expiredCount  = 0;
  let criticalCount = 0;
  let pendingCount  = 0;
  const countdowns: AuditCountdown[] = [];

  for (const row of rows) {
    if (!row.created_at) continue;
    const countdown = getAuditCountdown(row.created_at, row.tier ?? 1);
    countdowns.push(countdown);
    if (countdown.expired)         expiredCount++;
    else if (countdown.criticalWarning) criticalCount++;
    else                            pendingCount++;
  }

  return { expiredCount, criticalCount, pendingCount, countdowns };
}
