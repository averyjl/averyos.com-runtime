/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * lib/forensics/vitality.ts
 *
 * AveryOS™ Performance Engine — Phase 114.3 GATE 114.3.2
 *
 * Provides `logVitalityMetric()` which tracks function execution timings
 * using the Sovereign Time Mesh (9-digit microsecond precision).
 *
 * Records are written to the D1 `vitality_metrics` table and can be surfaced
 * via the Admin Performance Dashboard at /admin/forensics (behind VaultGate).
 *
 * Metric fields:
 *   function_name  — name of the measured function / operation
 *   start_ns       — ISO-9 timestamp at function entry
 *   end_ns         — ISO-9 timestamp at function exit
 *   delta_ms       — elapsed wall-clock time in milliseconds (float)
 *   status         — "OK" | "ERROR"
 *   error_message  — populated on errors (null otherwise)
 *   kernel_sha     — sovereign kernel anchor
 *   phase          — e.g. "114.3.2"
 *
 * Throttle detection: if delta_ms exceeds THROTTLE_THRESHOLD_MS, the record
 * is flagged as THROTTLED and a warning is emitted, enabling external ISP/Cloud
 * interference to be identified in the dashboard.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Delta above which the metric is flagged as THROTTLED (external interference). */
const THROTTLE_THRESHOLD_MS = 3_000;

// ── Types ──────────────────────────────────────────────────────────────────────

export type VitalityStatus = "OK" | "ERROR" | "THROTTLED";

export interface VitalityMetric {
  functionName:  string;
  startMs:       number;
  endMs:         number;
  deltaMs:       number;
  status:        VitalityStatus;
  errorMessage:  string | null;
  phase:         string;
}

// Minimal D1 binding type (mirrors wrangler's D1Database)
interface D1Statement {
  run(): Promise<void>;
}
interface D1Database {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
}

// ── Core function ──────────────────────────────────────────────────────────────

/**
 * Log a vitality metric for a function call.
 *
 * @param functionName  - Human-readable function / operation name.
 * @param startMs       - `performance.now()` or `Date.now()` at entry (ms).
 * @param endMs         - `performance.now()` or `Date.now()` at exit (ms).
 * @param db            - D1 binding. Pass `null` to log to console only.
 * @param opts          - Optional overrides.
 * @returns             - The computed `VitalityMetric`.
 */
export async function logVitalityMetric(
  functionName: string,
  startMs:      number,
  endMs:        number,
  db:           D1Database | null,
  opts?: {
    status?:       VitalityStatus;
    errorMessage?: string | null;
    phase?:        string;
  },
): Promise<VitalityMetric> {
  const deltaMs = endMs - startMs;
  const isThrottled = deltaMs > THROTTLE_THRESHOLD_MS;

  const status: VitalityStatus =
    opts?.status === "ERROR" ? "ERROR"
    : isThrottled            ? "THROTTLED"
    :                          "OK";

  if (isThrottled) {
    console.warn(
      `[VitalityEngine] ⚠️  THROTTLE ALERT — ${functionName} took ${deltaMs.toFixed(3)} ms` +
      ` (threshold: ${THROTTLE_THRESHOLD_MS} ms). Possible external interference.`
    );
  }

  const metric: VitalityMetric = {
    functionName,
    startMs,
    endMs,
    deltaMs,
    status,
    errorMessage:  opts?.errorMessage ?? null,
    phase:         opts?.phase ?? "114.3.2",
  };

  const startIso  = formatIso9(new Date(startMs));
  const endIso    = formatIso9(new Date(endMs));
  const recordedAt = formatIso9();

  if (db) {
    try {
      await db.prepare(
        `INSERT INTO vitality_metrics
           (function_name, start_ns, end_ns, delta_ms, status, error_message,
            phase, kernel_sha, kernel_version, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        functionName.slice(0, 128),
        startIso,
        endIso,
        deltaMs,
        status,
        metric.errorMessage,
        metric.phase,
        KERNEL_SHA,
        KERNEL_VERSION,
        recordedAt,
      ).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[VitalityEngine] D1 write failed:", msg);
      // Non-fatal: still return the metric.
    }
  }

  return metric;
}

/**
 * Convenience wrapper that times an async function and logs the result.
 *
 * Usage:
 * ```ts
 * const result = await timedCall("fetchStripeBalance", () => stripe.balance.retrieve(), db);
 * ```
 */
export async function timedCall<T>(
  functionName: string,
  fn:           () => Promise<T>,
  db:           D1Database | null,
  phase?:       string,
): Promise<T> {
  const t0 = Date.now();
  try {
    const result = await fn();
    await logVitalityMetric(functionName, t0, Date.now(), db, { phase });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logVitalityMetric(functionName, t0, Date.now(), db, {
      status:       "ERROR",
      errorMessage: msg.slice(0, 512),
      phase,
    });
    throw err;
  }
}
