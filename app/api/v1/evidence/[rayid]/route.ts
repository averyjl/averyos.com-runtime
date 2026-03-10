/**
 * GET /api/v1/evidence/[rayid]
 *
 * Phase 82 — AveryOS™ VaultChain™ Forensic Evidence Explorer API
 *
 * Looks up the R2 evidence artifact for a given RayID or SHA-512 payload hash.
 * The artifact was written by `logRayIdAudit()` in middleware.ts as:
 *   evidence/${sha512_payload}.json
 *
 * If the input is a RayID (not a full SHA-512 hex), the route queries
 * anchor_audit_logs to resolve the sha512_payload first.
 *
 * Auth: x-vault-auth header or HttpOnly vault-auth cookie matching VAULT_PASSPHRASE.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { VAULT_COOKIE_NAME } from "../../../../../lib/vaultCookieConfig";

// ── Cloudflare env interfaces ─────────────────────────────────────────────────

interface R2ObjectBody {
  text(): Promise<string>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:               D1Database;
  VAULT_R2?:         R2Bucket;
  VAULT_PASSPHRASE?: string;
}

interface AnchorLogRow {
  sha512_payload: string;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function extractToken(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch  = cookieHeader
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(`${VAULT_COOKIE_NAME}=`));
  if (cookieMatch) {
    return decodeURIComponent(cookieMatch.slice(VAULT_COOKIE_NAME.length + 1));
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return request.headers.get("x-vault-auth") ?? "";
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ rayid: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { rayid } = await params;

  // Basic sanity check — RayID or SHA-512 hex, 10–128 chars
  if (!rayid || !/^[a-fA-F0-9\-]{10,128}$/.test(rayid)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Invalid field value", 400);
  }

  const token = extractToken(request);

  let cfEnv: CloudflareEnv;
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "Cloudflare binding unavailable", 503);
  }

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Invalid or missing auth token", 401);
  }

  if (!cfEnv.VAULT_R2) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "Cloudflare binding unavailable", 503);
  }

  // ── Resolve sha512_payload ────────────────────────────────────────────────
  // If the input is already a 128-char hex string, it is the sha512_payload.
  // Otherwise, treat it as a RayID and look up the sha512_payload from D1.
  let sha512Payload = rayid;

  if (!/^[a-f0-9]{128}$/.test(rayid) && cfEnv.DB) {
    const row = await cfEnv.DB.prepare(
      `SELECT sha512_payload FROM anchor_audit_logs WHERE ray_id = ? ORDER BY id DESC LIMIT 1`,
    )
      .bind(rayid)
      .first<AnchorLogRow>();

    if (!row?.sha512_payload) {
      return Response.json(
        { error: "NOT_FOUND", detail: "No evidence artifact found for this RayID", kernel_sha: KERNEL_SHA },
        { status: 404 },
      );
    }
    sha512Payload = row.sha512_payload;
  }

  // ── Fetch from R2 ─────────────────────────────────────────────────────────
  const r2Key = `evidence/${sha512Payload}.json`;
  const obj   = await cfEnv.VAULT_R2.get(r2Key);

  if (!obj) {
    return Response.json(
      { error: "NOT_FOUND", detail: "Evidence artifact not in R2 vault", r2_key: r2Key, kernel_sha: KERNEL_SHA },
      { status: 404 },
    );
  }

  const text = await obj.text();
  let evidence: Record<string, unknown>;
  try {
    evidence = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, "Internal server error", 500);
  }

  return Response.json({
    ...evidence,
    r2_key:    r2Key,
    kernel_sha: KERNEL_SHA,
    fetched_at: new Date().toISOString(),
  });
}
