/**
 * GET /api/v1/forensics/rayid-log
 *
 * Returns recent rows from anchor_audit_logs (EDGE_REQUEST events) for the
 * Forensic Dashboard.  Requires VAULTAUTH_TOKEN via x-vault-auth header.
 *
 * Query params:
 *   limit  — number of rows to return (default 500, max 5000)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_PASSPHRASE?: string;
}

export interface RayIdLogRow {
  id: number;
  ray_id: string;
  ip_address: string;
  path: string;
  asn: string;
  event_type: string;
  anchored_at: string;
  timestamp: string;
}

export async function GET(request: Request) {
  const token = request.headers.get('x-vault-auth') ?? '';

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const expected = cfEnv.VAULT_PASSPHRASE ?? '';
    if (!expected || token !== expected) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, 'VAULTAUTH_TOKEN required', 401);
    }

    if (!cfEnv.DB) {
      return d1ErrorResponse('D1 database binding unavailable');
    }

    const url    = new URL(request.url);
    const limit  = Math.min(5000, Math.max(1, Number(url.searchParams.get('limit') ?? '500')));

    const { results } = await cfEnv.DB
      .prepare(
        `SELECT
           id,
           COALESCE(ray_id, sha512, '')      AS ray_id,
           COALESCE(ip_address, pulse_hash, '') AS ip_address,
           COALESCE(path, '')                AS path,
           COALESCE(asn, '')                 AS asn,
           COALESCE(event_type, 'EDGE_REQUEST') AS event_type,
           anchored_at,
           COALESCE(timestamp, anchored_at)  AS timestamp
         FROM anchor_audit_logs
         WHERE event_type = 'EDGE_REQUEST' OR event_type IS NULL
         ORDER BY id DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<RayIdLogRow>();

    return Response.json({ rows: results ?? [], count: (results ?? []).length });
  } catch (err) {
    return d1ErrorResponse(err instanceof Error ? err.message : String(err));
  }
}
