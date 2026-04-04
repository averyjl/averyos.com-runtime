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
 * GET /api/v1/kaas-valuations
 *
 * KaaS™ Live Valuation Ledger API — Phase 97
 *
 * Returns live KaaS™ sovereign debt from the `kaas_valuations` D1 table.
 * Used by the TARI™ Revenue Dashboard to show pending obligations alongside
 * the existing TARI™ liability totals.
 *
 * Query parameters:
 *   ?status=PENDING|INVOICED|SETTLED|DISPUTED  — filter by settlement_status (default: all)
 *   ?limit=<N>     — max rows returned (default: 20, max: 100)
 *   ?tier=<N>      — filter to a specific KaaS tier (e.g., 9, 10)
 *
 * Response:
 *   {
 *     rows:              KaasValuationRow[]
 *     total_pending_usd: number
 *     row_count:         number
 *     timestamp:         string
 *     kernel_sha:        string
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA } from "../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { formatIso9 } from "../../../../lib/timePrecision";

// ── Types ──────────────────────────────────────────────────────────────────────
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
}

interface KaasValuationRow {
  id: number;
  asn: string;
  org_name: string | null;
  tier: number;
  valuation_usd: number;
  fee_name: string;
  settlement_status: string;
  path: string | null;
  created_at: string;
}

interface CountRow {
  total: number;
  pending_usd: number;
}

const VALID_SETTLEMENT_STATUSES = new Set(["PENDING", "INVOICED", "SETTLED", "DISPUTED"]);

// ── Route Handler ──────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    if (!cfEnv.DB) {
      return aosErrorResponse(
        AOS_ERROR.BINDING_MISSING,
        "DB binding not found. Ensure [[d1_databases]] is configured in wrangler.toml.",
      );
    }

    const url    = new URL(request.url);
    const status = url.searchParams.get("status")?.toUpperCase() ?? null;
    const tier   = url.searchParams.get("tier") ? parseInt(url.searchParams.get("tier")!, 10) : null;
    const limit  = Math.min(
      parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
      100,
    );

    // Build WHERE clause dynamically
    const conditions: string[] = [];
    const bindings: unknown[]  = [];

    if (status && VALID_SETTLEMENT_STATUSES.has(status)) {
      conditions.push("settlement_status = ?");
      bindings.push(status);
    }
    if (tier !== null && !isNaN(tier)) {
      conditions.push("tier = ?");
      bindings.push(tier);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Fetch rows
    const rows = await cfEnv.DB
      .prepare(
        `SELECT id, asn, org_name, tier, valuation_usd, fee_name, settlement_status, path, created_at
         FROM kaas_valuations
         ${where}
         ORDER BY tier DESC, valuation_usd DESC, created_at DESC
         LIMIT ?`,
      )
      .bind(...bindings, limit)
      .all<KaasValuationRow>();

    // Aggregate totals
    const totals = await cfEnv.DB
      .prepare(
        `SELECT COUNT(*) as total, COALESCE(SUM(valuation_usd), 0) as pending_usd
         FROM kaas_valuations
         WHERE settlement_status = 'PENDING'`,
      )
      .first<CountRow>();

    return Response.json({
      rows:              rows.results,
      total_pending_usd: totals?.pending_usd ?? 0,
      row_count:         totals?.total ?? 0,
      timestamp:         formatIso9(),
      kernel_sha:        KERNEL_SHA.slice(0, 16) + "…",
    }, {
      headers: {
        "X-AveryOS-Kernel-SHA": KERNEL_SHA.slice(0, 16) + "…",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "kaas-valuations query");
  }
}
