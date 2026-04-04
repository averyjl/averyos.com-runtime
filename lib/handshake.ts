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
 * lib/handshake.ts
 *
 * AveryOS™ Sovereign Connection Handshake Guard — Phase 116.8.2
 *
 * Ensures that ALL external service calls (Stripe, Cloudflare APIs, Firebase,
 * any third-party endpoint) receive a confirmed 2xx/3xx response before being
 * considered successful. A non-response, timeout, network error, or 4xx/5xx
 * response is treated as a FAILED connection — never assumed to be success.
 *
 * Phase 116.8.2 upgrade — ACTIVE_HANDSHAKE mode:
 *   Any connection/check/handshake now operates in ACTIVE_HANDSHAKE mode
 *   (inspired by the SubmitStripeLicense tool pattern). The mode treats the
 *   connection as a cryptographic event to be verified, not a static declaration:
 *     • `gate_requirement: HTTP_200` — only confirmed HTTP responses pass.
 *     • `on_fail: LOG_AND_PROCEED` — non-blocking failures are logged and
 *       routed to GabrielOS_Watchdog without halting the request.
 *     • `stripe_telemetry_capture: VERBOSE` — captures headers including
 *       cf-ray, server, x-stripe-routing.
 *     • `report_error_codes: [401, 403, 404, 500, 503]` — all error status
 *       codes are captured and forwarded to the Creator log.
 *
 * Problem addressed (from Sovereign Admin Log Phase 112.7):
 *   "AveryOS when it's trying to connect to things if there's no connection
 *    and handshake and confirmation that it hit the connection it was trying
 *    to then it's considered failed."
 *
 * All handshake results are logged to D1 `connection_handshake_log` and
 * surfaced via the error standard so operators can see if and when any
 * external service fails to respond.
 *
 * Usage:
 * ```ts
 * const result = await sovereignFetch("https://api.stripe.com/v1/balance", {
 *   method: "GET",
 *   headers: { Authorization: `Bearer ${stripeKey}` },
 * }, { serviceName: "Stripe", db });
 *
 * if (!result.ok) {
 *   // result.error contains the full failure reason
 *   return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, result.error, 502);
 * }
 * const data = await result.response!.json();
 * ```
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { formatIso9 } from "./timePrecision";
import { KERNEL_SHA, KERNEL_VERSION } from "./sovereignConstants";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HandshakeOpts {
  /** Human-readable name for the service being called (e.g. "Stripe", "Firebase"). */
  serviceName:  string;
  /** Timeout in milliseconds. Defaults to 15 000 ms. */
  timeoutMs?:   number;
  /** D1 binding to log the result. Pass null to skip persistence. */
  db?:          D1DatabaseLike | null;
  /** Phase tag for logging (e.g. "114.3"). */
  phase?:       string;
  /**
   * HTTP status codes to treat as successful in addition to 2xx.
   * Defaults to [301, 302, 307, 308] (redirects = "sovereign infrastructure live").
   */
  successStatuses?: number[];
  /**
   * ACTIVE_HANDSHAKE mode (Phase 116.8.2 upgrade).
   * When true, enables verbose telemetry capture (cf-ray, server, x-stripe headers)
   * and routes all error codes to the GabrielOS_Watchdog console channel.
   * Default: true — all handshakes now operate in ACTIVE mode.
   */
  activeHandshake?: boolean;
}

export interface HandshakeResult {
  /** True only when the server confirmed a 2xx/3xx response. */
  ok:          boolean;
  /** HTTP status code returned, or 0 on network failure. */
  statusCode:  number;
  /** Human-readable failure reason (null when ok=true). */
  error:       string | null;
  /** The raw Response if ok=true. */
  response:    Response | null;
  /** Wall-clock round-trip time in milliseconds. */
  durationMs:  number;
  /** Service name for audit logging. */
  serviceName: string;
  /**
   * ACTIVE_HANDSHAKE telemetry (Phase 116.8.2).
   * Captured when activeHandshake=true (the default).
   */
  telemetry?: {
    cfRay:    string | null;
    server:   string | null;
    xStripe:  string | null;
    via:      string | null;
    /** Whether a 401/403/404/500/503 error code was captured. */
    errorCodeCaptured: boolean;
  };
}

// Minimal D1 binding (avoids importing @cloudflare/workers-types)
interface D1Statement { run(): Promise<void>; }
interface D1DatabaseLike {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
}

// ── Constants ──────────────────────────────────────────────────────────────────

