/**
 * lib/qa/performance.ts
 *
 * AveryOS™ Sovereign Performance QA Utilities — Phase 112 / GATE 112.3
 *
 * Pure micro-benchmark utilities for timing synchronous and asynchronous
 * functions.  Results feed directly into the QA Engine's `QaTestResult`
 * via `runTest()`.
 *
 * All functions are dependency-free and run identically in:
 *   - Cloudflare Workers
 *   - Node.js ≥ 20 (unit tests)
 *   - Next.js API routes
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Summary of a micro-benchmark run. */
export interface BenchmarkResult {
  /** Name / label for this benchmark. */
  name:         string;
  /** Number of iterations executed. */
  iterations:   number;
  /** Total wall-clock time (ms). */
  totalMs:      number;
  /** Average time per iteration (ms). */
  avgMs:        number;
  /** Minimum time across iterations (ms). */
  minMs:        number;
  /** Maximum time across iterations (ms). */
  maxMs:        number;
  /** Median time (ms). */
  medianMs:     number;
  /** p95 latency (ms) — useful for tail-latency assessment. */
  p95Ms:        number;
  /** p99 latency (ms). */
  p99Ms:        number;
}

/**
 * Thresholds for interpreting benchmark results.
 * Change these to tighten or relax performance requirements.
 */
export const PERF_THRESHOLDS = {
  /** A utility function (e.g. formatIso9, computeQaSha512) should finish in ≤ this ms on avg. */
  UTILITY_AVG_MS:      10,
  /** A crypto operation (e.g. SHA-512 compute) should finish in ≤ this ms on avg. */
  CRYPTO_AVG_MS:       50,
  /** A complete QA suite run should finish in ≤ this ms total. */
  SUITE_TOTAL_MS:   5_000,
} as const;

// ── Core benchmark ────────────────────────────────────────────────────────────

/**
 * Run `fn` for `iterations` loops, recording per-call wall-clock time, then
 * return a full `BenchmarkResult`.
 *
 * Uses `Date.now()` (1 ms resolution) for broad compatibility.  For
 * sub-millisecond precision in Node.js tests, the caller may pass a wrapper
 * that uses `performance.now()` internally.
 *
 * @param name        Label for reporting.
 * @param fn          Synchronous or async function to benchmark.
 * @param iterations  How many times to invoke `fn`. Default 100.
 * @returns           BenchmarkResult.
 */
export async function runBenchmark(
  name:       string,
  fn:         () => unknown | Promise<unknown>,
  iterations: number = 100,
): Promise<BenchmarkResult> {
  if (iterations < 1) {
    throw new RangeError(`runBenchmark: iterations must be >= 1, got ${iterations}`);
  }

  const times: number[] = [];
  const totalStart = Date.now();

  for (let i = 0; i < iterations; i++) {
    const t = Date.now();
    await fn();
    times.push(Date.now() - t);
  }

  const totalMs = Date.now() - totalStart;
  const sorted  = [...times].sort((a, b) => a - b);
  const sum     = times.reduce((s, v) => s + v, 0);

  return {
    name,
    iterations,
    totalMs,
    avgMs:    sum / iterations,
    minMs:    sorted[0] ?? 0,
    maxMs:    sorted[sorted.length - 1] ?? 0,
    medianMs: sorted[Math.max(0, Math.floor(iterations / 2))] ?? 0,
    p95Ms:    sorted[Math.max(0, Math.floor(iterations * 0.95))] ?? 0,
    p99Ms:    sorted[Math.max(0, Math.floor(iterations * 0.99))] ?? 0,
  };
}

// ── Threshold assertion ───────────────────────────────────────────────────────

/**
 * Throw an error if `result.avgMs` exceeds `maxAvgMs`.
 * Designed to be called inside `runTest()` bodies so failures are captured.
 *
 * @param result    Benchmark result.
 * @param maxAvgMs  Maximum acceptable average latency in milliseconds.
 */
export function assertBenchmarkAvg(result: BenchmarkResult, maxAvgMs: number): void {
  if (result.avgMs > maxAvgMs) {
    throw new Error(
      `Performance regression in "${result.name}": ` +
      `avg=${result.avgMs.toFixed(2)}ms exceeds limit=${maxAvgMs}ms ` +
      `(${result.iterations} iterations, total=${result.totalMs}ms)`
    );
  }
}

/**
 * Throw an error if `result.p95Ms` exceeds `maxP95Ms`.
 *
 * @param result    Benchmark result.
 * @param maxP95Ms  Maximum acceptable p95 latency in milliseconds.
 */
export function assertBenchmarkP95(result: BenchmarkResult, maxP95Ms: number): void {
  if (result.p95Ms > maxP95Ms) {
    throw new Error(
      `P95 latency regression in "${result.name}": ` +
      `p95=${result.p95Ms.toFixed(2)}ms exceeds limit=${maxP95Ms}ms`
    );
  }
}
