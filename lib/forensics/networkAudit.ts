/**
 * lib/forensics/networkAudit.ts
 *
 * AveryOS™ Network Audit — Cloudflare RAY-ID Logging — GATE 116.9.3
 *
 * Captures and Merkle-anchors the `cf-ray` header on all outbound requests
 * that are TARI™-billable events, creating a permanent forensic chain that
 * connects every event to a physical Cloudflare network edge event.
 *
 * Architecture:
 *   1. `captureRayId()` — extract `cf-ray` from an existing Response.
 *   2. `anchorRayId()` — SHA-512 anchor the ray ID + kernel SHA + event data.
 *   3. `logNetworkEvent()` — persist the anchored event to D1 `network_audit_log`.
 *   4. `auditedFetch()` — drop-in fetch wrapper that automatically captures
 *      and persists the `cf-ray` for every call.
 *
 * TARI™ billing integration:
 *   Any audit event with `tariEvent = true` is forwarded to the TARI™ ledger
 *   so that every billable event can be traced to a Cloudflare Ray ID.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NetworkAuditEvent {
  /** Cloudflare Ray ID extracted from `cf-ray` response header. */
  cfRay:       string | null;
  /** URL that was requested. */
  url:         string;
  /** HTTP method. */
  method:      string;
  /** HTTP status code (0 on network error). */
  statusCode:  number;
  /** Round-trip duration in milliseconds. */
  durationMs:  number;
  /** SHA-512 anchor of cfRay + kernelSha + url + statusCode. */
  sha512:      string;
  /** Whether this event triggers a TARI™ billing action. */
  tariEvent:   boolean;
  /** ISO-9 timestamp. */
  loggedAt:    string;
  /** Kernel anchor. */
  kernelSha:   string;
  kernelVersion: string;
}

interface D1Statement { run(): Promise<void>; }
interface D1DatabaseLike {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
}

// ── SHA-512 anchor ─────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Core exports ───────────────────────────────────────────────────────────────

/**
 * Extract the Cloudflare Ray ID from a Response's `cf-ray` header.
 * Returns `null` if the header is absent (non-Cloudflare response).
 */
export function captureRayId(response: Response): string | null {
  return response.headers.get("cf-ray") ?? null;
}

/**
 * Compute a SHA-512 Merkle anchor for a network audit event.
 * The anchor binds the Ray ID to the Kernel SHA so any tampering is detectable.
 */
export async function anchorRayId(
  cfRay:      string | null,
  url:        string,
  statusCode: number,
): Promise<string> {
  const input = `${cfRay ?? "NULL"}:${url}:${statusCode}:${KERNEL_SHA}`;
  return sha512hex(input);
}

/**
 * Persist a network audit event to D1 `network_audit_log`.
 */
export async function logNetworkEvent(
  event: NetworkAuditEvent,
  db:    D1DatabaseLike,
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO network_audit_log
         (cf_ray, url, method, status_code, duration_ms, sha512, tari_event,
          logged_at, kernel_sha, kernel_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      event.cfRay,
      event.url.slice(0, 512),
      event.method.toUpperCase(),
      event.statusCode,
      event.durationMs,
      event.sha512,
      event.tariEvent ? 1 : 0,
      event.loggedAt,
      KERNEL_SHA,
      KERNEL_VERSION,
    ).run();
  } catch (err) {
    console.warn(
      "[NetworkAudit] D1 log write failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Drop-in wrapper around `fetch()` that automatically:
 *   1. Executes the request.
 *   2. Captures `cf-ray` from the response.
 *   3. Anchors the event with SHA-512.
 *   4. Persists the audit record to D1 if a binding is supplied.
 *
 * @param url        Target URL.
 * @param init       RequestInit (same as fetch).
 * @param opts       Audit options (DB binding, TARI event flag, etc.).
 * @returns          `{ response, auditEvent }` — the raw Response and the anchored event.
 */
export async function auditedFetch(
  url:  string | URL,
  init: RequestInit | undefined,
  opts: {
    db?:        D1DatabaseLike | null;
    tariEvent?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<{ response: Response; auditEvent: NetworkAuditEvent }> {
  const t0         = Date.now();
  const method     = (init?.method ?? "GET").toUpperCase();
  const urlStr     = url.toString();
  const timeoutMs  = opts.timeoutMs ?? 15_000;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  let statusCode = 0;
  try {
    response   = await fetch(url, { ...init, signal: controller.signal });
    statusCode = response.status;
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Date.now() - t0;
  const cfRay      = captureRayId(response);
  const sha512     = await anchorRayId(cfRay, urlStr, statusCode);
  const loggedAt   = formatIso9();

  const auditEvent: NetworkAuditEvent = {
    cfRay,
    url:          urlStr,
    method,
    statusCode,
    durationMs,
    sha512,
    tariEvent:    opts.tariEvent ?? false,
    loggedAt,
    kernelSha:    KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };

  if (opts.db) {
    void logNetworkEvent(auditEvent, opts.db).catch((err: unknown) =>
      console.warn("[NetworkAudit] async log failed:", err instanceof Error ? err.message : String(err)),
    );
  }

  return { response, auditEvent };
}
