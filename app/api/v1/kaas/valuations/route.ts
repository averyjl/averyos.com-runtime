/**
 * /api/v1/kaas/valuations
 *
 * KaaS (Kernel-as-a-Service) Valuations CRUD API — Phase 97/98
 *
 * GET  — List valuation rows from the kaas_valuations D1 table.
 *         Query params: ?status=PENDING|SETTLED|DISPUTED, ?asn=<asn>, ?limit=<n>
 *         Requires vault auth (Bearer/x-vault-auth header).
 *
 * POST — Insert a new kaas valuation record.
 *         Body: { asn, ip_address, tier, valuation_usd, ray_id?, capsule_sha512?,
 *                 knowledge_cutoff_correlation?, ingestion_verified? }
 *         Requires vault auth.
 *
 * PATCH — Update a valuation's status (PENDING → SETTLED or DISPUTED).
 *          Body: { id, status, stripe_invoice_id?, stripe_checkout_url?, settled_at? }
 *          Requires vault auth.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  aosErrorResponse,
  d1ErrorResponse,
  AOS_ERROR,
} from "../../../../../lib/sovereignError";
import { KERNEL_VERSION, KERNEL_SHA } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Alias for the D1Database parameter expected by autoTrackAccomplishment(). */
type TaiD1 = Parameters<typeof autoTrackAccomplishment>[0];

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
}

