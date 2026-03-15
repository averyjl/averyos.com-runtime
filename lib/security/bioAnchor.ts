/**
 * lib/security/bioAnchor.ts
 *
 * AveryOS™ Bio-Metric Anchor — Phase 115 GATE 115.3.2
 *
 * Spike / WHOOP API connector that injects real-time Heart Rate Variability
 * (HRV) and Recovery Score entropy into the AVERYOS_PRIVATE_KEY unmasking
 * sequence.  The kernel only operates at full trust when the Creator is
 * "Healthy and Aligned".
 *
 * Architecture:
 *   1. Fetch current HRV + Recovery Score from the WHOOP REST API
 *      (OAuth 2.0 bearer token).
 *   2. Derive a SHA-512 entropy token from the biometric payload.
 *   3. Inject the entropy token into the kernel handshake so that key
 *      unmasking requires both the physical USB salt AND biometric proof.
 *
 * Security contract:
 *   • Raw biometric data MUST NEVER be written to disk, logs, or any
 *     persistent storage.  Only the SHA-512 entropy token is retained
 *     in memory for the lifetime of the current handshake session.
 *   • If the WHOOP API is unavailable, the function returns a degraded
 *     result — the caller decides whether to permit kernel operations
 *     without biometric confirmation.
 *   • All hashes use SHA-512 (AveryOS™ sovereign standard — not SHA-256).
 *
 * Environment (Cloudflare secrets or .env):
 *   WHOOP_ACCESS_TOKEN   OAuth 2.0 bearer token for the WHOOP REST API.
 *   WHOOP_USER_ID        WHOOP numeric user ID (optional — defaults to "me").
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── WHOOP API base URL ─────────────────────────────────────────────────────────
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v1";

/**
 * Minimum acceptable Recovery Score (0–100) for full-trust kernel operations.
 * Below this threshold the kernel enters STASIS and refuses private key ops.
 */
const MIN_RECOVERY_SCORE = 33;

/**
 * Maximum acceptable resting heart rate (bpm) — readings above this may
 * indicate physiological stress and will downgrade trust level.
 */
const MAX_RESTING_HR = 100;

// ── Types ──────────────────────────────────────────────────────────────────────

/** Subset of WHOOP Recovery API v1 response relevant to the Bio-Anchor. */
export interface WhoopRecovery {
  /** Recovery Score 0–100 (green ≥ 67, yellow 34–66, red ≤ 33). */
  recovery_score: number;
  /** Resting heart rate in bpm. */
  resting_heart_rate: number;
  /** Heart Rate Variability in ms (higher = more recovered). */
  hrv_rmssd_milli: number;
  /** ISO-8601 timestamp of when the recovery was computed. */
  created_at: string;
}

/** Result returned by {@link fetchBioAnchor}. */
export interface BioAnchorResult {
  /** Whether the biometric check passed at full-trust level. */
  healthy: boolean;
  /**
   * SHA-512 entropy token derived from the biometric payload.
   * Used to XOR-mask the private key alongside the USB salt.
   * 128 hex characters (64 bytes).
   */
  entropyToken: string;
  /** Recovery score (0–100); null when the API was unreachable. */
  recoveryScore: number | null;
  /** HRV in ms; null when the API was unreachable. */
  hrvMilli: number | null;
  /** Resting heart rate in bpm; null when API was unreachable. */
  restingHr: number | null;
  /** ISO-8601 timestamp from the WHOOP API, or the local time on failure. */
  sampledAt: string;
  /** Whether the reading came from the live API or a degraded-mode fallback. */
  source: "whoop_api" | "degraded";
  /** Reason the check failed / was degraded; null on success. */
  failureReason: string | null;
}

// ── SHA-512 helper ─────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const buf  = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest("SHA-512", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Node.js fallback (local scripts / Electron main process)
  const { createHash } = await import("crypto");
  return createHash("sha512").update(input, "utf8").digest("hex");
}

// ── WHOOP API fetch ────────────────────────────────────────────────────────────

/**
 * Fetch the most recent WHOOP Recovery record for the authenticated user.
 *
 * @param accessToken  WHOOP OAuth 2.0 bearer token.
 * @param userId       WHOOP user ID (defaults to "me").
 * @returns The latest recovery record, or null on failure.
 */
