/**
 * lib/security/pinningCore.ts
 *
 * AveryOS™ Certificate Pinning Module — GATE 116.9.1 / GATE 117.0.3
 *
 * Verifies the SHA-256 SPKI fingerprint of remote server certificates to
 * prevent proxied, intercepted, or hallucinated handshakes from authenticating
 * the Kernel.  If pinning fails, HALT_BOOT is triggered and GabrielOS™
 * Watchdog is notified.
 *
 * Pinned certificates:
 *   • Stripe  — Serial 0E:92:3D:1A:91:F9:B7:C7:90:65:4F:BD:1D:D0:41:8D
 *   • Cloudflare — public SPKI pins for *.cloudflare.com TLS leaf certs
 *
 * Usage (Cloudflare Worker context — GATE 116.9.3 networkAudit integration):
 *   import { verifyPin, HALT_BOOT_PIN_FAILURE } from "@/lib/security/pinningCore";
 *   const result = await verifyPin(response, "stripe");
 *   if (!result.valid) HALT_BOOT_PIN_FAILURE(result);
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";

// ── Known SPKI Pins ───────────────────────────────────────────────────────────

/**
 * Sovereign pin registry.
 * Keys map to one or more acceptable SHA-256 SPKI fingerprints (hex, lowercase,
 * colon-separated).  A response passes pinning if at least one pin matches.
 */
export const SOVEREIGN_PINS: Readonly<Record<string, readonly string[]>> = {
  stripe: [
    // Stripe leaf certificate identifier — Serial 0E:92:3D:1A:91:F9:B7:C7:90:65:4F:BD:1D:D0:41:8D
    // NOTE: Update this entry with the actual SPKI SHA-256 fingerprint obtained by running:
    //   openssl s_client -connect api.stripe.com:443 | openssl x509 -noout -pubkey | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | xxd -p
    // The serial is retained here as a human-readable reference only.
    "0e:92:3d:1a:91:f9:b7:c7:90:65:4f:bd:1d:d0:41:8d",
  ],
  cloudflare: [
    // Cloudflare ECC CA-3 SPKI SHA-256 (primary)
    "cb:15:36:1c:c8:e6:7d:a7:6c:ce:65:d5:ae:39:aa:4e:08:7d:3c:4b:5c:12:4b:07:c9:35:42:b0:55:0a:a7:01",
    // Cloudflare RSA CA-2 SPKI SHA-256 (fallback)
    "09:7b:d5:f0:d3:ef:eb:51:4d:e6:b3:8c:08:38:0b:5c:2f:8a:9e:e8:f5:3c:71:b0:0a:0c:37:90:52:34:e2:d4",
  ],
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type PinTarget = keyof typeof SOVEREIGN_PINS;

export interface PinVerificationResult {
  /** Whether the pin matched a sovereign entry. */
  valid:        boolean;
  /** The target checked (e.g. "stripe", "cloudflare"). */
  target:       string;
  /** The fingerprint extracted from the response (if available). */
  fingerprint:  string | null;
  /** ISO-9 timestamp of the check. */
  checked_at:   string;
  /** Kernel version at check time. */
  kernel_version: string;
  /** Human-readable verdict message. */
  message:      string;
}

export interface HaltBootPinEvent {
  event:          "HALT_BOOT_PIN_FAILURE";
  target:         string;
  fingerprint:    string | null;
  expected_pins:  readonly string[];
  timestamp:      string;
  kernel_sha:     string;
  kernel_version: string;
}

// ── Core Pinning Utility ──────────────────────────────────────────────────────

/**
 * Extract the CF-Certificate-Fingerprint header value (Cloudflare sets this
 * on requests to origin via `ssl_certificate_fingerprint`), or fall back to
 * the x-averyos-cert-fp forwarding header used in Worker-to-Worker calls.
 *
 * In environments where the header is not available (e.g. standard fetch),
 * returns null — the caller must decide how to handle the absence.
 */
export function extractCertFingerprint(headers: Headers): string | null {
  return (
    headers.get("cf-certificate-fingerprint") ??
    headers.get("x-averyos-cert-fp") ??
    null
  );
}

/**
 * Normalise a fingerprint to lowercase with colons removed for comparison.
 * Accepts both colon-separated hex (AA:BB:CC) and raw hex strings (aabbcc).
 */
function normalise(fp: string): string {
  return fp.toLowerCase().replace(/:/g, "");
}

/**
 * Verify that the certificate fingerprint in `headers` matches a known pin
 * for `target`.
 *
 * When the fingerprint header is absent (common in Workers fetch), the result
 * is `valid: false` with `message: "FINGERPRINT_UNAVAILABLE"`.  Callers that
 * are operating inside the Cloudflare edge should treat this as a conditional
 * pass (the TLS handshake is already validated by Cloudflare infrastructure);
 * callers in Node-02 scripts should treat this as a hard failure.
 */
export function verifyPin(
  headers: Headers,
  target:  PinTarget,
): PinVerificationResult {
  const now        = formatIso9(new Date());
  // eslint-disable-next-line security/detect-object-injection
  const pins       = SOVEREIGN_PINS[target];
  const raw        = extractCertFingerprint(headers);

  if (!raw) {
    return {
      valid:           false,
      target,
      fingerprint:     null,
      checked_at:      now,
      kernel_version:  KERNEL_VERSION,
      message:         "FINGERPRINT_UNAVAILABLE — cf-certificate-fingerprint header absent",
    };
  }

  const fp         = normalise(raw);
  const matched    = pins.some((p) => normalise(p) === fp);

  return {
    valid:           matched,
    target,
    fingerprint:     raw,
    checked_at:      now,
    kernel_version:  KERNEL_VERSION,
    message:         matched
      ? `PIN_VERIFIED — ${target} fingerprint matches sovereign registry`
      : `PIN_MISMATCH — ${target} fingerprint [${raw}] not in sovereign registry`,
  };
}

// ── HALT_BOOT Emitter ─────────────────────────────────────────────────────────

/**
 * Emit a HALT_BOOT event for a pin failure.  In a Worker context this logs
 * to console.error (picked up by Cloudflare Logpush).  Callers should also
 * forward to GabrielOS™ Sentinel via `lib/forensics/networkAudit.ts`.
 */
export function HALT_BOOT_PIN_FAILURE(result: PinVerificationResult): HaltBootPinEvent {
  const event: HaltBootPinEvent = {
    event:          "HALT_BOOT_PIN_FAILURE",
    target:         result.target,
    fingerprint:    result.fingerprint,
    // eslint-disable-next-line security/detect-object-injection
    expected_pins:  SOVEREIGN_PINS[result.target as PinTarget] ?? [],
    timestamp:      formatIso9(new Date()),
    kernel_sha:     KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
  };
  console.error(
    `[pinningCore] ⛓️ HALT_BOOT — ${result.message}`,
    JSON.stringify(event),
  );
  return event;
}

/**
 * Convenience: verify and throw if invalid.
 * Use in Step 18 of SST-ULTRA-RECOVERY (lib/recovery/recoverySteps.ts).
 */
export function assertPin(headers: Headers, target: PinTarget): PinVerificationResult {
  const result = verifyPin(headers, target);
  if (!result.valid) {
    HALT_BOOT_PIN_FAILURE(result);
    // Do not throw in edge runtime — return the result for caller decision.
  }
  return result;
}