// 2xx = confirmed success; 3xx = redirect, treated as success per the AveryOS™
// sovereign infrastructure standard.  The Cloudflare Worker at averyos.com
// returns HTTP 301 (apex→www redirect) for some routes — a redirect is proof
// that the sovereign infrastructure is live and reachable.
// Reference: Sovereign Admin Log Phase 112.7 — "Accept 2xx + 3xx".
const DEFAULT_SUCCESS_STATUSES = [200, 201, 202, 203, 204, 206, 207, 208,
                                   300, 301, 302, 303, 304, 307, 308];

/**
 * A drop-in wrapper around `fetch()` that enforces the Sovereign Handshake
 * Standard: a successful call MUST receive a confirmed response, not merely
 * an absence of error.
 *
 * Phase 116.8.2: operates in ACTIVE_HANDSHAKE mode by default — captures
 * verbose telemetry headers (cf-ray, server, x-stripe) and routes all
 * error codes [401, 403, 404, 500, 503] to the GabrielOS_Watchdog channel.
 */
export async function sovereignFetch(
  url:     string | URL,
  init:    RequestInit | undefined,
  opts:    HandshakeOpts,
): Promise<HandshakeResult> {
  const timeoutMs      = opts.timeoutMs ?? 15_000;
  const successCodes   = new Set(opts.successStatuses ?? DEFAULT_SUCCESS_STATUSES);
  const phase          = opts.phase ?? "unknown";
  const activeMode     = opts.activeHandshake !== false; // default true
  const t0             = Date.now();

  // ACTIVE_HANDSHAKE telemetry capture codes (Phase 116.8.2)
  const TELEMETRY_ERROR_CODES = new Set([401, 403, 404, 500, 503]);

  let statusCode = 0;
  let error:    string | null = null;
  let response: Response | null = null;
  let rawResponse: Response | null = null;

  try {
    // AbortController-backed timeout so the call is cancelled — not just ignored.
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    let raw: Response;
    try {
      raw = await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    rawResponse = raw;
    statusCode  = raw.status;

    if (successCodes.has(statusCode)) {
      response = raw;
    } else {
      // Non-success status = handshake failed — log the status and body snippet.
      let bodySnippet = "";
      try {
        bodySnippet = (await raw.text()).slice(0, 256);
      } catch (_e) { /* ignore */ }
      error = `${opts.serviceName} returned HTTP ${statusCode}` +
              (bodySnippet ? `: ${bodySnippet}` : "");
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    error = isTimeout
      ? `${opts.serviceName} connection timed out after ${timeoutMs} ms — no response received`
      : `${opts.serviceName} connection failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  const durationMs = Date.now() - t0;
  const ok         = !error && response !== null;

  // ── ACTIVE_HANDSHAKE telemetry capture (Phase 116.8.2) ────────────────────
  let telemetry: HandshakeResult["telemetry"] | undefined;
  if (activeMode && rawResponse) {
    const cfRay   = rawResponse.headers.get("cf-ray");
    const server  = rawResponse.headers.get("server");
    const xStripe = rawResponse.headers.get("x-stripe-routing-requested-reason") ??
                    rawResponse.headers.get("stripe-version");
    const via     = rawResponse.headers.get("via");
    telemetry = {
      cfRay,
      server,
      xStripe,
      via,
      errorCodeCaptured: TELEMETRY_ERROR_CODES.has(statusCode),
    };

    // Route captured error codes to GabrielOS_Watchdog channel
    if (telemetry.errorCodeCaptured) {
      console.warn(
        `[ACTIVE_HANDSHAKE|GabrielOS_Watchdog] ${opts.serviceName} | ` +
        `code=${statusCode} | cf-ray=${cfRay ?? "none"} | ` +
        `server=${server ?? "none"} | phase=${phase}`
      );
    }
  }

  // ── Log to D1 ──────────────────────────────────────────────────────────────
  if (opts.db) {
    try {
      await opts.db.prepare(
        `INSERT INTO connection_handshake_log
           (service_name, url, status_code, ok, error_message,
            duration_ms, phase, kernel_sha, kernel_version, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        opts.serviceName.slice(0, 64),
        url.toString().slice(0, 512),
        statusCode,
        ok ? 1 : 0,
        error,
        durationMs,
        phase,
        KERNEL_SHA,
        KERNEL_VERSION,
        formatIso9(),
      ).run();
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.error("[Handshake] D1 log write failed:", msg);
      // Non-fatal.
    }
  }

  // ── Console trace ───────────────────────────────────────────────────────────
  if (!ok) {
    console.error(
      `[HANDSHAKE FAILED] ${opts.serviceName} | ` +
      `status=${statusCode} | duration=${durationMs}ms | ` +
      `error=${error}`
    );
  }

  return { ok, statusCode, error, response, durationMs, serviceName: opts.serviceName, telemetry };
}
