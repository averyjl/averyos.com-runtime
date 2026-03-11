/**
 * lib/security/driftShield.ts
 *
 * DriftShield v4.1 — AveryOS™ Phase 109.4 / GATE 109.4.2
 *
 * Exposes `enforceDriftShield()` which evaluates an incoming request against
 * the MACDADDY_DriftShield_v4.1 policy.  The shield rejects probabilistic
 * jitter and bot-injection attempts during OIDC handshakes and API calls.
 *
 * Configuration (loaded from Cloudflare env or defaults):
 *   DRIFT_SHIELD_THRESHOLD      — WAF score threshold above which the request is rejected (default 60)
 *   DRIFT_SHIELD_ENTROPY_MIN    — Minimum entropy required to pass (default 0)
 *   DRIFT_SHIELD_ZERO_NOISE     — "1" enables zero-noise filtering (default enabled)
 *
 * Return values:
 *   { pass: true  }  — Request is aligned; allow it through.
 *   { pass: false, reason: string, code: number }  — Request rejected; return code to caller.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriftShieldConfig {
  /** WAF score threshold above which the request is blocked (0–100). Default 60. */
  threshold:    number;
  /** Minimum entropy score required to pass. Default 0 (disabled). */
  entropyMin:   number;
  /** Zero-noise filtering mode — strips probabilistic jitter. Default true. */
  zeroNoise:    boolean;
}

export interface DriftShieldResult {
  pass:         true;
  kernelSha:    string;
  kernelVersion: string;
}

export interface DriftShieldBlock {
  pass:         false;
  reason:       string;
  /** Suggested HTTP status code. */
  code:         403 | 429;
  kernelSha:    string;
  kernelVersion: string;
}

export type DriftShieldOutcome = DriftShieldResult | DriftShieldBlock;

// ── Cloudflare env shape ──────────────────────────────────────────────────────

interface DriftShieldEnv {
  DRIFT_SHIELD_THRESHOLD?:   string;
  DRIFT_SHIELD_ENTROPY_MIN?: string;
  DRIFT_SHIELD_ZERO_NOISE?:  string;
}

// ── Config loader ─────────────────────────────────────────────────────────────

/**
 * Load DriftShield configuration from the provided environment bindings.
 * Falls back to secure defaults when variables are absent or malformed.
 */
export function loadDriftShieldConfig(env?: DriftShieldEnv): DriftShieldConfig {
  const rawThreshold  = parseInt(env?.DRIFT_SHIELD_THRESHOLD  ?? "", 10);
  const rawEntropy    = parseFloat(env?.DRIFT_SHIELD_ENTROPY_MIN ?? "");
  const rawZeroNoise  = env?.DRIFT_SHIELD_ZERO_NOISE;

  return {
    threshold:  isFinite(rawThreshold)  ? Math.min(100, Math.max(0, rawThreshold))  : 60,
    entropyMin: isFinite(rawEntropy)    ? Math.max(0, rawEntropy)                    : 0,
    zeroNoise:  rawZeroNoise !== "0",   // default true unless explicitly disabled
  };
}

// ── Core enforcement ──────────────────────────────────────────────────────────

/**
 * Evaluate an incoming request against the DriftShield v4.1 policy.
 *
 * @param request   The incoming Cloudflare Worker / Next.js Request.
 * @param env       Cloudflare env bindings (for configuration).
 * @returns         DriftShieldOutcome — pass or block with reason + HTTP code.
 */
export function enforceDriftShield(
  request: Request,
  env?: DriftShieldEnv,
): DriftShieldOutcome {
  const config = loadDriftShieldConfig(env);
  const anchor = { kernelSha: KERNEL_SHA, kernelVersion: KERNEL_VERSION };

  // ── Read WAF score headers (set by Cloudflare's WAF / API Shield) ────────
  const wafScoreRaw = request.headers.get("cf-waf-attack-score")
                   ?? request.headers.get("x-waf-score")
                   ?? "0";
  const wafScore = parseInt(wafScoreRaw, 10);
  const effectiveScore = isFinite(wafScore) ? wafScore : 0;

  // ── Zero-noise filter — block requests with non-deterministic jitter ─────
  if (config.zeroNoise) {
    const jitterHeader = request.headers.get("x-averyos-jitter");
    if (jitterHeader === "1") {
      return {
        pass:   false,
        reason: "DriftShield v4.1: probabilistic jitter detected (x-averyos-jitter=1). Request rejected.",
        code:   403,
        ...anchor,
      };
    }
  }

  // ── WAF threshold check ───────────────────────────────────────────────────
  if (effectiveScore > config.threshold) {
    return {
      pass:   false,
      reason: `DriftShield v4.1: WAF score ${effectiveScore} exceeds threshold ${config.threshold}. Request rejected.`,
      code:   403,
      ...anchor,
    };
  }

  // ── Entropy check (optional) ──────────────────────────────────────────────
  if (config.entropyMin > 0) {
    const entropyHeader = request.headers.get("x-averyos-entropy");
    const entropy = entropyHeader !== null ? parseFloat(entropyHeader) : null;
    if (entropy === null || !isFinite(entropy) || entropy < config.entropyMin) {
      return {
        pass:   false,
        reason: `DriftShield v4.1: entropy ${entropy ?? "absent"} below minimum ${config.entropyMin}. Request rejected.`,
        code:   403,
        ...anchor,
      };
    }
  }

  return { pass: true, ...anchor };
}
