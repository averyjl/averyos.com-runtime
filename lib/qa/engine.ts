/**
 * lib/qa/engine.ts
 *
 * AveryOS™ Sovereign QA Engine — Phase 112 / GATE 112.1
 *
 * Core data model and utilities for the world-class QA system.
 *
 * Provides:
 *   • Type definitions for test results, suite results, and run records.
 *   • `buildQaRunRecord()` — compose a full run record from suite results.
 *   • `computeQaSha512()` — SHA-512 fingerprint of a run record for VaultChain
 *     integrity and tamper-evidence.
 *   • `assessRunStatus()` — derive pass/fail/partial from counts.
 *
 * Design principle: this module is dependency-free (only imports from
 * lib/sovereignConstants and standard globals).  It runs identically in:
 *   - Cloudflare Worker (Wrangler edge runtime)
 *   - Node.js ≥ 20 (unit tests)
 *   - Next.js App Router (API route handlers)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Perspective from which a test was authored / executed. */
export type QaTestPerspective =
  | "human_user"       // End-user browsing the website
  | "human_developer"  // Developer consuming the API
  | "bot_crawler"      // Benign crawler / SEO bot
  | "ai_agent"         // Autonomous AI/LLM agent
  | "security_probe"   // Adversarial security scanner / pen-tester
  | "performance"      // Load / latency benchmark
  | "documentation";   // Validates docs are accurate and complete

/** Severity classification for a failed test. */
export type QaTestSeverity = "critical" | "high" | "medium" | "low" | "info";

/** A single atomic test result. */
export interface QaTestResult {
  /** Human-readable name of the test. */
  name:         string;
  /** Whether the test passed. */
  passed:       boolean;
  /** How long the test took (milliseconds). */
  durationMs:   number;
  /** Perspective category. */
  perspective:  QaTestPerspective;
  /** Severity of a failure (ignored when passed=true). */
  severity:     QaTestSeverity;
  /** Optional failure detail / RCA hint. */
  errorMessage: string | null;
}

/** Aggregated results for one test suite (e.g. "WAF Logic"). */
export interface QaSuiteResult {
  /** Suite identifier (e.g. "wafLogic", "driftShield"). */
  suiteName:    string;
  /** Individual test outcomes. */
  tests:        QaTestResult[];
  /** Total tests in this suite. */
  total:        number;
  /** Passing tests. */
  passed:       number;
  /** Failing tests. */
  failed:       number;
  /** Wall-clock time for the whole suite (ms). */
  durationMs:   number;
}

/** Run status derived from aggregate pass/fail counts. */
export type QaRunStatus = "pass" | "fail" | "partial";

/** Full QA run record — persisted to D1 `qa_audit_log` and VaultChain. */
export interface QaRunRecord {
  /** Unique run identifier (UUID v4 or deterministic from timestamp). */
  runId:         string;
  /** What triggered the run: "ci", "manual", "scheduled", "ai_generator". */
  trigger:       string;
  /** Derived overall status. */
  status:        QaRunStatus;
  /** Total tests across all suites. */
  totalTests:    number;
  /** Passing tests. */
  passedTests:   number;
  /** Failing tests. */
  failedTests:   number;
  /** SHA-512 fingerprint of the serialised result for tamper-evidence. */
  sha512:        string;
  /** Kernel SHA-512 anchor. */
  kernelSha:     string;
  /** Kernel version. */
  kernelVersion: string;
  /** All suite results (JSON-serialisable). */
  suites:        QaSuiteResult[];
  /** ISO-9 timestamp of the run. */
  createdAt:     string;
}

// ── Status derivation ─────────────────────────────────────────────────────────

/**
 * Derive the overall run status from pass/fail counts.
 *
 * @param passed  Number of passing tests.
 * @param failed  Number of failing tests.
 * @returns       "pass" if failed=0, "fail" if passed=0, "partial" otherwise.
 */
export function assessRunStatus(passed: number, failed: number): QaRunStatus {
  if (failed === 0)  return "pass";
  if (passed === 0)  return "fail";
  return "partial";
}

// ── SHA-512 fingerprint ───────────────────────────────────────────────────────

