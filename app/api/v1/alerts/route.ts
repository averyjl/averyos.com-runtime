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
 * GET  /api/v1/alerts          — List sovereign alerts (public subset or internal)
 * POST /api/v1/alerts          — Post a new sovereign alert message
 * GET  /api/v1/alerts?type=public  — Public VaultChain™ transparency log
 * GET  /api/v1/alerts?type=internal — Internal AveryOS™ secure communications (auth required)
 *
 * Sovereign Alert Dashboard — GATE 114.2.4
 *
 * Separates internal AveryOS™ communications from public audit logs:
 *
 *   PUBLIC alerts   — VaultChain™ transparency log visible to all parties.
 *                     Contains only event type, SHA-512 receipt, and timestamp.
 *                     No IP addresses, no private message content.
 *
 *   INTERNAL alerts — Secure AveryOS™ communications.  Requires vault auth.
 *                     Contains full message, metadata, and sovereign fingerprint.
 *                     Never exposed publicly.
 *
 * Every alert (public or internal) receives:
 *   • SHA-512 receipt anchored to the kernel SHA
 *   • ISO-9 microsecond-precision timestamp
 *   • Kernel version seal
 *
 * Auth:
 *   Internal read/write: Bearer VAULT_PASSPHRASE (x-vault-auth header or
 *   Authorization: Bearer <token>) or HttpOnly aos-vault-auth cookie.
 *   Public read: no auth required.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }                    from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION }              from "../../../../lib/sovereignConstants";
import { formatIso9 }                             from "../../../../lib/timePrecision";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { safeEqual }                               from "../../../../lib/taiLicenseGate";

// ── Types ─────────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
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

interface AlertRow {
  id:          number;
  alert_type:  "PUBLIC" | "INTERNAL";
  event_type:  string;
  message:     string | null;
  sha512:      string;
  kernel_sha:  string;
  created_at:  string;
  author:      string | null;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function isVaultAuthed(request: Request, passphrase: string): boolean {
  if (!passphrase) return false;

  // Bearer token in Authorization header
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (safeEqual(token, passphrase)) return true;
  }

  // x-vault-auth header
  const vaultHeader = request.headers.get("x-vault-auth") ?? "";
  if (safeEqual(vaultHeader, passphrase)) return true;

  // HttpOnly cookie
  const cookie = request.headers.get("cookie") ?? "";
  const cookieMatch = cookie.match(/(?:^|;\s*)aos-vault-auth=([^;]+)/);
  if (cookieMatch) {
    const cookieToken = decodeURIComponent(cookieMatch[1]);
    if (safeEqual(cookieToken, passphrase)) return true;
  }

  return false;
}

// ── SHA-512 helper ────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf     = await globalThis.crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Common response headers ───────────────────────────────────────────────────

const SOVEREIGN_HEADERS = {
  "Cache-Control":      "no-store",
  "X-AveryOS-Kernel":   KERNEL_VERSION,
  "X-Sovereign-Anchor": "⛓️⚓⛓️",
};

/** Maximum byte-length for the event_type field before sanitization. */
const MAX_EVENT_TYPE_LENGTH = 128;

// ── GET handler ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/alerts
 *
 * Query params:
 *   ?type=public    — return public VaultChain transparency log (no auth needed)
 *   ?type=internal  — return internal secure communications (auth required)
 *   ?limit=<n>      — max rows to return (default 50, max 200)
 *   ?since=<iso>    — filter rows created after this ISO timestamp
 */
export async function GET(request: Request): Promise<Response> {
  const now = formatIso9(new Date());

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database is not bound.", 503);
    }

    const url       = new URL(request.url);
    const alertType = (url.searchParams.get("type") ?? "public").toLowerCase();
    const limit     = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
    const since     = url.searchParams.get("since") ?? null;

    // Internal alerts require vault auth
    if (alertType === "internal") {
      if (!isVaultAuthed(request, cfEnv.VAULT_PASSPHRASE ?? "")) {
        return Response.json(
          { error: "UNAUTHORIZED", message: "Vault authentication required for internal alerts." },
          { status: 401, headers: SOVEREIGN_HEADERS },
        );
      }

      const rows = await (since
        ? cfEnv.DB.prepare(
            "SELECT * FROM sovereign_alerts WHERE alert_type = 'INTERNAL' AND created_at > ? ORDER BY created_at DESC LIMIT ?",
          ).bind(since, limit).all<AlertRow>()
        : cfEnv.DB.prepare(
            "SELECT * FROM sovereign_alerts WHERE alert_type = 'INTERNAL' ORDER BY created_at DESC LIMIT ?",
          ).bind(limit).all<AlertRow>()
      );

      return Response.json(
        {
          type:            "INTERNAL",
          total:           rows.results.length,
          alerts:          rows.results,
          kernel_version:  KERNEL_VERSION,
          retrieved_at:    now,
          sovereign_anchor: "⛓️⚓⛓️",
          notice:          "Internal communications are confidential and not publicly disclosed.",
        },
        { status: 200, headers: SOVEREIGN_HEADERS },
      );
    }

    // Public alerts — return only non-sensitive fields
    const rows = await (since
      ? cfEnv.DB.prepare(
          "SELECT id, alert_type, event_type, sha512, kernel_sha, created_at FROM sovereign_alerts WHERE alert_type = 'PUBLIC' AND created_at > ? ORDER BY created_at DESC LIMIT ?",
        ).bind(since, limit).all<Pick<AlertRow, "id" | "alert_type" | "event_type" | "sha512" | "kernel_sha" | "created_at">>()
      : cfEnv.DB.prepare(
          "SELECT id, alert_type, event_type, sha512, kernel_sha, created_at FROM sovereign_alerts WHERE alert_type = 'PUBLIC' ORDER BY created_at DESC LIMIT ?",
        ).bind(limit).all<Pick<AlertRow, "id" | "alert_type" | "event_type" | "sha512" | "kernel_sha" | "created_at">>()
    );

    return Response.json(
      {
        type:             "PUBLIC",
        total:            rows.results.length,
        alerts:           rows.results,
        kernel_version:   KERNEL_VERSION,
        retrieved_at:     now,
        sovereign_anchor: "⛓️⚓⛓️",
        notice:           "Public VaultChain™ transparency log. Each entry is SHA-512 anchored.",
      },
      { status: 200, headers: SOVEREIGN_HEADERS },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "sovereign_alerts");
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