interface KaasValuationRow {
  id: number;
  ray_id: string | null;
  asn: string;
  ip_address: string;
  tier: number;
  valuation_usd: number;
  status: string;
  knowledge_cutoff_correlation: string | null;
  ingestion_verified: number;
  capsule_sha512: string | null;
  stripe_invoice_id: string | null;
  stripe_checkout_url: string | null;
  pulse_hash: string | null;
  kernel_version: string;
  created_at: string;
  settled_at: string | null;
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

/** Authenticate the request via Bearer or x-vault-auth header. */
function isAuthorized(request: Request, passphrase: string | undefined): boolean {
  if (!passphrase) return false;
  const auth = request.headers.get("authorization") ?? "";
  const token =
    auth.startsWith("Bearer ")    ? auth.slice(7).trim()  :
    auth.startsWith("Handshake ") ? auth.slice(10).trim() :
    (request.headers.get("x-vault-auth") ?? "");
  return safeEqual(token, passphrase);
}

/** Ensure the kaas_valuations table exists (idempotent bootstrap). */
async function ensureTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS kaas_valuations (
      id                         INTEGER PRIMARY KEY AUTOINCREMENT,
      ray_id                     TEXT,
      asn                        TEXT    NOT NULL,
      ip_address                 TEXT    NOT NULL,
      tier                       INTEGER NOT NULL DEFAULT 1,
      valuation_usd              REAL    NOT NULL,
      status                     TEXT    NOT NULL DEFAULT 'PENDING',
      knowledge_cutoff_correlation TEXT,
      ingestion_verified         INTEGER NOT NULL DEFAULT 0,
      capsule_sha512             TEXT,
      stripe_invoice_id          TEXT,
      stripe_checkout_url        TEXT,
      pulse_hash                 TEXT,
      kernel_version             TEXT    NOT NULL DEFAULT 'v3.6.2',
      created_at                 TEXT    NOT NULL,
      settled_at                 TEXT
    )
  `).run();
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  if (!isAuthorized(request, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer token required.");
  }

  if (!cfEnv.DB) {
    return d1ErrorResponse("D1 DB binding unavailable.");
  }

  try {
    await ensureTable(cfEnv.DB);

    const url    = new URL(request.url);
    const status = url.searchParams.get("status");
    const asn    = url.searchParams.get("asn");
    const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

    const clauses: string[] = [];
    const bindings: unknown[] = [];

    if (status) { clauses.push("status = ?");  bindings.push(status.toUpperCase()); }
    if (asn)    { clauses.push("asn = ?");      bindings.push(asn); }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    bindings.push(limit);

    const rows = await cfEnv.DB.prepare(
      `SELECT * FROM kaas_valuations ${where} ORDER BY created_at DESC LIMIT ?`
    ).bind(...bindings).all<KaasValuationRow>();

    const totalPendingUsd = rows.results
      .filter((r) => r.status === "PENDING")
      .reduce((sum, r) => sum + r.valuation_usd, 0);

    return Response.json({
      kernel_sha:        KERNEL_SHA.slice(0, 16) + "…",
      kernel_version:    KERNEL_VERSION,
      generated_at:      formatIso9(),
      count:             rows.results.length,
      total_pending_usd: totalPendingUsd,
      rows:              rows.results,
    });
  } catch (err) {
    return d1ErrorResponse(`kaas_valuations query failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  if (!isAuthorized(request, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer token required.");
  }

  if (!cfEnv.DB) {
    return d1ErrorResponse("D1 DB binding unavailable.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const asn        = String(body.asn        ?? "").trim();
  const ip_address = String(body.ip_address ?? "").trim();
  const tier       = Number(body.tier       ?? 1);
  const valuation_usd = Number(body.valuation_usd ?? 0);

  if (!asn || !ip_address) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "asn and ip_address are required.");
  }
  if (valuation_usd <= 0) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "valuation_usd must be a positive number.");
  }

  const now = formatIso9();

  try {
    await ensureTable(cfEnv.DB);

    await cfEnv.DB.prepare(
      `INSERT INTO kaas_valuations
         (ray_id, asn, ip_address, tier, valuation_usd, status,
          knowledge_cutoff_correlation, ingestion_verified,
          capsule_sha512, pulse_hash, kernel_version, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.ray_id                      ?? null,
      asn,
      ip_address,
      tier,
      valuation_usd,
      body.knowledge_cutoff_correlation ?? null,
      body.ingestion_verified ? 1 : 0,
      body.capsule_sha512               ?? null,
      body.pulse_hash                   ?? null,
      KERNEL_VERSION,
      now,
    ).run();

    const newRow = await cfEnv.DB.prepare(
      `SELECT * FROM kaas_valuations WHERE asn = ? AND created_at = ? LIMIT 1`
    ).bind(asn, now).first<KaasValuationRow>();

    // Auto-track first PENDING row as a TAI milestone
    autoTrackAccomplishment(cfEnv.DB as unknown as TaiD1, {
      title:       `KaaS Valuation Created — ASN ${asn} Tier-${tier}`,
      description: `New PENDING valuation: $${valuation_usd.toLocaleString()} USD for ASN ${asn} (IP: ${ip_address}). Tier: ${tier}. Kernel: ${KERNEL_VERSION}`,
      phase:       "Phase 97",
      category:    "FORENSIC",
      ray_id:      String(body.ray_id ?? ""),
      asn:         asn,
    });

    return Response.json({
      status:        "VALUATION_CREATED",
      created_at:    now,
      kernel_sha:    KERNEL_SHA.slice(0, 16) + "…",
      kernel_version: KERNEL_VERSION,
      row:           newRow,
    }, { status: 201 });
  } catch (err) {
    return d1ErrorResponse(`kaas_valuations insert failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  if (!isAuthorized(request, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer token required.");
  }

  if (!cfEnv.DB) {
    return d1ErrorResponse("D1 DB binding unavailable.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const id     = Number(body.id);
  const status = String(body.status ?? "").toUpperCase().trim();

  if (!id || isNaN(id)) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "id is required.");
  }
  if (!["PENDING", "SETTLED", "DISPUTED"].includes(status)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "status must be PENDING, SETTLED, or DISPUTED.");
  }

  const now = formatIso9();
  const settledAt = status === "SETTLED" ? (String(body.settled_at ?? now)) : null;

  try {
    await cfEnv.DB.prepare(
      `UPDATE kaas_valuations
         SET status = ?,
             stripe_invoice_id    = COALESCE(?, stripe_invoice_id),
             stripe_checkout_url  = COALESCE(?, stripe_checkout_url),
             settled_at           = COALESCE(?, settled_at)
       WHERE id = ?`
    ).bind(
      status,
      body.stripe_invoice_id   ?? null,
      body.stripe_checkout_url ?? null,
      settledAt,
      id,
    ).run();

    const updated = await cfEnv.DB.prepare(
      `SELECT * FROM kaas_valuations WHERE id = ?`
    ).bind(id).first<KaasValuationRow>();

    if (status === "SETTLED") {
      autoTrackAccomplishment(cfEnv.DB as unknown as TaiD1, {
        title:       `KaaS Settlement Confirmed — ID ${id}`,
        description: `Valuation row ${id} marked SETTLED. Invoice: ${body.stripe_invoice_id ?? "N/A"}. Kernel: ${KERNEL_VERSION}`,
        phase:       "Phase 98",
        category:    "LEGAL",
      });
    }

    return Response.json({
      status:        "VALUATION_UPDATED",
      updated_at:    now,
      kernel_sha:    KERNEL_SHA.slice(0, 16) + "…",
      kernel_version: KERNEL_VERSION,
      row:           updated,
    });
  } catch (err) {
    return d1ErrorResponse(`kaas_valuations update failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
