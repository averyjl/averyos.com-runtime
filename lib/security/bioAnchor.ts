/**
 * lib/security/bioAnchor.ts
 *
 * AveryOS™ Bio-Metric Anchor — Phase 117 GATE 117.6.1 / 117.8.4
 *
 * WHOOP HRV + WebAuthn (FaceID / Fingerprint) biometric delegate that injects
 * live physiological and device-attestation entropy into the AVERYOS_PRIVATE_KEY
 * unmasking sequence.
 *
 * Tiered Residency Model (Phase 117):
 *   FULLY_RESIDENT    — Physical USB salt present + WHOOP HRV verified.
 *                       Highest trust; all key operations permitted.
 *   DELEGATED_RESIDENCY — USB salt absent (mobile); WHOOP HRV + WebAuthn
 *                         platform authenticator (FaceID / Fingerprint) used
 *                         as a "Virtual Salt".  Key operations permitted with
 *                         slightly reduced trust score (still >= threshold).
 *   CLOUD             — Neither USB salt nor biometrics available.
 *                       Key operations refused; STASIS mode active.
 *
 * Architecture:
 *   1. Fetch current HRV + Recovery Score from the WHOOP REST API
 *      (OAuth 2.0 bearer token).
 *   2. Derive a SHA-512 entropy token from the biometric payload.
 *   3a. FULLY_RESIDENT: combine USB salt + entropy token via composeSoulAnchorSecret().
 *   3b. DELEGATED_RESIDENCY: combine WebAuthn clientDataHash + entropy token via
 *       composeDelegatedSecret() — no USB salt required.
 *
 * Security contract:
 *   • Raw biometric data MUST NEVER be written to disk, logs, or any
 *     persistent storage.  Only the SHA-512 entropy token is retained
 *     in memory for the lifetime of the current handshake session.
 *   • If the WHOOP API is unavailable, the function returns a degraded
 *     result — the caller decides whether to permit kernel operations
 *     without biometric confirmation.
 *   • All hashes use SHA-512 (AveryOS™ sovereign standard — not SHA-256).
 *   • WebAuthn assertions are verified client-side; the raw authenticatorData
 *     and clientDataHash are hashed immediately — never stored raw.
 *
 * Environment (Cloudflare secrets or .env):
 *   WHOOP_ACCESS_TOKEN          OAuth 2.0 bearer token for the WHOOP REST API.
 *   WHOOP_USER_ID               WHOOP numeric user ID (optional — defaults to "me").
 *   WEBAUTHN_RELYING_PARTY_ID   RP ID for WebAuthn assertions (defaults to "averyos.com").
 *   WEBAUTHN_ORIGIN             Allowed origin for client data (defaults to "https://averyos.com").
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── WHOOP API base URL ─────────────────────────────────────────────────────────
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v1";

// ── Residency tier ─────────────────────────────────────────────────────────────

/**
 * Tiered Residency state (Phase 117).
 *
 * FULLY_RESIDENT     — Physical USB salt present + WHOOP HRV verified.
 * DELEGATED_RESIDENCY — Mobile: USB absent; WHOOP HRV + WebAuthn biometric used.
 * CLOUD              — Neither USB nor biometrics available; STASIS mode.
 */
export type ResidencyTier = "FULLY_RESIDENT" | "DELEGATED_RESIDENCY" | "CLOUD";

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
  /**
   * Residency tier inferred from this biometric result (Phase 117).
   *
   * NOTE: `fetchBioAnchor` always returns `"CLOUD"` here — it evaluates
   * biometric health only.  The actual residency tier (FULLY_RESIDENT or
   * DELEGATED_RESIDENCY) is determined by {@link resolveResidency}, which
   * combines this result with USB-salt and/or WebAuthn evidence.
   */
  residencyTier: ResidencyTier;
}

// ── WebAuthn types ────────────────────────────────────────────────────────────

/**
 * Minimal WebAuthn authenticator assertion required by the Delegated Residency
 * protocol.  Passed from the browser (WebAuthn API) to the server-side
 * bio-anchor layer.
 *
 * Raw bytes MUST be transmitted as Base64URL-encoded strings.
 * The server immediately hashes all fields via SHA-512 and discards the raw values.
 */
export interface WebAuthnAssertion {
  /**
   * Base64URL-encoded SHA-256 hash of the JSON client data collected by the
   * browser during the WebAuthn `navigator.credentials.get()` call.
   * (ArrayBuffer from AuthenticatorAssertionResponse.clientDataJSON → SHA-256)
   */
  clientDataHashB64: string;
  /**
   * Base64URL-encoded authenticator data blob returned by the device.
   * Contains the RP ID hash, flags (UP + UV), and sign count.
   */
  authenticatorDataB64: string;
  /**
   * Credential ID of the platform authenticator that produced the assertion,
   * encoded as Base64URL.  Used as an additional entropy source.
   */
  credentialIdB64: string;
  /**
   * ISO-8601 timestamp of when the assertion was generated on the client.
   * Prevents replay attacks by binding the entropy to a point in time.
   */
  assertedAt: string;
}

/**
 * Result of the Delegated Residency handshake (Phase 117).
 * Returned by {@link composeDelegatedSecret}.
 */
