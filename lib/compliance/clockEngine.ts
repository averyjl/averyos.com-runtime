/**
 * lib/compliance/clockEngine.ts
 *
 * Reconciliation Deadline / Settlement Clock — AveryOS™ Phase 102.1.5 / 107.1
 *
 * Hard-locks a 72-hour settlement clock that is triggered upon completion
 * of an Attestation handshake. Tracks the attestation timestamp and
 * computes the deadline, remaining time, and current status.
 *
 * Phase 107.1 upgrade: Added createComplianceClock() factory and
 * SETTLEMENT_WINDOW_HOURS constant for use by the quarantine handshake
 * and the clock-escalation cron endpoint.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                from "../timePrecision";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Duration of the settlement window in milliseconds (72 hours). */
export const SETTLEMENT_WINDOW_MS = 72 * 60 * 60 * 1_000; // 72 hours

/** Duration of the settlement window in hours. */
export const SETTLEMENT_WINDOW_HOURS = 72;

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
    attestationTs:   formatIso9(new Date(startMs)),
    deadlineTs:      formatIso9(new Date(deadlineMs)),
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

// ── ComplianceClock (Phase 103.4 / 106) ──────────────────────────────────────

/**
 * ComplianceClock is a lightweight object used in Forensic Sandbox and
 * Statutory Handshake endpoints to communicate a 72-hour settlement deadline
 * with a stable clock_id for database persistence.
 */
export interface ComplianceClock {
  /** Stable identifier for this clock instance (e.g. "clock_q_36459_1234567890"). */
  clock_id:    string;
  /** ASN of the entity under compliance obligation. */
  asn:         string | null;
  /** organization name (if known). */
  org_name:    string | null;
  /** ISO-8601 timestamp when the clock was issued. */
  issued_at:   string;
  /** ISO-8601 deadline (issued_at + 72 hours). */
  deadline_at: string;
  /** Clock status. */
  status:      SettlementClockStatus;
  /** Milliseconds remaining until deadline. */
  remainingMs: number;
  /** Human-readable remaining time string. */
  remainingDisplay: string;
  /** True if the deadline has passed without settlement. */
  expired:     boolean;
  /** Kernel anchor. */
  kernelSha:   string;
  kernelVersion: string;
  /**
   * SHA-512 VaultChain™ pulse receipt — hex digest of
   * `clock_id | issued_at | kernelSha`. Populated by
   * `createComplianceClock()` and should be persisted to
   * `sovereign_audit_logs` as the tamper-evident record of clock creation.
   * Undefined only when crypto.subtle is unavailable.
   */
  pulse_hash?: string;
}

/**
 * Create a new ComplianceClock anchored to the current time.
 *
 * Phase 110.1.5 upgrade: Returns a Promise; computes a SHA-512 pulse receipt
 * (hex digest of `clock_id | issued_at | kernelSha`) and embeds it in
 * `clock.pulse_hash`.  Callers should persist `pulse_hash` to
 * `sovereign_audit_logs` as the tamper-evident VaultChain™ receipt.
 *
 * @param asn      ASN of the entity (e.g. "36459"). May be null.
 * @param orgName  organization name (optional).
 * @param clockId  Stable identifier for this clock (e.g. "clock_q_36459_<ts>").
 * @returns        Promise<ComplianceClock> record with SHA-512 pulse_hash.
 */
export async function createComplianceClock(
  asn:     string | null,
  orgName: string | null,
  clockId: string,
): Promise<ComplianceClock> {
  const now        = Date.now();
  const deadlineMs = now + SETTLEMENT_WINDOW_MS;
  const remaining  = SETTLEMENT_WINDOW_MS;
  const issuedAt   = formatIso9(new Date(now));

  // ── SHA-512 VaultChain™ pulse receipt ─────────────────────────────────────
  // Hash v1|clock_id|issued_at|kernelSha to produce a tamper-evident receipt.
  // The v1 version prefix enables future format evolution without breaking
  // existing hash verifications stored in sovereign_audit_logs.
  let pulse_hash: string | undefined;
  try {
    const payload  = `v1|${clockId}|${issuedAt}|${KERNEL_SHA}`;
    const encoded  = new TextEncoder().encode(payload);
    const hashBuf  = await crypto.subtle.digest("SHA-512", encoded);
    pulse_hash     = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    pulse_hash = undefined;
  }

  return {
    clock_id:        clockId,
    asn,
    org_name:        orgName,
    issued_at:       issuedAt,
    deadline_at:     formatIso9(new Date(deadlineMs)),
    status:          "ACTIVE",
    remainingMs:     remaining,
    remainingDisplay: formatRemaining(remaining),
    expired:         false,
    kernelSha:       KERNEL_SHA,
    kernelVersion:   KERNEL_VERSION,
    pulse_hash,
  };
}

// ── Reconciliation helper ─────────────────────────────────────────────────────

export interface ClockReconcileResult {
  /** Number of ACTIVE clocks that are now EXPIRED. */
  escalated: number;
  /** Number of ACTIVE clocks still within window. */
  active:    number;
  /** Number of SETTLED clocks skipped. */
  settled:   number;
  /** ISO-8601 reconciliation timestamp. */
  reconciledAt: string;
  /** Kernel anchor. */
  kernelVersion: string;
}

/**
 * Reconcile in-memory compliance clocks by evaluating their deadlines.
 *
 * For database-backed reconciliation, callers should query their D1 table
 * (e.g. `kaas_ledger` or a dedicated `compliance_clocks` table) and pass
 * the rows here. ACTIVE clocks whose deadline has passed are marked EXPIRED
 * and should be ESCALATED to the /api/v1/kaas/settle flow.
 *
 * @param clocks Array of ComplianceClock records to evaluate.
 * @returns      ClockReconcileResult summary + updated clocks array.
 */
export function reconcileClocks(
  clocks: ComplianceClock[],
): { result: ClockReconcileResult; clocks: ComplianceClock[] } {
  const now = Date.now();
  let escalated = 0;
  let active    = 0;
  let settled   = 0;

  const updated = clocks.map((clock) => {
    if (clock.status === "SETTLED") {
      settled++;
      return clock;
    }

    const deadlineMs = new Date(clock.deadline_at).getTime();
    const expired    = now > deadlineMs;

    if (expired && clock.status !== "EXPIRED") {
      escalated++;
      return {
        ...clock,
        status:          "EXPIRED" as SettlementClockStatus,
        remainingMs:     0,
        remainingDisplay: "EXPIRED",
        expired:         true,
      };
    }

    if (!expired) {
      active++;
      const remaining = deadlineMs - now;
      return {
        ...clock,
        remainingMs:      remaining,
        remainingDisplay: formatRemaining(remaining),
        expired:          false,
      };
    }

    return clock;
  });

  return {
    result: {
      escalated,
      active,
      settled,
      reconciledAt:  formatIso9(new Date()),
      kernelVersion: KERNEL_VERSION,
    },
    clocks: updated,
  };
}
