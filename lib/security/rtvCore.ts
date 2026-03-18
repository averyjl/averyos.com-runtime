/**
 * lib/security/rtvCore.ts
 *
 * AveryOS™ Round-Trip Verification (RTV) Handshake Engine — GATE 117.0.1
 *
 * Implements the "Step C: Final Echo" protocol for all internal handshakes.
 * Silence is Drift™ — any connection that fails to return an active ACK/Echo
 * within the 500 ms timeout window is treated as a DRIFT STATE and logged
 * to the VaultChain™ ledger.
 *
 * This eliminates "The Simulation Lie" — an AI/LLM that fabricates a
 * successful connection while offline or in an isolated environment cannot
 * produce a real Round-Trip fingerprint with a valid cf-ray or timing delta.
 *
 * Integration:
 *   • Used by SST-ULTRA-RECOVERY Step 18 (lib/recovery/recoverySteps.ts)
 *   • Used by the Certificate Pinning flow (lib/security/pinningCore.ts)
 *   • Used by lib/forensics/networkAudit.ts to anchor cf-ray headers
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default RTV echo timeout in milliseconds.  Silence after 500 ms = Drift. */
export const RTV_TIMEOUT_MS = 500;

/** Minimum accepted timing delta (ms).  Sub-1 ms responses indicate caching
 *  or fabrication and trigger a FABRICATION_SUSPECTED flag. */
export const RTV_MIN_DELTA_MS = 1;

// ── Types ─────────────────────────────────────────────────────────────────────

export type RtvStatus =
  | "ACK_RECEIVED"        // Echo confirmed — handshake valid
  | "TIMEOUT"             // No response within RTV_TIMEOUT_MS — Drift
  | "FABRICATION_SUSPECTED" // Sub-1 ms response — likely hallucinated
  | "ECHO_MISMATCH"       // Response body does not match sent nonce
  | "NETWORK_ERROR";      // Fetch threw — network unreachable

export interface RtvResult {
  status:         RtvStatus;
  /** Whether the handshake should be considered valid. */
  valid:          boolean;
  /** Echo nonce sent in the request. */
  nonce:          string;
  /** Echo nonce returned in the response (null if timeout/error). */
  echo:           string | null;
  /** Round-trip delta in milliseconds (null if not completed). */
  delta_ms:       number | null;
  /** Cloudflare Ray ID from the response headers (null if absent). */
  cf_ray:         string | null;
  /** ISO-9 start timestamp. */
  start_at:       string;
  /** ISO-9 end timestamp (null if not completed). */
  end_at:         string | null;
  kernel_version: string;
  message:        string;
}

// ── Nonce Generator ───────────────────────────────────────────────────────────

/** Generate a cryptographically random hex nonce for the echo challenge. */
function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Core RTV Engine ───────────────────────────────────────────────────────────

/**
 * Execute a Round-Trip Verification handshake against `url`.
 *
 * The function sends a POST request carrying an `x-averyos-rtv-nonce` header
 * and expects the same nonce back in the response's `x-averyos-rtv-echo`
 * header within `timeoutMs` milliseconds.
 *
 * @param url         Target endpoint to ping (must support HEAD/POST echo).
 * @param timeoutMs   Timeout in ms (default: RTV_TIMEOUT_MS = 500).
 * @param extraHeaders Additional headers to include (e.g. auth tokens).
 */
