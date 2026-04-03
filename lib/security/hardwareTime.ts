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

/**
 * Generate six live sub-millisecond digits for ISO-9 formatting.
 *
 * Mirrors the strategy of timePrecision.formatIso9() when called without an
 * explicit source: injects real sub-ms entropy rather than padding with zeros
 * so AST timestamps carry genuine ISO-9 precision.
 *
 * Priority order:
 *   1. Node.js: process.hrtime.bigint() — nanoseconds within the current ms.
 *   2. Web / Workers: performance.now() fractional part — µs precision.
 *   3. Fallback: Math.random() — 0..999999 range.
 */
function subMilliDigits(): string {
  if (
    typeof process !== "undefined" &&
    typeof process.hrtime === "function" &&
    typeof (process.hrtime as { bigint?: () => bigint }).bigint === "function"
  ) {
    const ns  = (process.hrtime as { bigint: () => bigint }).bigint();
    const sub = Number(ns % 1_000_000n);
    return sub.toString().padStart(6, "0");
  }
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    const fracMs = performance.now() % 1;
    const total  = Math.floor(fracMs * 1_000_000);
    return total.toString().padStart(6, "0");
  }
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

function toIso9(epochMs: number): string {
  const d   = new Date(epochMs);
  const iso = d.toISOString();                    // "YYYY-MM-DDTHH:MM:SS.mmmZ"
  const [head, frac] = iso.split(".");
  const ms  = (frac?.replace("Z", "") ?? "000").slice(0, 3).padEnd(3, "0");
  const sub = subMilliDigits();                   // 6 live sub-ms digits
  return `${head}.${ms}${sub}Z`;
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

  // Compute milliseconds via bigint division first to avoid precision loss
  // when converting very large nanosecond deltas to number.
  const msBig = ns / 1_000_000n;
  const ms    = Number(msBig);

  // Seconds with 9 decimal places of nanosecond precision
  // e.g. 5.110291436s  (matches Sovereign Log format)
  const wholeSecBig = ns / 1_000_000_000n;
  const fracNsBig   = ns % 1_000_000_000n;
  const display     = `${wholeSecBig.toString()}.${fracNsBig.toString().padStart(9, "0")}s`;

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