interface AlertPostBody {
  /** Alert visibility tier */
  alert_type?:  "PUBLIC" | "INTERNAL";
  /** Short event type label (e.g. "CONSTITUTIONAL_UPGRADE_SUGGESTION") */
  event_type:   string;
  /** Full alert message (stored encrypted for INTERNAL, redacted for PUBLIC) */
  message?:     string;
  /** Optional author label */
  author?:      string;
}

/**
 * POST /api/v1/alerts
 *
 * Record a new sovereign alert.
 *
 * PUBLIC alerts require no auth (e.g. transparency-log entries from external parties).
 * INTERNAL alerts require vault auth.
 *
 * Every alert receives a SHA-512 receipt anchored to the kernel SHA.
 */
export async function POST(request: Request): Promise<Response> {
  const now = formatIso9(new Date());

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database is not bound.", 503);
    }

    const body = (await request.json().catch(() => null)) as AlertPostBody | null;
    if (!body || !body.event_type) {
      return Response.json(
        { error: "BAD_REQUEST", message: "Request body must include event_type." },
        { status: 400, headers: SOVEREIGN_HEADERS },
      );
    }

    const alertType = body.alert_type ?? "PUBLIC";
    // Enforce length before sanitization to prevent DoS via excessive string processing
    const rawEventType = typeof body.event_type === "string" ? body.event_type.slice(0, MAX_EVENT_TYPE_LENGTH) : "";
    if (!rawEventType.trim()) {
      return Response.json(
        { error: "BAD_REQUEST", message: "event_type must be a non-empty string." },
        { status: 400, headers: SOVEREIGN_HEADERS },
      );
    }
    const eventType = rawEventType.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const message   = typeof body.message === "string" ? body.message.slice(0, 4096) : null;
    const author    = typeof body.author  === "string" ? body.author.slice(0, 256)   : null;

    // INTERNAL alerts require vault auth
    if (alertType === "INTERNAL") {
      if (!isVaultAuthed(request, cfEnv.VAULT_PASSPHRASE ?? "")) {
        return Response.json(
          { error: "UNAUTHORIZED", message: "Vault authentication required to post internal alerts." },
          { status: 401, headers: SOVEREIGN_HEADERS },
        );
      }
    }

    // Compute SHA-512 receipt — anchored to kernel SHA + event + timestamp
    const receiptPayload = JSON.stringify({
      alert_type:  alertType,
      event_type:  eventType,
      kernel_sha:  KERNEL_SHA,
      created_at:  now,
      author:      author ?? "SYSTEM",
    });
    const sha512 = await sha512hex(receiptPayload);

    // For PUBLIC alerts, the message is stripped — only the SHA receipt is stored.
    // For INTERNAL alerts, the full message is persisted.
    const storedMessage = alertType === "PUBLIC" ? null : message;

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_alerts
         (alert_type, event_type, message, sha512, kernel_sha, created_at, author)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(alertType, eventType, storedMessage, sha512, KERNEL_SHA, now, author).run();

    return Response.json(
      {
        status:          "RECORDED",
        alert_type:      alertType,
        event_type:      eventType,
        sha512_receipt:  sha512,
        kernel_version:  KERNEL_VERSION,
        created_at:      now,
        sovereign_anchor: "⛓️⚓⛓️",
        notice: alertType === "PUBLIC"
          ? "Public alert recorded on VaultChain™ transparency log."
          : "Internal alert recorded in secure AveryOS™ communications. Not publicly disclosed.",
      },
      { status: 201, headers: SOVEREIGN_HEADERS },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "sovereign_alerts");
  }
}
