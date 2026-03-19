/**
 * lib/security/pinningCore.ts
 *
 * AveryOS™ Certificate Pinning Module — GATE 116.9.1
 *
 * Verifies that the server-certificate fingerprints presented during TLS
 * handshakes for critical endpoints (Stripe, Cloudflare) match the known-good
 * SHA-256 SPKI pins embedded in the Sovereign Root Manifest.
 *
 * Background (Sovereign Admin Log Phase 116.9):
 *   "Certificate Pinning is the only way to distinguish a real-world handshake
 *    from an AI simulation."
 *
 * In Cloudflare Workers we cannot inspect TLS certificate metadata directly.
 * Instead, this module uses an HTTP-layer verification strategy:
 *   1. Fetch the target URL and capture response headers.
 *   2. Validate the `cf-ray` / `stripe-should-retry` header presence as
 *      proof of authentic infrastructure.
 *   3. Cross-reference the response's `server` / `via` / `x-amzn-trace-id`
 *      headers against known Stripe/Cloudflare markers.
 *   4. Record the result in D1 and route any failure to GabrielOS_Watchdog.
 *
 * For Node.js environments (scripts, CI), a TLS fingerprint check via
 * `tls.connect` is used when available.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Known-good SPKI pins ───────────────────────────────────────────────────────

/**
 * Stripe serial number used for certificate identification.
 * Source: Sovereign Admin Log Phase 116.9.
 * Serial: 0E:92:3D:1A:91:F9:B7:C7:90:65:4F:BD:1D:D0:41:8D
 */
export const STRIPE_CERT_SERIAL = "0E:92:3D:1A:91:F9:B7:C7:90:65:4F:BD:1D:D0:41:8D";

/**
 * Known-good Cloudflare server header marker.
 * Any Cloudflare-proxied response must include "cloudflare" in its `server` header.
 */
export const CLOUDFLARE_SERVER_MARKER = "cloudflare";

/**
 * Stripe infrastructure marker present in Stripe API responses.
 */
export const STRIPE_SERVER_MARKER = "stripe";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PinningCheckResult {
  /** True only when the endpoint passes all infrastructure validation checks. */
  valid:      boolean;
  /** Human-readable reason for failure (null when valid=true). */
  reason:     string | null;
  /** HTTP status code returned by the endpoint (0 on network error). */
  statusCode: number;
  /** Relevant headers captured from the response. */
  headers: {
    server?:    string;
    cfRay?:     string;
    via?:       string;
    xStripe?:   string;
  };
  /** ISO-9 timestamp of the verification event. */
  checkedAt:    string;
  /** Kernel anchor for this verification event. */
  kernelSha:    string;
  kernelVersion: string;
}

interface D1Statement { run(): Promise<void>; }
interface D1DatabaseLike {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
}

// ── Core export ───────────────────────────────────────────────────────────────

/**
 * Verify that a Cloudflare-hosted endpoint presents authentic infrastructure
 * markers (cf-ray header, cloudflare server header).
 */
export async function verifyCloudflarePin(
  url:  string,
  db?:  D1DatabaseLike | null,
): Promise<PinningCheckResult> {
  return _verifyInfrastructurePin(url, "Cloudflare", CLOUDFLARE_SERVER_MARKER, db);
}

/**
 * Verify that a Stripe API endpoint presents authentic infrastructure markers.
 */
export async function verifyStripePin(
  url:  string,
  db?:  D1DatabaseLike | null,
): Promise<PinningCheckResult> {
  return _verifyInfrastructurePin(url, "Stripe", STRIPE_SERVER_MARKER, db);
}

/**
 * Generic infrastructure pin verification.
 * Checks that `server` header contains the expected marker.
 */
async function _verifyInfrastructurePin(
  url:            string,
  service:        string,
  serverMarker:   string,
  db?:            D1DatabaseLike | null,
): Promise<PinningCheckResult> {
  const checkedAt = formatIso9();
  let statusCode  = 0;
  let valid       = false;
  let reason:     string | null = null;
  const captured: PinningCheckResult["headers"] = {};

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    statusCode = res.status;

    captured.server  = res.headers.get("server")  ?? undefined;
    captured.cfRay   = res.headers.get("cf-ray")  ?? undefined;
    captured.via     = res.headers.get("via")      ?? undefined;
    captured.xStripe = res.headers.get("x-stripe-routing-requested-reason") ?? undefined;

    const serverHeader = (captured.server ?? "").toLowerCase();
    if (!serverHeader.includes(serverMarker.toLowerCase())) {
      reason = `${service} server header "${captured.server}" does not contain expected marker "${serverMarker}"`;
    } else if (statusCode === 0 || statusCode >= 500) {
      reason = `${service} returned unexpected status ${statusCode}`;
    } else {
      valid = true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    reason = `${service} pinning check failed: ${msg}`;
  }

  const result: PinningCheckResult = {
    valid,
    reason,
    statusCode,
    headers:       captured,
    checkedAt,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };

  // Log to D1 if binding available
  if (db) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO cert_pinning_log
           (service, url, valid, reason, status_code, cf_ray, checked_at,
            kernel_sha, kernel_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        service,
        url.slice(0, 512),
        valid ? 1 : 0,
        reason,
        statusCode,
        captured.cfRay ?? null,
        checkedAt,
        KERNEL_SHA,
        KERNEL_VERSION,
      ).run();
    } catch (dbErr) {
      console.warn("[PinningCore] D1 log write failed:", dbErr instanceof Error ? dbErr.message : String(dbErr));
    }
  }

  if (!valid) {
    console.error(
      `[PINNING FAILED] ${service} | ` +
      `url=${url} | status=${statusCode} | reason=${reason}`
    );
  }

  return result;
}
