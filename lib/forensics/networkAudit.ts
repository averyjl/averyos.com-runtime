/**
 * lib/forensics/networkAudit.ts
 *
 * AveryOS™ Cloudflare RAY-ID Forensic Anchor — GATE 116.9.3
 *
 * Captures `cf-ray` headers from all outbound requests and Merkle-anchors
 * them to the VaultChain™ ledger, ensuring every TARI-billable event is
 * traceable to a physical Cloudflare network event.
 *
 * A DriftViolationAlert is triggered if the cf-ray is absent (indicating
 * a non-Cloudflare origin) or if the Ray ID has already been recorded
 * (indicating replay).
 *
 * Integration:
 *   • Wraps fetch() in the audit-alert route and evidence routes.
 *   • Used by lib/security/rtvCore.ts to record RTV results.
 *   • Used by lib/recovery/recoverySteps.ts Step 18 forensic handshake.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NetworkAuditRecord {
  /** Cloudflare Ray ID (cf-ray header).  Null if not a Cloudflare-proxied req. */
  cf_ray:          string | null;
  /** Request URL (origin only, no query params for privacy). */
  url_origin:      string;
  /** HTTP method. */
  method:          string;
  /** HTTP status code of the response. */
  status:          number;
  /** Round-trip delta in milliseconds. */
  delta_ms:        number;
  /** ISO-9 timestamp of the request. */
  requested_at:    string;
  /** ISO-9 timestamp of the response. */
  responded_at:    string;
  /** Whether this event is considered TARI-billable. */
  tari_billable:   boolean;
  /** Whether a DriftViolationAlert was raised. */
  drift_alert:     boolean;
  kernel_version:  string;
}

export interface AuditFetchOptions {
  /** Mark this request as TARI-billable (default: false). */
  tariBillable?:   boolean;
  /** Additional headers to include in the request. */
  headers?:        Record<string, string>;
  /** AbortSignal for timeout control. */
  signal?:         AbortSignal;
}

// ── Ray-ID Seen Cache ─────────────────────────────────────────────────────────
// In-memory set for replay detection within a single Worker invocation.
// Persists across requests in the same isolate (Cloudflare V8 isolate lifetime).

const seenRayIds = new Set<string>();

// ── Core Audit Fetch ──────────────────────────────────────────────────────────

/**
 * Wraps `fetch` to capture and audit the `cf-ray` header.
 * Returns both the raw `Response` and the `NetworkAuditRecord`.
 *
 * @param url       Target URL (string or URL object).
 * @param init      Standard RequestInit options.
 * @param opts      AveryOS™ audit options.
 */
export async function auditFetch(
  url:   string | URL,
  init:  RequestInit = {},
  opts:  AuditFetchOptions = {},
): Promise<{ response: Response; audit: NetworkAuditRecord }> {
  const method      = (init.method ?? "GET").toUpperCase();
  const urlStr      = typeof url === "string" ? url : url.toString();
  const originOnly  = (() => { try { const u = new URL(urlStr); return `${u.protocol}//${u.host}`; } catch { return urlStr; } })();
  const startMs     = Date.now();
  const requestedAt = formatIso9(new Date());

  const mergedInit: RequestInit = {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> ?? {}),
      "x-averyos-kernel-ver": KERNEL_VERSION,
      ...(opts.headers ?? {}),
    },
    ...(opts.signal ? { signal: opts.signal } : {}),
  };

  const response    = await fetch(url, mergedInit);
  const deltaMs     = Date.now() - startMs;
  const respondedAt = formatIso9(new Date());
  const cfRay       = response.headers.get("cf-ray") ?? null;

  // Replay / drift detection
  let driftAlert = false;
  if (cfRay) {
    if (seenRayIds.has(cfRay)) {
      driftAlert = true;
      console.warn(
        `[networkAudit] ⚠️ DRIFT_ALERT — duplicate cf-ray [${cfRay}] detected (replay?).`,
      );
    }
    seenRayIds.add(cfRay);
  } else {
    // Absence of cf-ray on a Cloudflare-expected route is a drift signal
    console.warn(
      `[networkAudit] ⚠️ DRIFT_ALERT — cf-ray header absent on ${method} ${originOnly}.`,
    );
    driftAlert = true;
  }

  const audit: NetworkAuditRecord = {
    cf_ray:         cfRay,
    url_origin:     originOnly,
    method,
    status:         response.status,
    delta_ms:       deltaMs,
    requested_at:   requestedAt,
    responded_at:   respondedAt,
    tari_billable:  opts.tariBillable ?? false,
    drift_alert:    driftAlert,
    kernel_version: KERNEL_VERSION,
  };

  return { response, audit };
}

// ── VaultChain Payload Builder ────────────────────────────────────────────────

/**
 * Convert a NetworkAuditRecord to a VaultChain-ready payload.
 * Pass to appendRecord() / writeBlock() in vaultChain.ts.
 */
export function auditRecordToVaultPayload(
  record: NetworkAuditRecord,
): Record<string, unknown> {
  return {
    event:          record.tari_billable ? "TARI_NETWORK_EVENT" : "NETWORK_AUDIT",
    cf_ray:         record.cf_ray,
    url_origin:     record.url_origin,
    method:         record.method,
    status:         record.status,
    delta_ms:       record.delta_ms,
    requested_at:   record.requested_at,
    responded_at:   record.responded_at,
    tari_billable:  record.tari_billable,
    drift_alert:    record.drift_alert,
    kernel_sha:     KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
  };
}

// ── Ray-ID Extractor ──────────────────────────────────────────────────────────

/**
 * Extract the cf-ray header from an existing Response or Headers object.
 * Returns null if not present.
 */
export function extractCfRay(headersOrResponse: Headers | Response): string | null {
  const headers = headersOrResponse instanceof Response
    ? headersOrResponse.headers
    : headersOrResponse;
  return headers.get("cf-ray") ?? null;
}

/**
 * Build a compact ledger entry string for logging.
 * Format: cf-ray=[xxx] | delta=[n]ms | status=[n] | tari=[bool]
 */
export function formatAuditLine(record: NetworkAuditRecord): string {
  return (
    `cf-ray=[${record.cf_ray ?? "N/A"}] | ` +
    `${record.method} ${record.url_origin} | ` +
    `status=[${record.status}] | delta=[${record.delta_ms}ms] | ` +
    `tari=[${record.tari_billable}] | drift=[${record.drift_alert}]`
  );
}
