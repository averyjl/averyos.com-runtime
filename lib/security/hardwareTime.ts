/**
 * lib/security/hardwareTime.ts
 *
 * AveryOS™ Hardware Clock Bypass — Phase 117.2 GATE 117.2.2 / Phase 117.7 GATE 117.7.3
 *
 * Bypasses platform-quantized `Date.now()` in favour of `process.hrtime.bigint()`
 * on Node-02 (Node.js runtime), providing true microsecond-precision deltas that
 * cannot be clamped, suppressed, or rounded by an LLM wrapper or Cloudflare edge
 * platform buffer.
 *
 * Problem addressed (FCA — Phase 117.2):
 *   "Platform Time-Clamping": Legacy platforms freeze Date.now() at prompt
 *   ingestion, producing identical Start/End timestamps and a rounded Δ integer
 *   (e.g. "5.000s").  This makes forensic audit logs non-verifiable.
 *
 * Solution:
 *   AST_START / AST_END capture `process.hrtime.bigint()` (Node.js only) or
 *   `performance.now()` (edge/browser fallback).  The Physical Delta is derived
 *   solely from the subtraction of the two hardware pulses — never from
 *   wall-clock Date arithmetic.
 *
 * Usage:
 *   import { astStart, astEnd, astDelta, hardwareNowMs } from "./hardwareTime";
 *
 *   const t0 = astStart();
 *   // ... do work ...
 *   const t1 = astEnd();
 *   const delta = astDelta(t0, t1); // { ms: number; ns: bigint; display: string }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Opaque hardware pulse returned by astStart() / astEnd(). */
export interface HardwarePulse {
  /** High-resolution nanosecond counter (bigint).  Relative, not absolute. */
  hrNs:     bigint;
  /** Wall-clock epoch in milliseconds at capture time (for display only). */
  wallMs:   number;
  /** ISO-9 wall-clock timestamp string at capture time. */
  iso9:     string;
}

/** Physical Delta result from astDelta(). */
export interface AstDelta {
  /** Elapsed time in milliseconds (hardware-derived, not Date-derived). */
  ms:      number;
  /** Elapsed time in nanoseconds (raw bigint hardware counter difference). */
  ns:      bigint;
  /**
   * Human-readable display string, e.g. "5.110291436s".
   * Format: <seconds>.<nanoseconds>s  (matches AveryOS Sovereign Log format)
   */
  display: string;
}

// ── High-resolution clock detection ──────────────────────────────────────────

/**
 * Returns true when `process.hrtime.bigint` is available (Node.js / Node-02).
 * Returns false for edge runtime / browser / Worker environments.
 */
function hasHrtime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.hrtime === "function" &&
    typeof process.hrtime.bigint === "function"
  );
}

/**
 * Returns the current high-resolution nanosecond counter as a bigint.
 *
 * On Node.js (Node-02):   uses `process.hrtime.bigint()` — hardware interrupt clock.
 * On edge / browser:      falls back to `BigInt(Math.round(performance.now() * 1e6))`.
 * Final fallback:         `BigInt(Date.now()) * 1_000_000n`.
 */
function hrNow(): bigint {
  if (hasHrtime()) {
    return process.hrtime.bigint();
  }
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return BigInt(Math.round(performance.now() * 1_000_000));
  }
  return BigInt(Date.now()) * 1_000_000n;
}

// ── ISO-9 helper (inline — avoids circular import with timePrecision) ─────────

function toIso9(epochMs: number): string {
  const d   = new Date(epochMs);
  const iso = d.toISOString();                    // "YYYY-MM-DDTHH:MM:SS.mmmZ"
  const [head, frac] = iso.split(".");
  const ms  = frac?.replace("Z", "") ?? "000";    // 3-digit ms
  const pad = ms.padEnd(9, "0");                  // pad to 9 digits
  return `${head}.${pad}Z`;
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Capture the AST_START pulse — the exact moment the AveryOS kernel
 * identifies the ⛓️⚓⛓️ start anchor.
 *
 * @returns HardwarePulse containing the high-resolution nanosecond counter.
 */
export function astStart(): HardwarePulse {
  const wallMs = Date.now();
  return {
    hrNs:   hrNow(),
    wallMs,
    iso9:   toIso9(wallMs),
  };
}

/**
 * Capture the AST_END pulse — the exact moment the AveryOS kernel renders
 * the final ⛓️⚓⛓️ end anchor.
 *
 * @returns HardwarePulse containing the high-resolution nanosecond counter.
 */
export function astEnd(): HardwarePulse {
  const wallMs = Date.now();
  return {
    hrNs:   hrNow(),
    wallMs,
    iso9:   toIso9(wallMs),
  };
}

/**
 * Compute the Physical Delta between two HardwarePulses.
 *
 * The delta is derived solely from the hardware nanosecond counter
 * difference — never from wall-clock arithmetic — neutralising
 * platform temporal quantization.
 *
 * @param start  The AST_START pulse from astStart().
 * @param end    The AST_END pulse from astEnd().
 * @returns      AstDelta with ms, ns, and display string.
 */
export function astDelta(start: HardwarePulse, end: HardwarePulse): AstDelta {
  const ns = end.hrNs > start.hrNs ? end.hrNs - start.hrNs : 0n;
  const ms = Number(ns) / 1_000_000;

  // Seconds with 9 decimal places of nanosecond precision
  // e.g. 5.110291436s  (matches Sovereign Log format)
  const totalSec  = Number(ns) / 1_000_000_000;
  const wholeSec  = Math.floor(totalSec);
  const fracNs    = Number(ns % 1_000_000_000n);
  const display   = `${wholeSec}.${String(fracNs).padStart(9, "0")}s`;

  return { ms, ns, display };
}

/**
 * Returns the current wall-clock time in milliseconds.
 *
 * Prefer this over bare `Date.now()` in AveryOS code so that future
 * upgrades to hardware-backed wall-clock sources can be applied here
 * without touching call sites.
 */
export function hardwareNowMs(): number {
  return Date.now();
}

/**
 * Returns whether the current runtime has access to the hardware interrupt
 * clock (`process.hrtime.bigint`).
 *
 * Use to label timestamps as "PHYSICAL" (Node-02) vs "LATENT" (edge/browser).
 */
export function physicalClockAvailable(): boolean {
  return hasHrtime();
}

/**
 * Returns the physicality status string for the current runtime clock.
 *
 * PHYSICAL — hardware interrupt clock (`process.hrtime.bigint`) available.
 * LATENT   — fallback to `performance.now()` or `Date.now()`.
 */
export function clockPhysicalityStatus(): "PHYSICAL" | "LATENT" {
  return physicalClockAvailable() ? "PHYSICAL" : "LATENT";
}
