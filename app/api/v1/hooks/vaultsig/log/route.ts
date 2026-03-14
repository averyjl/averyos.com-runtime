/**
 * GET /api/v1/hooks/vaultsig/log
 *
 * VaultSig™ Webhook Activity Log — AveryOS™ Phase 114.8 / GATE 114.8.1
 *
 * Returns the most recent VaultSig™ GitHub App webhook events from the D1
 * `vaultsig_webhook_log` table, for display in the private health dashboard.
 *
 * Security:
 *   • Requires valid VaultAuth cookie (VAULT_PASSPHRASE).
 *   • Returns at most `limit` rows (default 10, max 50).
 *   • Never exposes raw payload bodies — only event_type, action, sender,
 *     delivery_id prefix, and timestamp.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../../lib/sovereignError";
import { KERNEL_VERSION }              from "../../../../../../lib/sovereignConstants";
import { formatIso9 }                  from "../../../../../../lib/timePrecision";
import { VAULT_COOKIE_NAME }           from "../../../../../../lib/vaultCookieConfig";
import { safeEqual }                   from "../../../../../../lib/taiLicenseGate";

// ── D1 types ──────────────────────────────────────────────────────────────────

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1Statement;
}

interface CloudflareEnv {
  DB?:              D1Database;
  VAULT_PASSPHRASE?: string;
}

export interface VaultSigLogEntry {
  id:          number;
  delivery_id: string;
  event_type:  string;
  action:      string | null;
  sender:      string | null;
  logged_at:   string;
  kernel:      string;
}

// ── Cookie parsing helper ─────────────────────────────────────────────────────

function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey?.trim() === name) return rest.join("=").trim() || null;
  }
  return null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    const { env }  = await getCloudflareContext({ async: true });
    const cfEnv    = env as unknown as CloudflareEnv;

    // ── Auth check (same pattern as /api/v1/vault/auth-check) ─────────────
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookieValue  = parseCookie(cookieHeader, VAULT_COOKIE_NAME);
    const expected     = (cfEnv.VAULT_PASSPHRASE ?? "").trim();

    if (!cookieValue || !expected || !safeEqual(decodeURIComponent(cookieValue), expected)) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid VaultAuth required to access webhook log.", 401);
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
    const limit    = Math.min(Math.max(rawLimit, 1), 50);

    if (!cfEnv.DB) {
      return Response.json({
        entries:        [],
        total:          0,
        kernel_version: KERNEL_VERSION,
        queried_at:     formatIso9(),
        note:           "D1 binding unavailable — vaultsig_webhook_log unreadable.",
      });
    }

    // Ensure the table exists before querying — gracefully returns empty set if absent
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vaultsig_webhook_log (
         id          INTEGER PRIMARY KEY AUTOINCREMENT,
         delivery_id TEXT    NOT NULL,
         event_type  TEXT    NOT NULL,
         action      TEXT,
         sender      TEXT,
         logged_at   TEXT    NOT NULL,
         kernel      TEXT    NOT NULL
       )`
    ).all();

    const rows = await cfEnv.DB
      .prepare(
        `SELECT id, delivery_id, event_type, action, sender, logged_at, kernel
           FROM vaultsig_webhook_log
          ORDER BY id DESC
          LIMIT ?`,
      )
      .bind(limit)
      .all<VaultSigLogEntry>();

    return Response.json({
      entries:        rows.results,
      total:          rows.results.length,
      kernel_version: KERNEL_VERSION,
      queried_at:     formatIso9(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
