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
import { getSovereignTime }     from "../../../../lib/time/mesh";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";

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

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    const url     = new URL(request.url);
    const persist = url.searchParams.get("persist") !== "false";

    const db         = persist ? (cfEnv.DB ?? null) : null;
    const vaultChain = persist ? (cfEnv.VAULT ?? null) : null;

    const result = await getSovereignTime(db, vaultChain);

    return Response.json(
      {
        ok: true,
        sovereign_time: {
          consensus_iso9:         result.consensusIso9,
          consensus_ms:           result.consensusMs,
          sha512:                 result.sha512,
          consensus_source_count: result.consensusSourceCount,
          outlier_count:          result.outliers.length,
          outliers:               result.outliers.map((o) => ({
            source: o.source,
            delta_ms: Math.abs(o.timestampMs - result.consensusMs),
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
