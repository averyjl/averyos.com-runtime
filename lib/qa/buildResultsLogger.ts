/**
 * lib/qa/buildResultsLogger.ts
 *
 * AveryOS™ QA Build Results Logger — Phase 114.3
 *
 * Saves QA / Performance / Security engine results to:
 *   1. D1  — `qa_build_results` table for queryable history
 *   2. R2  — `cloudflare-managed-42f4b874/QA/qa_build_results/{build_id}.json`
 *             for long-term archival
 *
 * Requirements (from Sovereign Admin Log Phase 112.7):
 *   "We need the QA engine Performance Engine and security engine and all
 *    other logs within AveryOS to be written to D1 table that will need to
 *    be created and saved in R2 directory
 *    cloudflare-managed-42f4b874/QA/qa_build_results/"
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BuildEngine = "QA" | "PERFORMANCE" | "SECURITY" | "FULL";
export type BuildStatus = "pass" | "fail" | "partial";

export interface BuildResultPayload {
  /** Unique identifier for this build/run (e.g. CI run ID or UUID). */
  buildId:       string;
  /** Which engine produced this result. */
  engine:        BuildEngine;
  /** Git branch. */
  branch?:       string;
  /** Git commit SHA. */
  commitSha?:    string;
  /** Overall pass/fail/partial status. */
  status:        BuildStatus;
  totalChecks:   number;
  passedChecks:  number;
  failedChecks:  number;
  /** Total run duration in milliseconds. */
  durationMs?:   number;
  /** Full result detail as a serializable object. */
  resultData:    unknown;
}

// Minimal binding types
interface D1Statement { run(): Promise<void>; }
interface D1DatabaseLike {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
}
interface R2BucketLike {
  put(key: string, body: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

// ── R2 key builder ─────────────────────────────────────────────────────────────

/** R2 object key for a build result. */
export function buildResultR2Key(buildId: string, engine: BuildEngine): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `cloudflare-managed-42f4b874/QA/qa_build_results/${date}/${engine}/${buildId}.json`;
}

// ── Logger ─────────────────────────────────────────────────────────────────────

/**
 * Persist a build result to D1 and R2.
 *
 * Both writes are attempted independently — a failure in one does not block
 * the other, and neither failure is fatal to the caller.
 *
 * @returns The R2 object key if the R2 write succeeded, null otherwise.
 */
export async function logBuildResult(
  payload: BuildResultPayload,
  db:      D1DatabaseLike | null,
  r2?:     R2BucketLike   | null,
): Promise<{ r2Key: string | null }> {
  const r2Key       = buildResultR2Key(payload.buildId, payload.engine);
  const createdAt   = formatIso9();
  const resultJson  = JSON.stringify({
    ...payload,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
    createdAt,
    r2Key,
  });

  // Truncate inline JSON to 64 KB for D1 storage limits
  const inlineJson = resultJson.length > 65_536
    ? resultJson.slice(0, 65_533) + "..."
    : resultJson;

  // ── D1 write ─────────────────────────────────────────────────────────────────
  if (db) {
    try {
      await db.prepare(
        `INSERT OR REPLACE INTO qa_build_results
           (build_id, engine, branch, commit_sha, status,
            total_checks, passed_checks, failed_checks,
            duration_ms, r2_object_key, result_json,
            kernel_sha, kernel_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        payload.buildId,
        payload.engine,
        payload.branch  ?? null,
        payload.commitSha ?? null,
        payload.status,
        payload.totalChecks,
        payload.passedChecks,
        payload.failedChecks,
        payload.durationMs ?? null,
        r2Key,
        inlineJson,
        KERNEL_SHA,
        KERNEL_VERSION,
        createdAt,
      ).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[BuildResultsLogger] D1 write failed:", msg);
    }
  }

  // ── R2 write ──────────────────────────────────────────────────────────────────
  let r2Written = false;
  if (r2) {
    try {
      await r2.put(r2Key, resultJson, {
        httpMetadata: { contentType: "application/json" },
      });
      r2Written = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[BuildResultsLogger] R2 write failed:", msg);
    }
  }

  return { r2Key: r2Written ? r2Key : null };
}
