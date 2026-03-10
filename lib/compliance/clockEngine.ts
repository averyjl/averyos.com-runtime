/**
 * lib/compliance/clockEngine.ts
 *
 * Reconciliation Deadline / Settlement Clock — AveryOS™ Phase 102.1.5
 *
 * Hard-locks a 72-hour settlement clock that is triggered upon completion
 * of an Attestation handshake. Tracks the attestation timestamp and
 * computes the deadline, remaining time, and current status.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Duration of the settlement window in milliseconds (72 hours). */
export const SETTLEMENT_WINDOW_MS = 72 * 60 * 60 * 1_000; // 72 hours

/** Status values for a settlement clock. */
export type SettlementClockStatus = "ACTIVE" | "EXPIRED" | "SETTLED";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SettlementClock {
  /** ISO-8601 timestamp when the attestation was completed. */
  attestationTs: string;
  /** ISO-8601 deadline (attestationTs + 72 hours). */
  deadlineTs: string;
  /** Current clock status. */
  status: SettlementClockStatus;
  /** Milliseconds remaining until deadline (0 if expired/settled). */
  remainingMs: number;
  /** Human-readable remaining time string (e.g. "47h 32m"). */
  remainingDisplay: string;
  /** True if the deadline has passed without settlement. */
  expired: boolean;
  /** Kernel anchor for this clock record. */
  kernelSha: string;
  kernelVersion: string;
}

// ── Clock Factory ─────────────────────────────────────────────────────────────

/**
 * Start a new 72-hour settlement clock anchored to the provided attestation
 * timestamp (defaults to `now` if not supplied).
 *
 * @param attestationTs  ISO-8601 string from the completed attestation handshake.
 * @param settled        Pass `true` to mark the clock as already SETTLED.
 * @returns              SettlementClock record.
 */
export function startSettlementClock(
  attestationTs?: string | null,
  settled = false,
): SettlementClock {
  const now        = Date.now();
  const startMs    = attestationTs ? new Date(attestationTs).getTime() : now;
  const deadlineMs = startMs + SETTLEMENT_WINDOW_MS;
  const remaining  = Math.max(0, deadlineMs - now);
  const expired    = !settled && now > deadlineMs;

  const status: SettlementClockStatus = settled
    ? "SETTLED"
    : expired
    ? "EXPIRED"
    : "ACTIVE";

  return {
    attestationTs:   new Date(startMs).toISOString(),
    deadlineTs:      new Date(deadlineMs).toISOString(),
    status,
    remainingMs:     settled ? 0 : remaining,
    remainingDisplay: settled ? "SETTLED" : formatRemaining(remaining),
    expired,
    kernelSha:       KERNEL_SHA,
    kernelVersion:   KERNEL_VERSION,
  };
}

/**
 * Evaluate an existing settlement clock given the original attestation timestamp.
 * Equivalent to calling `startSettlementClock(attestationTs)` — the function
 * always re-computes against the current wall-clock time.
 *
 * @param attestationTs  ISO-8601 string from the original attestation.
 * @param settled        Pass `true` if the entity has already paid.
 * @returns              SettlementClock with updated status / remaining time.
 */
export function getSettlementDeadline(
  attestationTs: string,
  settled = false,
): SettlementClock {
  return startSettlementClock(attestationTs, settled);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format milliseconds into a human-readable string like "2d 23h 32m 10s". */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "EXPIRED";
  const totalSeconds = Math.floor(ms / 1_000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours   = Math.floor(totalMinutes / 60);
  const days         = Math.floor(totalHours / 24);
  const hours        = totalHours % 24;
  const minutes      = totalMinutes % 60;
  const seconds      = totalSeconds % 60;
  const parts: string[] = [];
  if (days    > 0) parts.push(`${days}d`);
  if (hours   > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}
