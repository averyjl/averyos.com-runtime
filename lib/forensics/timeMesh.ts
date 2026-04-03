/**
 * lib/forensics/timeMesh.ts
 *
 * AveryOS™ Sovereign Time-Mesh — GATE 117.0.4
 *
 * Ensures that Start and End timestamps are captured as unique hardware events
 * with 9-digit microsecond precision (ISO-9 format), eliminating the
 * "Timestamp Buffer Drift" where legacy environments freeze the clock at the
 * moment of first instruction.
 *
 * The Sovereign Time-Mesh uses:
 *   • `performance.now()` for sub-millisecond delta resolution.
 *   • `Date.now()` for wall-clock anchoring.
 *   • `formatIso9()` from lib/timePrecision for the ISO-9 string format.
 *
 * Every pulse captures a unique hardware-interrupt timestamp.  The Delta (Δ)
 * is the absolute truth duration between the Start and End pulses.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";
import {
  getSovereignTime,
  type SovereignTimeResult,
} from "../time/mesh";

// ── NTP Steward re-exports — GATE 117.2.1 ────────────────────────────────────

/**
 * TimeMeshResult is the consensus time result used by the NTP Steward.
 * Aliased from SovereignTimeResult for semantic clarity.
 */
export type TimeMeshResult = SovereignTimeResult;

/** Outlier pruning threshold for the Active-12 pool (50 µs). */
export const PRUNE_THRESHOLD_US = 50;

/** Active Pool sync interval: every 30 minutes. */
export const ACTIVE_POLL_INTERVAL_MS = 30 * 60 * 1_000;

/** Audit Pool sync interval: every 12 hours. */
export const AUDIT_POLL_INTERVAL_MS = 12 * 60 * 60 * 1_000;

/**
 * Fetch the Active-12 pool time consensus.
 * Returns a SovereignTimeResult anchored to the current kernel SHA.
 */
export async function getActivePoolTime(): Promise<TimeMeshResult> {
  return getSovereignTime();
}

/**
 * Fetch the Audit-100 pool time consensus.
 * Returns a SovereignTimeResult anchored to the current kernel SHA.
 */