/**
 * Compute a SHA-512 hex fingerprint of the run's canonical payload.
 *
 * The canonical payload is:
 *   `runId + "|" + createdAt + "|" + totalTests + "|" + passedTests +
 *    "|" + failedTests + "|" + status + "|" + KERNEL_SHA`
 *
 * This ensures even a single test result change produces a completely different
 * fingerprint — a cryptographic tamper-evident seal.
 *
 * Uses `crypto.subtle.digest` which is available in both Cloudflare Workers
 * and Node.js ≥ 20 without any additional dependencies.
 *
 * @param record  Partially-built run record (sha512 field not yet required).
 * @returns       Hex-encoded SHA-512 string.
 */
export async function computeQaSha512(
  record: Omit<QaRunRecord, "sha512">,
): Promise<string> {
  const payload = [
    record.runId,
    record.createdAt,
    String(record.totalTests),
    String(record.passedTests),
    String(record.failedTests),
    record.status,
    record.kernelSha,
  ].join("|");

  const encoded = new TextEncoder().encode(payload);
  const hashBuf = await crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Run record builder ────────────────────────────────────────────────────────

/**
 * Build a fully-signed `QaRunRecord` from a list of suite results.
 *
 * Computes totals, derives status, stamps with ISO-9 timestamp, generates
 * a run ID, then computes and attaches the SHA-512 seal.
 *
 * @param suites   All QaSuiteResult objects from this run.
 * @param trigger  What triggered the run ("ci", "manual", etc.).
 * @param runId    Optional override for the run ID (useful for tests).
 * @returns        Fully-populated, SHA-512 signed QaRunRecord.
 */
export async function buildQaRunRecord(
  suites:  QaSuiteResult[],
  trigger: string,
  runId?:  string,
): Promise<QaRunRecord> {
  const now        = new Date();
  const iso        = now.toISOString();
  const milli      = iso.split(".")[1]?.replace("Z", "").slice(0, 3) ?? "000";
  const createdAt  = `${iso.split(".")[0]}.${milli}000000Z`;

  const totalTests  = suites.reduce((s, x) => s + x.total,  0);
  const passedTests = suites.reduce((s, x) => s + x.passed, 0);
  const failedTests = suites.reduce((s, x) => s + x.failed, 0);
  const status      = assessRunStatus(passedTests, failedTests);
  const id          = runId ?? `qa-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  const partial: Omit<QaRunRecord, "sha512"> = {
    runId:         id,
    trigger,
    status,
    totalTests,
    passedTests,
    failedTests,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
    suites,
    createdAt,
  };

  const sha512 = await computeQaSha512(partial);

  return { ...partial, sha512 };
}

// ── Suite builder ─────────────────────────────────────────────────────────────

/**
 * Build a `QaSuiteResult` from a list of `QaTestResult` items.
 *
 * Computes totals and total wall-clock time automatically.
 *
 * @param suiteName  Display name for the suite.
 * @param tests      Individual test results.
 * @returns          Fully-populated suite result.
 */
export function buildQaSuite(suiteName: string, tests: QaTestResult[]): QaSuiteResult {
  const passed    = tests.filter((t) => t.passed).length;
  const failed    = tests.length - passed;
  const durationMs = tests.reduce((s, t) => s + t.durationMs, 0);
  return { suiteName, tests, total: tests.length, passed, failed, durationMs };
}

/**
 * Build a single `QaTestResult` by timing a synchronous or async assertion
 * function.
 *
 * If `fn` throws, the test is marked as failed and the error message is
 * captured as the `errorMessage` for RCA.
 *
 * @param name         Test name.
 * @param perspective  Test perspective.
 * @param severity     Failure severity.
 * @param fn           The test body (sync or async — throws on failure).
 * @returns            QaTestResult with pass/fail, duration, and error detail.
 */
export async function runTest(
  name:        string,
  perspective: QaTestPerspective,
  severity:    QaTestSeverity,
  fn:          () => unknown | Promise<unknown>,
): Promise<QaTestResult> {
  const start = Date.now();
  let passed       = false;
  let errorMessage: string | null = null;

  try {
    await fn();
    passed = true;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  return {
    name,
    passed,
    durationMs:  Date.now() - start,
    perspective,
    severity,
    errorMessage,
  };
}
