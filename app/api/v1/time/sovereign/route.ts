/**
 * GET /api/v1/time/sovereign
 *
 * Stratum-Zero Sovereign Time API — AveryOS™ Phase 108.1
 *
 * Exposes the Time Mesh consensus result from lib/time/mesh.ts.
 * Polls 10 authoritative NTP-over-HTTP sources, rejects outliers beyond
 * ±17 ms of the median, and returns a SHA-512 anchored consensus timestamp.
 * Persists the result to D1 `sovereign_time_log` on every successful call.
 *
 * Auth: None required (public time endpoint).
 *       Pass ?persist=false to skip D1 persistence (dry-run).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSovereignTime, SovereignTimeResult } from "../../../../../lib/time/mesh";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:      D1Database;
  VAULT?:   { put(key: string, value: string): Promise<void> };
}

/**
 * Build a D1 persistence callback for `getSovereignTime`.
 * Inserts one row into `sovereign_time_log` with ISO-9 timestamp, SHA-512
 * anchor, and source/outlier counts.
 */
function buildDbCallback(db: D1Database): (result: SovereignTimeResult) => Promise<void> {
  return async (result: SovereignTimeResult) => {
    await db
      .prepare(
        `INSERT INTO sovereign_time_log
           (consensus_iso9, consensus_ms, sha512, source_count, outlier_count,
            kernel_sha, kernel_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        result.iso9,
        result.consensusMs,
        result.sha512,
        result.consensusCount,
        result.outlierCount,
        result.kernelSha,
        result.kernelVersion,
        new Date().toISOString(),
      )
      .run();
  };
}

/**
 * Build a VaultChain™ persistence callback for `getSovereignTime`.
 * Writes the full result JSON to R2 under `timemesh/<consensusMs>.json`.
 */
function buildVaultCallback(
  vault: { put(key: string, value: string): Promise<void> },
): (result: SovereignTimeResult) => Promise<void> {
  return async (result: SovereignTimeResult) => {
    await vault.put(
      `timemesh/${result.consensusMs}.json`,
      JSON.stringify(result, null, 2),
    );
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    const url     = new URL(request.url);
    const persist = url.searchParams.get("persist") !== "false";

    // Build optional persistence callbacks — only when persist=true and bindings exist.
    const dbFn    = (persist && cfEnv.DB)    ? buildDbCallback(cfEnv.DB)       : undefined;
    const vaultFn = (persist && cfEnv.VAULT) ? buildVaultCallback(cfEnv.VAULT) : undefined;

    const result = await getSovereignTime(dbFn, vaultFn);

    // Extract outlier details from the sources array (entries not included in consensus).
    const outlierSources = result.sources.filter((s) => !s.included && s.epochMs !== null);

    return Response.json(
      {
        ok: true,
        sovereign_time: {
          consensus_iso9:         result.iso9,
          consensus_ms:           result.consensusMs,
          sha512:                 result.sha512,
          consensus_source_count: result.consensusCount,
          outlier_count:          result.outlierCount,
          outliers:               outlierSources.map((s) => ({
            source:   s.name,
            delta_ms: s.deviationMs,
          })),
          kernel_sha:             KERNEL_SHA,
          kernel_version:         KERNEL_VERSION,
        },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
