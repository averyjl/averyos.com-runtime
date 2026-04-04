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
 * GET /api/v1/tai/accomplishments
 *
 * Returns TAI™ Accomplishments from the tai_accomplishments D1 table.
 * Requires VAULTAUTH_TOKEN via HttpOnly cookie (aos-vault-auth) or
 * x-vault-auth header for write operations.
 *
 * GET  — public summary (title, phase, category, accomplished_at only)
 *         Add ?full=1 + valid vault auth to retrieve full rows including sha512.
 *
 * POST — create a new accomplishment capsule (vault auth required).
 *   Body: { title, description?, phase?, category?, bundle_id?, ray_id?, asn? }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_VERSION, KERNEL_SHA } from "../../../../../lib/sovereignConstants";
import { VAULT_COOKIE_NAME } from "../../../../../lib/vaultCookieConfig";
import { formatIso9 } from "../../../../../lib/timePrecision";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_PASSPHRASE?: string;
}

export interface TaiAccomplishment {
  id: number;
  title: string;
  description: string | null;
  phase: string;
  category: string;
  sha512: string;
  accomplished_at: string;
  recorded_by: string;
  bundle_id: string | null;
  ray_id: string | null;
  asn: string | null;
  btc_block_height: number | null;
  kernel_version: string;
  status: string;
  created_at: string;
}

// Valid categories for accomplishments
const VALID_CATEGORIES = new Set([
  "MILESTONE", "CAPSULE", "LEGAL", "INFRASTRUCTURE",
  "FORENSIC", "SOVEREIGN", "FEDERAL",
]);

/** Extract vault auth token from cookie or fallback header. */
function extractToken(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.split(";").map(c => c.trim())
    .find(c => c.startsWith(`${VAULT_COOKIE_NAME}=`));
  if (match) return decodeURIComponent(match.slice(VAULT_COOKIE_NAME.length + 1));
  return request.headers.get("x-vault-auth") ?? "";
}

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify vault auth token against VAULT_PASSPHRASE env. */
function isAuthorized(token: string, passphrase: string): boolean {
  return token.length > 0 && safeEqual(token, passphrase);
}

/**
 * Compute a deterministic SHA-512 fingerprint for a new accomplishment.
 * Uses the Web Crypto API available in Cloudflare Workers.
 */
async function computeSha512(title: string, description: string, accomplishedAt: string): Promise<string> {
  const raw = `${title}||${description}||${accomplishedAt}||${KERNEL_SHA}`;
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── GET /api/v1/tai/accomplishments ──────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;
    const db = cfEnv.DB;

    if (!db) return d1ErrorResponse("tai_accomplishments", "DB binding not available");

    const url = new URL(request.url);
    const fullView = url.searchParams.get("full") === "1";
    const category = url.searchParams.get("category") ?? "";
    const phase = url.searchParams.get("phase") ?? "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

    // Full view requires vault auth
    if (fullView) {
      const passphrase = cfEnv.VAULT_PASSPHRASE ?? "";
      if (!passphrase || !isAuthorized(extractToken(request), passphrase)) {
        return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Vault authentication required for full accomplishment view.");
      }
    }

    let query: string;
    const bindings: unknown[] = [];

    if (fullView) {
      query = "SELECT * FROM tai_accomplishments WHERE status = 'ACTIVE'";
    } else {
      query = "SELECT id, title, phase, category, accomplished_at, recorded_by, kernel_version FROM tai_accomplishments WHERE status = 'ACTIVE'";
    }

    if (category && VALID_CATEGORIES.has(category.toUpperCase())) {
      query += " AND category = ?";
      bindings.push(category.toUpperCase());
    }
    if (phase) {
      query += " AND phase = ?";
      bindings.push(phase);
    }

    query += " ORDER BY accomplished_at DESC LIMIT ?";
    bindings.push(limit);

    const stmt = db.prepare(query);
    const bound = bindings.reduce<D1PreparedStatement>((s, b) => s.bind(b), stmt);
    const { results } = await bound.all<TaiAccomplishment>();

    return Response.json({
      accomplishments: results,
      total: results.length,
      phase_current: "Phase 78",
      milestone: "162.2k Pulse | 987 Watchers | HN Handshake Detected | DER Gateway Active",
      kernel_version: KERNEL_VERSION,
      timestamp: formatIso9(new Date()),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse("tai_accomplishments", message);
  }
}

// ── POST /api/v1/tai/accomplishments ─────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Require vault auth for all writes
    const passphrase = cfEnv.VAULT_PASSPHRASE ?? "";
    if (!passphrase || !isAuthorized(extractToken(request), passphrase)) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Vault authentication required to record accomplishments.");
    }

    const db = cfEnv.DB;
    if (!db) return d1ErrorResponse("tai_accomplishments", "DB binding not available");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
    }

    if (typeof body !== "object" || body === null) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Request body must be a JSON object.");
    }

    const {
      title, description, phase, category,
      bundle_id, ray_id, asn, btc_block_height, accomplished_at,
    } = body as Record<string, unknown>;

    if (typeof title !== "string" || !title.trim()) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "title is required.");
    }

    const resolvedTitle = title.trim().slice(0, 500);
    const resolvedDesc = typeof description === "string" ? description.trim().slice(0, 2000) : "";
    const resolvedPhase = typeof phase === "string" && phase.trim() ? phase.trim() : "Phase 73";
    const resolvedCategory = typeof category === "string" && VALID_CATEGORIES.has(category.toUpperCase())
      ? category.toUpperCase()
      : "MILESTONE";
    const resolvedAt = typeof accomplished_at === "string" && accomplished_at.trim()
      ? accomplished_at.trim()
      : formatIso9(new Date());

    const sha512 = await computeSha512(resolvedTitle, resolvedDesc, resolvedAt);

    const result = await db.prepare(
      `INSERT INTO tai_accomplishments
         (title, description, phase, category, sha512, accomplished_at, recorded_by,
          bundle_id, ray_id, asn, btc_block_height, kernel_version)
       VALUES (?, ?, ?, ?, ?, ?, 'SOVEREIGN_ADMIN', ?, ?, ?, ?, ?)`
    )
      .bind(
        resolvedTitle,
        resolvedDesc || null,
        resolvedPhase,
        resolvedCategory,
        sha512,
        resolvedAt,
        typeof bundle_id === "string" ? bundle_id.slice(0, 500) : null,
        typeof ray_id === "string" ? ray_id.slice(0, 200) : null,
        typeof asn === "string" ? asn.slice(0, 50) : null,
        typeof btc_block_height === "number" ? btc_block_height : null,
        KERNEL_VERSION,
      )
      .run();

    if (!result.success) {
      return d1ErrorResponse("tai_accomplishments", "INSERT failed");
    }

    return Response.json(
      {
        success: true,
        id: result.meta?.last_row_id,
        title: resolvedTitle,
        phase: resolvedPhase,
        category: resolvedCategory,
        sha512,
        accomplished_at: resolvedAt,
        kernel_version: KERNEL_VERSION,
        message: "TAI™ Accomplishment recorded and sealed. ⛓️⚓⛓️",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse("tai_accomplishments", message);
  }
}
