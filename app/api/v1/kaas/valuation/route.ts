/**
 * GET /api/v1/kaas/valuation
 *
 * Phase 98 — KaaS Valuation Lookup
 *
 * Returns the outstanding KaaS debt for a given RayID or ASN by querying the
 * `kaas_valuations` table (created in migration 0037).  Used by the enterprise
 * licensing portal, Stripe reconciliation scripts, and internal forensic
 * dashboards.
 *
 * Query params:
 *   ?ray_id=<string>  — look up a single ingestion event by its RayID
 *   ?asn=<string>     — aggregate all PENDING valuations for an ASN
 *   ?status=<string>  — filter by settlement_status (default: PENDING)
 *
 * Auth: Bearer token matching VAULT_PASSPHRASE.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

// ── Cloudflare env interface ──────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:              D1Database;
  VAULT_PASSPHRASE?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aB = new TextEncoder().encode(a);
  const bB = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aB.length; i++) diff |= aB[i] ^ bB[i];
  return diff === 0;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";

  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  // Auth check
  const passphrase = cfEnv.VAULT_PASSPHRASE ?? "";
  const bearer     = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!passphrase || !safeEqual(bearer, passphrase)) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Unauthorized.");
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database binding (DB) is not configured.");
  }

  const url    = new URL(request.url);
  const rayId  = url.searchParams.get("ray_id")?.trim() ?? "";
  const asn    = url.searchParams.get("asn")?.trim()    ?? "";
  const status = (url.searchParams.get("status") ?? "PENDING").toUpperCase();

  const VALID_STATUSES = ["PENDING", "INVOICED", "SETTLED", "DISPUTED", "ALL"];
  if (!VALID_STATUSES.includes(status)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(", ")}.`,
    );
  }

  if (!rayId && !asn) {
    return aosErrorResponse(
      AOS_ERROR.MISSING_FIELD,
      "Either 'ray_id' or 'asn' query parameter is required.",
    );
  }

  try {
    if (rayId) {
      // Single record lookup by RayID
      const statusFilter = status === "ALL" ? "" : "AND settlement_status = ?";
      const sql = `
        SELECT id, ray_id, asn, org_name, tier, valuation_usd, fee_name,
               settlement_status, kernel_sha, path, created_at
        FROM   kaas_valuations
        WHERE  ray_id = ? ${statusFilter}
        LIMIT  1
      `;
      const row = status === "ALL"
        ? await cfEnv.DB.prepare(sql).bind(rayId).first<Record<string, unknown>>()
        : await cfEnv.DB.prepare(sql).bind(rayId, status).first<Record<string, unknown>>();

      if (!row) {
        return Response.json({
          status:           "NOT_FOUND",
          ray_id:           rayId,
          message:          "No KaaS valuation found for the specified RayID.",
          kernel_sha_short: KERNEL_SHA.slice(0, 16),
          kernel_version:   KERNEL_VERSION,
          timestamp:        formatIso9(),
        }, { status: 404 });
      }

      return Response.json({
        status:            "OK",
        lookup_type:       "ray_id",
        valuation:         row,
        kernel_sha_short:  KERNEL_SHA.slice(0, 16),
        kernel_version:    KERNEL_VERSION,
        timestamp:         formatIso9(),
      });
    }

    // ASN aggregate lookup
    const aggSql = `
      SELECT asn, org_name,
             COUNT(*)           AS record_count,
             SUM(valuation_usd) AS total_usd,
             MIN(tier)          AS min_tier,
             MAX(tier)          AS max_tier,
             MIN(created_at)    AS first_seen,
             MAX(created_at)    AS last_seen
      FROM   kaas_valuations
      WHERE  asn = ? ${status !== "ALL" ? "AND settlement_status = ?" : ""}
      GROUP BY asn, org_name
      LIMIT 1
    `;

    const detailSql = `
      SELECT id, ray_id, asn, org_name, tier, valuation_usd, fee_name,
             settlement_status, path, created_at
      FROM   kaas_valuations
      WHERE  asn = ? ${status !== "ALL" ? "AND settlement_status = ?" : ""}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const [aggRow, detailRows] = await Promise.all([
      status === "ALL"
        ? cfEnv.DB.prepare(aggSql).bind(asn).first<Record<string, unknown>>()
        : cfEnv.DB.prepare(aggSql).bind(asn, status).first<Record<string, unknown>>(),
      status === "ALL"
        ? cfEnv.DB.prepare(detailSql).bind(asn).all<Record<string, unknown>>()
        : cfEnv.DB.prepare(detailSql).bind(asn, status).all<Record<string, unknown>>(),
    ]);

    return Response.json({
      status:            "OK",
      lookup_type:       "asn",
      asn,
      filter_status:     status,
      summary:           aggRow ?? { asn, record_count: 0, total_usd: 0 },
      records:           detailRows.results,
      record_count:      detailRows.results.length,
      kernel_sha_short:  KERNEL_SHA.slice(0, 16),
      kernel_version:    KERNEL_VERSION,
      timestamp:         formatIso9(),
    });
  } catch (err: unknown) {
    return aosErrorResponse(
      AOS_ERROR.DB_QUERY_FAILED,
      err instanceof Error ? err.message : "KaaS valuation query failed",
    );
  }
}