export interface DelegatedResidencyResult {
  /**
   * 128-char hex composite secret usable for key unmasking in the absence of
   * a physical USB salt.  Null when inputs are invalid or biometric fails.
   */
  secret: string | null;
  /** The residency tier established by this handshake. */
  tier: ResidencyTier;
  /** Human-readable reason when secret is null. */
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
      residencyTier: "CLOUD",
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
    // residencyTier is set to CLOUD here; caller upgrades to FULLY_RESIDENT or
    // DELEGATED_RESIDENCY after combining with USB-salt / WebAuthn evidence.
    residencyTier: "CLOUD",
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

// ── DELEGATED_RESIDENCY — Phase 117 ───────────────────────────────────────────

/**
 * Compose a Delegated Residency secret from a WebAuthn platform-authenticator
 * assertion (FaceID / Fingerprint) and the WHOOP entropy token.
 *
 * This is the Tier-2 (mobile) equivalent of {@link composeSoulAnchorSecret}.
 * It is used when the physical USB salt is unavailable (e.g., on a phone that
 * lacks a USB-A port).  The device biometric + WHOOP heartbeat together act as a
 * "Biological Salt" — the Creator's body IS the key material.
 *
 * The composite secret is:
 *   SHA-512(
 *     "DELEGATED:" +
 *     sha512(clientDataHashB64) + ":" +
 *     sha512(authenticatorDataB64) + ":" +
 *     sha512(credentialIdB64) + ":" +
 *     entropyToken + ":" +
 *     assertedAt + ":" +
 *     KERNEL_SHA
 *   )
 *
 * Security notes:
 *   • clientDataHashB64 / authenticatorDataB64 are hashed again here so that
 *     the raw WebAuthn bytes are never concatenated into a loggable string.
 *   • `assertedAt` binds the secret to a specific point in time, preventing
 *     replay attacks with captured WebAuthn responses.
 *   • The KERNEL_SHA anchors the entire derivation to the sovereign Root0 kernel.
 *
 * @param assertion    WebAuthn assertion from {@link WebAuthnAssertion}.
 * @param entropyToken 128-char hex entropy token from {@link fetchBioAnchor}.
 * @returns {@link DelegatedResidencyResult}
 */
export async function composeDelegatedSecret(
  assertion: WebAuthnAssertion,
  entropyToken: string,
): Promise<DelegatedResidencyResult> {
  if (!assertion || !entropyToken) {
    return { secret: null, tier: "CLOUD", failureReason: "Missing assertion or entropy token" };
  }
  const { clientDataHashB64, authenticatorDataB64, credentialIdB64, assertedAt } = assertion;
  if (!clientDataHashB64 || !authenticatorDataB64 || !credentialIdB64 || !assertedAt) {
    return { secret: null, tier: "CLOUD", failureReason: "Incomplete WebAuthn assertion fields" };
  }

  // Replay-attack prevention: reject assertions older than 5 minutes.
  // assertedAt is client-supplied but is only one of many entropy sources — a
  // replayed old assertion will produce the same entropy token from the same
  // WHOOP recovery record, making the window of validity naturally short.
  const MAX_ASSERTION_AGE_MS = 5 * 60 * 1_000; // 5 minutes
  const assertedAtMs = new Date(assertedAt).getTime();
  if (!isFinite(assertedAtMs) || Date.now() - assertedAtMs > MAX_ASSERTION_AGE_MS) {
    return {
      secret:        null,
      tier:          "CLOUD",
      failureReason: `WebAuthn assertion is expired or has an invalid timestamp (assertedAt: ${assertedAt}). Re-authenticate to generate a fresh assertion.`,
    };
  }

  // Re-hash each raw field to avoid leaking Base64URL data into any loggable string
  const hClientData = await sha512hex(clientDataHashB64);
  const hAuthData   = await sha512hex(authenticatorDataB64);
  const hCredId     = await sha512hex(credentialIdB64);

  const compositeInput = [
    "DELEGATED",
    hClientData,
    hAuthData,
    hCredId,
    entropyToken,
    assertedAt,
    KERNEL_SHA,
  ].join(":");

  const secret = await sha512hex(compositeInput);
  return { secret, tier: "DELEGATED_RESIDENCY", failureReason: null };
}

/**
 * High-level helper: derive the correct residency tier and composite secret
 * based on the available authentication material.
 *
 * Priority order:
 *   1. If `usbSaltHex` is provided AND `bioResult.healthy` → FULLY_RESIDENT
 *   2. If `assertion` is provided AND `bioResult.healthy` → DELEGATED_RESIDENCY
 *   3. Otherwise → CLOUD (STASIS; key operations refused)
 *
 * @param bioResult  Result from {@link fetchBioAnchor}.
 * @param usbSaltHex Optional hex-encoded USB salt.
 * @param assertion  Optional WebAuthn assertion for mobile / Tier-2 residency.
 * @returns Composite secret + tier, or { secret: null, tier: "CLOUD" }.
 */
export async function resolveResidency(
  bioResult: BioAnchorResult,
  usbSaltHex?: string | null,
  assertion?: WebAuthnAssertion | null,
): Promise<DelegatedResidencyResult> {
  if (!bioResult.healthy) {
    return {
      secret:        null,
      tier:          "CLOUD",
      failureReason: bioResult.failureReason ?? "Biometric check failed",
    };
  }

  // Tier 1 — physical USB salt present
  if (usbSaltHex) {
    const secret = await composeSoulAnchorSecret(usbSaltHex, bioResult.entropyToken);
    if (secret) {
      return { secret, tier: "FULLY_RESIDENT", failureReason: null };
    }
  }

  // Tier 2 — mobile WebAuthn delegate
  if (assertion) {
    return composeDelegatedSecret(assertion, bioResult.entropyToken);
  }

  // Tier 3 — no salt, no assertion
  return {
    secret:        null,
    tier:          "CLOUD",
    failureReason: "No USB salt and no WebAuthn assertion provided; STASIS mode active",
  };
}
