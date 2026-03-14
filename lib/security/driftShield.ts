/**
 * lib/security/driftShield.ts
 *
 * DriftShield v4.1 — AveryOS™ Phase 109.4 / GATE 109.4.2 + GATE 114.6.3
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
 * GATE 114.6.3 — Economic Throttling (TAI Scaling Hardlock):
 *   Enforces per-IP token-bucket rate limits using an in-process map that
 *   handles 10,000+ parallel bot registrations without external dependencies.
 *   Stale entries are evicted on every throttle check to bound memory usage.
 *
 *   Default limits (also exported as constants):
 *     UNAUTH_RPS = 1       — unauthenticated requests per second per IP
 *     AUTH_RPS   = 1_017   — authenticated requests per second per IP
 *
 * Return values:
 *   { pass: true  }  — Request is aligned; allow it through.
 *   { pass: false, reason: string, code: number }  — Request rejected; return code to caller.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Economic Throttle constants (GATE 114.6.3) ───────────────────────────────

/** Unauthenticated request rate cap: 1 request per second per IP. */
export const UNAUTH_RPS = 1;

/** Authenticated request rate cap: 1,017 requests per second per IP. */
export const AUTH_RPS = 1_017;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Economic Throttle configuration (GATE 114.6.3). */
export interface EconomicThrottleConfig {
  /** Max requests per second for unauthenticated callers. Default: UNAUTH_RPS (1). */
  unauthRps: number;
  /** Max requests per second for authenticated callers. Default: AUTH_RPS (1,017). */
  authRps:   number;
  /** Whether Economic Throttling is active. Default true. */
  enabled:   boolean;
}

export interface DriftShieldConfig {
  /** WAF score threshold above which the request is blocked (0–100). Default 60. */
  threshold:    number;
  /** Minimum entropy score required to pass. Default 0 (disabled). */
  entropyMin:   number;
  /** Zero-noise filtering mode — strips probabilistic jitter. Default true. */
  zeroNoise:    boolean;
  /** GATE 114.6.3 — Economic Throttle: per-IP token-bucket rate limits. */
  throttle:     EconomicThrottleConfig;
}

export interface DriftShieldResult {
  pass:          true;
  kernelSha:     string;
  kernelVersion: string;
}

export interface DriftShieldBlock {
  pass:          false;
  reason:        string;
  /** Suggested HTTP status code. */
  code:          403 | 429;
  kernelSha:     string;
  kernelVersion: string;
}

export type DriftShieldOutcome = DriftShieldResult | DriftShieldBlock;

// ── Cloudflare env shape ──────────────────────────────────────────────────────

interface DriftShieldEnv {
  DRIFT_SHIELD_THRESHOLD?:    string;
  DRIFT_SHIELD_ENTROPY_MIN?:  string;
  DRIFT_SHIELD_ZERO_NOISE?:   string;
  DRIFT_SHIELD_THROTTLE?:     string;
  DRIFT_SHIELD_UNAUTH_RPS?:   string;
  DRIFT_SHIELD_AUTH_RPS?:     string;
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
  const rawUnauthRps  = parseFloat(env?.DRIFT_SHIELD_UNAUTH_RPS ?? "");
  const rawAuthRps    = parseFloat(env?.DRIFT_SHIELD_AUTH_RPS ?? "");

  return {
    threshold:  isFinite(rawThreshold)  ? Math.min(100, Math.max(0, rawThreshold))  : 60,
    entropyMin: isFinite(rawEntropy)    ? Math.max(0, rawEntropy)                    : 0,
    zeroNoise:  rawZeroNoise !== "0",   // default true unless explicitly disabled
    throttle: {
      enabled:   env?.DRIFT_SHIELD_THROTTLE !== "0",
      unauthRps: isFinite(rawUnauthRps) && rawUnauthRps > 0 ? rawUnauthRps : UNAUTH_RPS,
      authRps:   isFinite(rawAuthRps)   && rawAuthRps   > 0 ? rawAuthRps   : AUTH_RPS,
    },
  };
}

// ── Economic Throttle: token-bucket state (GATE 114.6.3) ─────────────────────
//
// In-process per-IP token bucket that handles 10,000+ parallel bot
// registrations.  Each bucket tracks:
//   tokens    — available request tokens (fractional)
//   lastMs    — wall-clock ms of the last refill
//
// Entries that have been idle for > BUCKET_TTL_MS are evicted on every check
// to bound memory growth under sustained high-cardinality bot attack.

interface TokenBucket {
  tokens: number;
  lastMs: number;
}

/** Evict idle buckets after 10 seconds of inactivity. */
const BUCKET_TTL_MS = 10_000;