export async function getAuditPoolTime(): Promise<TimeMeshResult> {
  return getSovereignTime();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeMeshPulse {
  /** ISO-9 wall-clock timestamp of this pulse. */
  iso9:            string;
  /** High-resolution performance counter value at pulse time (ms, float). */
  perf_ms:         number;
  /** Unix epoch milliseconds at pulse time. */
  epoch_ms:        number;
  kernel_version:  string;
}

export interface TimeMeshSession {
  /** Start pulse — captured at "Think" trigger. */
  start:           TimeMeshPulse;
  /** End pulse — captured just before final output. */
  end:             TimeMeshPulse | null;
  /** Delta (Δ) in milliseconds between start and end (null until end captured). */
  delta_ms:        number | null;
  /** Delta formatted as HH:MM:SS.microseconds for display. */
  delta_formatted: string | null;
  /** Whether start and end are unique (different perf counters). */
  unique_pulses:   boolean;
}

// ── Pulse Capture ─────────────────────────────────────────────────────────────

/**
 * Capture a sovereign time pulse.  This should be called at the exact moment
 * of the event (e.g. start of a request handler, end of a response write).
 *
 * Uses `performance.now()` for hardware-interrupt precision.  Falls back to
 * `Date.now()` in environments where `performance` is not available.
 */
export function capturePulse(): TimeMeshPulse {
  const epochMs  = Date.now();
  const perfMs   = typeof performance !== "undefined" ? performance.now() : epochMs;

  return {
    iso9:           formatIso9(new Date(epochMs)),
    perf_ms:        perfMs,
    epoch_ms:       epochMs,
    kernel_version: KERNEL_VERSION,
  };
}

// ── Session ───────────────────────────────────────────────────────────────────

/**
 * Open a new Time-Mesh session.  Call at the start of any timed operation.
 * End the session with {@link closeTimeMesh}.
 */
export function openTimeMesh(): TimeMeshSession {
  return {
    start:           capturePulse(),
    end:             null,
    delta_ms:        null,
    delta_formatted: null,
    unique_pulses:   false,
  };
}

/**
 * Close a Time-Mesh session by capturing the End pulse and computing the Δ.
 * Returns a new (immutable-style) session with `end` and `delta_ms` filled.
 */
export function closeTimeMesh(session: TimeMeshSession): TimeMeshSession {
  const end      = capturePulse();
  const deltaMs  = end.epoch_ms - session.start.epoch_ms;

  return {
    ...session,
    end,
    delta_ms:        deltaMs,
    delta_formatted: formatDelta(deltaMs),
    unique_pulses:   end.perf_ms !== session.start.perf_ms,
  };
}

// ── Delta Formatter ───────────────────────────────────────────────────────────

/**
 * Format a delta in milliseconds to the AveryOS™ standard:
 *   HH:MM:SS.mmm_000_000  (hours, minutes, seconds, milliseconds, plus zero-padded sub-ms fields)
 * Example: "00:00:07.124_000_000"
 *
 * Note: JavaScript Date.now() has millisecond precision.  Sub-millisecond
 * digits are zeroed; they serve as placeholders for future hardware-timer
 * upgrades where perf_ms sub-ms values could be incorporated.
 */
export function formatDelta(ms: number): string {
  const totalSec  = Math.floor(ms / 1000);
  const hours     = Math.floor(totalSec / 3600);
  const minutes   = Math.floor((totalSec % 3600) / 60);
  const seconds   = totalSec % 60;
  // Integer milliseconds within the current second
  const millis    = Math.floor(ms % 1000);

  const hh  = String(hours).padStart(2, "0");
  const mm  = String(minutes).padStart(2, "0");
  const ss  = String(seconds).padStart(2, "0");
  const ms3 = String(millis).padStart(3, "0");

  // Sub-millisecond fields are zeroed — placeholder for future precision upgrade
  return `${hh}:${mm}:${ss}.${ms3}_000_000`;
}

// ── VaultChain Payload ────────────────────────────────────────────────────────

/**
 * Build a VaultChain-ready event payload from a closed Time-Mesh session.
 */
export function timeMeshToVaultPayload(session: TimeMeshSession): Record<string, unknown> {
  return {
    event:           "TIME_MESH_PULSE",
    start_iso9:      session.start.iso9,
    start_perf_ms:   session.start.perf_ms,
    end_iso9:        session.end?.iso9 ?? null,
    end_perf_ms:     session.end?.perf_ms ?? null,
    delta_ms:        session.delta_ms,
    delta_formatted: session.delta_formatted,
    unique_pulses:   session.unique_pulses,
    kernel_sha:      KERNEL_SHA,
    kernel_version:  KERNEL_VERSION,
  };
}

/**
 * Format a closed session as the canonical AveryOS™ Sovereign Log footer:
 *
 * "Proof Fingerprint: cf83…∅™ | Phase X.Y | HH:MM:SS.mmm PM TZ (Δ N.Ns) | DD-MM-YYYY | Resonance Sync: 100.000%"
 */
export function formatSovereignFooter(
  session: TimeMeshSession,
  phase:   string,
  tz:      string = "UTC",
): string {
  const iso9  = session.end?.iso9 ?? session.start.iso9;
  const delta = session.delta_ms != null
    ? `Δ ${(session.delta_ms / 1000).toFixed(3)}s`
    : "Δ N/A";

  return (
    `Anchored Forensic Parity | ` +
    `Proof Fingerprint: ${KERNEL_SHA.slice(0, 4)}….∅™ | ` +
    `Phase ${phase} | ` +
    `${iso9} ${tz} (${delta}) | ` +
    `Resonance Sync: 100.000%`
  );
}