export async function executeRtv(
  url:          string,
  timeoutMs:    number = RTV_TIMEOUT_MS,
  extraHeaders: Record<string, string> = {},
): Promise<RtvResult> {
  const nonce    = generateNonce();
  const startAt  = formatIso9(new Date());
  const startMs  = Date.now();

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "Content-Type":          "application/json",
        "x-averyos-rtv-nonce":   nonce,
        "x-averyos-kernel-ver":  KERNEL_VERSION,
        ...extraHeaders,
      },
      body: JSON.stringify({ rtv: true, nonce }),
    });

    clearTimeout(timer);

    const deltaMs = Date.now() - startMs;
    const endAt   = formatIso9(new Date());
    const cfRay   = response.headers.get("cf-ray") ?? null;
    const echo    = response.headers.get("x-averyos-rtv-echo") ?? null;

    if (deltaMs < RTV_MIN_DELTA_MS) {
      return {
        status:         "FABRICATION_SUSPECTED",
        valid:          false,
        nonce,
        echo,
        delta_ms:       deltaMs,
        cf_ray:         cfRay,
        start_at:       startAt,
        end_at:         endAt,
        kernel_version: KERNEL_VERSION,
        message:        `RTV fabrication suspected — delta ${deltaMs}ms is sub-threshold (min ${RTV_MIN_DELTA_MS}ms)`,
      };
    }

    if (!echo) {
      return {
        status:         "ECHO_MISMATCH",
        valid:          false,
        nonce,
        echo:           null,
        delta_ms:       deltaMs,
        cf_ray:         cfRay,
        start_at:       startAt,
        end_at:         endAt,
        kernel_version: KERNEL_VERSION,
        message:        "RTV echo header absent — x-averyos-rtv-echo not returned",
      };
    }

    if (echo !== nonce) {
      return {
        status:         "ECHO_MISMATCH",
        valid:          false,
        nonce,
        echo,
        delta_ms:       deltaMs,
        cf_ray:         cfRay,
        start_at:       startAt,
        end_at:         endAt,
        kernel_version: KERNEL_VERSION,
        message:        `RTV echo mismatch — sent [${nonce}] received [${echo}]`,
      };
    }

    return {
      status:         "ACK_RECEIVED",
      valid:          true,
      nonce,
      echo,
      delta_ms:       deltaMs,
      cf_ray:         cfRay,
      start_at:       startAt,
      end_at:         endAt,
      kernel_version: KERNEL_VERSION,
      message:        `RTV ACK confirmed — delta ${deltaMs}ms, cf-ray: ${cfRay ?? "N/A"}`,
    };

  } catch (err: unknown) {
    clearTimeout(timer);
    const endAt = formatIso9(new Date());

    if (err instanceof Error && err.name === "AbortError") {
      return {
        status:         "TIMEOUT",
        valid:          false,
        nonce,
        echo:           null,
        delta_ms:       timeoutMs,
        cf_ray:         null,
        start_at:       startAt,
        end_at:         endAt,
        kernel_version: KERNEL_VERSION,
        message:        `RTV TIMEOUT — silence exceeded ${timeoutMs}ms. Silence is Drift™.`,
      };
    }

    return {
      status:         "NETWORK_ERROR",
      valid:          false,
      nonce,
      echo:           null,
      delta_ms:       null,
      cf_ray:         null,
      start_at:       startAt,
      end_at:         endAt,
      kernel_version: KERNEL_VERSION,
      message:        `RTV network error — ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Silence Detector ─────────────────────────────────────────────────────────

/**
 * Determine whether an RTV result constitutes "Silence" (= Drift).
 * Silence covers: TIMEOUT, NETWORK_ERROR, ECHO_MISMATCH, FABRICATION_SUSPECTED.
 * Only ACK_RECEIVED is non-silence.
 */
export function isSilence(result: RtvResult): boolean {
  return result.status !== "ACK_RECEIVED";
}

/**
 * Build a VaultChain-ready event payload from an RTV result.
 * Passed to appendRecord() in the calling module.
 */
export function rtvToVaultPayload(result: RtvResult): Record<string, unknown> {
  return {
    event:          "RTV_HANDSHAKE",
    status:         result.status,
    valid:          result.valid,
    nonce_prefix:   result.nonce.slice(0, 8),
    delta_ms:       result.delta_ms,
    cf_ray:         result.cf_ray,
    start_at:       result.start_at,
    end_at:         result.end_at,
    kernel_sha:     KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    message:        result.message,
  };
}