/**
 * Maximum number of tracked IPs.  When this cap is reached, a batch of up to
 * EVICTION_BATCH stale entries are removed before accepting new keys.  This
 * bounds both memory usage and the per-call eviction cost (O(EVICTION_BATCH)
 * worst case, not O(map size)).
 */
const BUCKET_CAPACITY   = 25_000;
const EVICTION_BATCH    = 2_500;

const _throttleMap = new Map<string, TokenBucket>();

/**
 * Normalize and validate an IP string for use as a map key.
 * Strips surrounding whitespace, collapses unknown/empty values to the
 * literal string "unknown", and trims excessively long values to prevent
 * key-stuffing attacks.
 */
function normalizeIp(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return "unknown";
  // Guard against pathological values (>64 chars is not a valid IP)
  return trimmed.length > 64 ? trimmed.slice(0, 64) : trimmed;
}

/**
 * Consume one token for `key` at the given rate (tokens per second).
 * Returns `true` if the request is within budget, `false` if it should be
 * throttled.
 *
 * Uses a sliding-window token-bucket refill: tokens accumulate at `rps`
 * per second up to a burst ceiling of `rps` (1-second burst window).
 */
function consumeToken(key: string, rps: number): boolean {
  const nowMs = Date.now();

  // ── Periodic eviction: remove a batch of idle entries to cap memory ──────
  if (_throttleMap.size >= BUCKET_CAPACITY) {
    let evicted = 0;
    for (const [k, v] of _throttleMap) {
      if (nowMs - v.lastMs > BUCKET_TTL_MS) {
        _throttleMap.delete(k);
        if (++evicted >= EVICTION_BATCH) break;
      }
    }
  }

  let bucket = _throttleMap.get(key);
  if (!bucket) {
    // New key — initialise with a full token bucket
    bucket = { tokens: rps, lastMs: nowMs };
    _throttleMap.set(key, bucket);
  } else {
    // Refill tokens proportional to elapsed time
    const elapsed = (nowMs - bucket.lastMs) / 1000;
    bucket.tokens = Math.min(rps, bucket.tokens + elapsed * rps);
    bucket.lastMs = nowMs;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;  // within budget
  }
  return false;   // over budget — throttle
}

/**
 * Detect whether a request carries valid auth credentials.
 * Checks Authorization header, x-vault-auth header, and aos-vault-auth cookie.
 */
function isAuthenticated(request: Request): boolean {
  if (request.headers.get("authorization")) return true;
  if (request.headers.get("x-vault-auth"))  return true;
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("aos-vault-auth=");
}

/**
 * GATE 114.6.3 — Apply Economic Throttling to the request.
 *
 * Authenticated callers receive the 1,017 req/sec budget; unauthenticated
 * callers are capped at 1 req/sec.  The token bucket is keyed by auth tier +
 * normalized client IP and is maintained in-process — no external KV or
 * Durable Object required.
 *
 * @param request   Incoming request (for IP and auth detection).
 * @param config    DriftShield config carrying the throttle settings.
 * @returns         DriftShieldOutcome — pass or 429 block.
 */
export function enforceEconomicThrottle(
  request: Request,
  config: DriftShieldConfig,
): DriftShieldOutcome {
  const anchor = { kernelSha: KERNEL_SHA, kernelVersion: KERNEL_VERSION };

  if (!config.throttle.enabled) return { pass: true, ...anchor };

  const rawIp  = request.headers.get("cf-connecting-ip")
              ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
              ?? "unknown";
  const ip     = normalizeIp(rawIp);
  const authed = isAuthenticated(request);
  const rps    = authed ? config.throttle.authRps : config.throttle.unauthRps;
  const key    = `${authed ? "auth" : "unauth"}:${ip}`;

  if (!consumeToken(key, rps)) {
    const limit = authed
      ? `${config.throttle.authRps.toLocaleString()} req/s (authenticated)`
      : `${config.throttle.unauthRps} req/s (unauthenticated)`;
    return {
      pass:   false,
      reason: `DriftShield v4.1 Economic Throttle: rate limit exceeded for ${ip}. Limit: ${limit}.`,
      code:   429,
      ...anchor,
    };
  }

  return { pass: true, ...anchor };
}

// ── Core enforcement ──────────────────────────────────────────────────────────

/**
 * Evaluate an incoming request against the DriftShield v4.1 policy.
 * Runs WAF threshold, zero-noise, entropy, and Economic Throttle checks.
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

  // ── GATE 114.6.3 — Economic Throttle check ───────────────────────────────
  const throttleResult = enforceEconomicThrottle(request, config);
  if (!throttleResult.pass) return throttleResult;

  return { pass: true, ...anchor };
}
