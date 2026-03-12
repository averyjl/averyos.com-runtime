/**
 * GET /api/v1/qa/results
 *
 * AveryOS™ Sovereign QA Engine — Phase 112 / GATE 112.4
 *
 * Admin-authenticated endpoint that returns paginated QA run records
 * from the D1 qa_audit_log table, ordered by most-recent first.
 *
 * Auth: x-vault-auth header or aos-vault-auth HttpOnly cookie.
 *
 * Query parameters:
 *   limit  — number of results to return (default 20, max 100)
 *   status — filter by 'pass' | 'fail' | 'partial'
 *   after  — ISO timestamp for cursor-based pagination (created_at < after)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_VERSION, KERNEL_SHA } from "../../../../../lib/sovereignConstants";
import { VAULT_COOKIE_NAME } from "../../../../../lib/vaultCookieConfig";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface QaRunRow {
  id:             number;
  run_id:         string;
  trigger:        string;
  status:         string;
  total_tests:    number;
  passed_tests:   number;
  failed_tests:   number;
  sha512:         string;
  kernel_sha:     string;
  kernel_version: string;
  run_details:    string | null;
  created_at:     string;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function extractToken(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.split(";").map(c => c.trim())
    .find(c => c.startsWith(`${VAULT_COOKIE_NAME}=`));
  if (match) return decodeURIComponent(match.slice(VAULT_COOKIE_NAME.length + 1));
  return request.headers.get("x-vault-auth") ?? "";
}

function safeEqual(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  let diff = la ^ lb;
  for (let i = 0; i < Math.max(la, lb); i++) {
    diff |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return diff === 0 && la > 0;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Auth ──────────────────────────────────────────────────────────────────
    const token      = extractToken(request);
    const passphrase = cfEnv.VAULT_PASSPHRASE ?? "";

    if (!passphrase) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, "VAULT_PASSPHRASE not set");
    }
    if (!safeEqual(token, passphrase)) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Invalid vault auth token");
    }

    // ── DB availability ───────────────────────────────────────────────────────
    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "DB binding not found");
    }

    // ── Parse query params ────────────────────────────────────────────────────
    const url    = new URL(request.url);
    const limit  = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
    const status = url.searchParams.get("status") ?? null;
    const after  = url.searchParams.get("after") ?? null;

    // ── Build query ───────────────────────────────────────────────────────────
    const conditions: string[] = [];
    const bindings:   unknown[] = [];

    if (status && ["pass", "fail", "partial"].includes(status)) {
      conditions.push("status = ?");
      bindings.push(status);
    }
    if (after) {
      conditions.push("created_at < ?");
      bindings.push(after);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `SELECT * FROM qa_audit_log ${whereClause} ORDER BY created_at DESC LIMIT ?`;
    bindings.push(limit);

    const rows = await cfEnv.DB
      .prepare(query)
      .bind(...bindings)
      .all<QaRunRow>();

    const results = (rows.results ?? []).map((row) => ({
      id:             row.id,
      run_id:         row.run_id,
      trigger:        row.trigger,
      status:         row.status,
      total_tests:    row.total_tests,
      passed_tests:   row.passed_tests,
      failed_tests:   row.failed_tests,
      sha512:         row.sha512.slice(0, 16) + "…",  // truncated for overview
      kernel_version: row.kernel_version,
      created_at:     row.created_at,
    }));

    return Response.json({
      results,
      count:          results.length,
      kernel_sha:     KERNEL_SHA.slice(0, 16) + "…",
      kernel_version: KERNEL_VERSION,
      sovereign_anchor: "⛓️⚓⛓️",
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(msg, "qa_audit_log");
  }
}

export const runtime = undefined;