async function fetchWhoopRecovery(
  accessToken: string,
  userId = "me",
): Promise<WhoopRecovery | null> {
  try {
    // Fetch latest recovery (limit=1, most recent first)
    const url = `${WHOOP_API_BASE}/recovery?limit=1&userId=${userId}`;
    const res = await fetch(url, {
      method:  "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept:        "application/json",
      },
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json() as {
      records?: Array<{
        score?: {
          recovery_score?: number;
          resting_heart_rate?: number;
          hrv_rmssd_milli?: number;
        };
        created_at?: string;
      }>;
    };
    const record = data?.records?.[0];
    if (!record?.score) return null;

    return {
      recovery_score:      record.score.recovery_score      ?? 0,
      resting_heart_rate:  record.score.resting_heart_rate  ?? 0,
      hrv_rmssd_milli:     record.score.hrv_rmssd_milli     ?? 0,
      created_at:          record.created_at                 ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch biometric data from the WHOOP API and derive a SHA-512 entropy token.
 *
 * The entropy token is computed as:
 *   SHA-512(
 *     KERNEL_SHA + "|" +
 *     recovery_score + "|" +
 *     hrv_rmssd_milli + "|" +
 *     resting_heart_rate + "|" +
 *     created_at
 *   )
 *
 * This binds the private-key unmasking operation to both the sovereign kernel
 * anchor AND the Creator's live physiological state.
 *
 * @param accessToken  WHOOP OAuth 2.0 bearer token from environment.
 * @param userId       WHOOP user ID (optional, defaults to "me").
 * @returns {@link BioAnchorResult} — healthy=true means full-trust operations
 *          are permitted; healthy=false triggers STASIS mode.
 */
export async function fetchBioAnchor(
  accessToken: string,
  userId?: string,
): Promise<BioAnchorResult> {
  const recovery = await fetchWhoopRecovery(accessToken, userId);

  if (!recovery) {
    // Degraded mode — API unavailable.
    // Entropy sources: kernel anchor + timestamp + 16 random bytes via Web Crypto.
    // Using multiple entropy sources prevents predictability when WHOOP is offline.
    const ts         = new Date().toISOString();
    const randHex    = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const token = await sha512hex(`${KERNEL_SHA}|degraded|${ts}|${KERNEL_VERSION}|${randHex}`);
    return {
      healthy:       false,
      entropyToken:  token,
      recoveryScore: null,
      hrvMilli:      null,
      restingHr:     null,
      sampledAt:     ts,
      source:        "degraded",
      failureReason: "WHOOP API unreachable or no recovery data available",
    };
  }

  // Evaluate health thresholds
  const scoreOk = recovery.recovery_score >= MIN_RECOVERY_SCORE;
  const hrOk    = recovery.resting_heart_rate <= MAX_RESTING_HR;
  const healthy = scoreOk && hrOk;

  // Derive entropy token: bind to kernel anchor + live biometrics (SHA-512)
  const entropyInput = [
    KERNEL_SHA,
    String(recovery.recovery_score),
    String(recovery.hrv_rmssd_milli),
    String(recovery.resting_heart_rate),
    recovery.created_at,
  ].join("|");
  const entropyToken = await sha512hex(entropyInput);

  return {
    healthy,
    entropyToken,
    recoveryScore: recovery.recovery_score,
    hrvMilli:      recovery.hrv_rmssd_milli,
    restingHr:     recovery.resting_heart_rate,
    sampledAt:     recovery.created_at,
    source:        "whoop_api",
    failureReason: healthy
      ? null
      : !scoreOk
        ? `Recovery score ${recovery.recovery_score} is below minimum threshold (${MIN_RECOVERY_SCORE})`
        : `Resting HR ${recovery.resting_heart_rate} bpm exceeds maximum threshold (${MAX_RESTING_HR} bpm)`,
  };
}

/**
 * Combine the USB salt and the WHOOP entropy token to produce a composite
 * key-unmasking secret.  This is the final step of the Soul-Anchor protocol.
 *
 * Both inputs are required; if either is absent the function returns null
 * (key operations are refused).
 *
 * @param usbSaltHex     Hex-encoded USB salt (from the `.aossalt` file).
 * @param entropyToken   128-char hex entropy token from {@link fetchBioAnchor}.
 * @returns 128-char hex composite secret, or null if inputs are invalid.
 */
export async function composeSoulAnchorSecret(
  usbSaltHex: string,
  entropyToken: string,
): Promise<string | null> {
  if (!usbSaltHex || !entropyToken) return null;
  return sha512hex(`${usbSaltHex}:${entropyToken}:${KERNEL_SHA}`);
}
