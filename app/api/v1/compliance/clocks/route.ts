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
 * GET /api/v1/compliance/clocks
 *
 * Compliance Clocks List API — AveryOS™ Phase 107 / Gate 1
 *
 * Returns a paginated list of compliance_clocks rows filtered by optional
 * query parameters. Used by the TARI™ Revenue Dashboard to detect the first
 * SETTLED clock and render a genesis celebration banner.
 *
 * Query parameters:
 *   status  — optional: ACTIVE | ESCALATED | SETTLED | EXPIRED
 *   limit   — optional: max rows to return (default: 20, max: 100)
 *   offset  — optional: pagination offset (default: 0)
 *   entity_id — optional: filter to a specific entity (ASN / IP / org)
 *
 * Auth: Bearer VAULT_PASSPHRASE
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

// ── Types ─────────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:               D1Database;
  VAULT_PASSPHRASE?: string;
}

interface ComplianceClockRow {
  id:               number;
  clock_id:         string;
  entity_id:        string | null;
  asn:              string | null;
  org_name:         string | null;
  status:           string;
  issued_at:        string;
  deadline_at:      string;
  settled_at:       string | null;
  escalated_at:     string | null;
  source_endpoint:  string | null;
  debt_cents:       number | null;
  stripe_session_id: string | null;
  kernel_sha:       string;
  created_at:       string;
}

const VALID_STATUSES = new Set(["ACTIVE", "ESCALATED", "SETTLED", "EXPIRED"]);

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization") ?? "";
    const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const passphrase = cfEnv.VAULT_PASSPHRASE ?? "";

    if (!passphrase || token !== passphrase) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH, "Bearer VAULT_PASSPHRASE required.");
    }

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 DB binding not available.");
    }

    // ── Query parameters ─────────────────────────────────────────────────────
    const url       = new URL(request.url);
    const rawStatus = url.searchParams.get("status")?.toUpperCase() ?? "";
    const status    = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : null;
    const limit     = Math.min(
      parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
      100,
    );
    const offset    = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;
    const entityId  = url.searchParams.get("entity_id") ?? null;

    // ── Query ─────────────────────────────────────────────────────────────────
    let sql    = "SELECT * FROM compliance_clocks WHERE 1=1";
    const args: unknown[] = [];

    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }
    if (entityId) {
      sql += " AND entity_id = ?";
      args.push(entityId);
    }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    const { results } = await cfEnv.DB.prepare(sql)
      .bind(...(args as Parameters<D1PreparedStatement["bind"]>))
      .all<ComplianceClockRow>();

    // ── Count total ───────────────────────────────────────────────────────────
    let countSql    = "SELECT COUNT(*) as total FROM compliance_clocks WHERE 1=1";
    const countArgs: unknown[] = [];
    if (status) {
      countSql += " AND status = ?";
      countArgs.push(status);
    }
    if (entityId) {
      countSql += " AND entity_id = ?";
      countArgs.push(entityId);
    }

    const countRow = await cfEnv.DB.prepare(countSql)
      .bind(...(countArgs as Parameters<D1PreparedStatement["bind"]>))
      .first<{ total: number }>();

    return Response.json(
      {
        ok: true,
        clocks:      results,
        total:       countRow?.total ?? 0,
        limit,
        offset,
        filter:      { status: status ?? "ALL", entity_id: entityId ?? null },
        kernel_sha:  KERNEL_SHA,
        kernel_version: KERNEL_VERSION,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
