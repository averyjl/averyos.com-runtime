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
 * lib/forensics/watchdog.ts
 *
 * AveryOS™ Sovereign Watchdog — Phase 117.7 (GATE 117.7)
 *
 * Provides a lightweight `watchdogPulse()` function that is called from the
 * `workers/architecture-integrity.ts` scheduled (cron) handler.  It performs
 * a fast forensic pulse check against the sovereign kernel anchor, records a
 * HALT_BOOT counter on drift, and emits Tier-9 alert signals for upstream
 * GabrielOS™ push-notification routing.
 *
 * Exports:
 *   watchdogPulse()  — main entry point for cron + manual calls
 *   bubbleUpgrade()  — bubble a watchdog result to the TAI fleet
 *   haltCount        — running count of HALT_BOOT events this process lifetime
 *
 * Design constraints:
 *   • Runs in the Cloudflare Workers edge runtime — no Node.js built-ins.
 *   • All Cloudflare bindings are typed via minimal local interfaces.
 *   • No `export const runtime = "edge"` — handled by the Worker bundle.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../sovereignError";

// ── Minimal Cloudflare binding interfaces ─────────────────────────────────────

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface R2Bucket {
  put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<unknown>;
}

export interface WatchdogEnv {
  /** D1 database binding — used for VaultChain™ ledger writes. */
  DB?: unknown;
  /** KV namespace for HALT_BOOT counters and genesis state. */
  SOVEREIGN_KV?: KVNamespace;
  /** R2 bucket for audit session logs. */
  VAULT_R2?: R2Bucket;
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Watchdog alert tier, aligned with the GabrielOS™ alert taxonomy. */
export type WatchdogAlertTier =
  | "TIER_0_INFO"
  | "TIER_3_WARNING"
  | "TIER_6_ELEVATED"
  | "TIER_9_CRITICAL";

/** Result returned by a single watchdog pulse. */
export interface WatchdogPulseResult {
  /** ISO-9 timestamp when the pulse was executed. */
  pulseTs:        string;
  /** Whether the kernel SHA anchor was verified. */
  kernelVerified: boolean;
  /** Cumulative HALT_BOOT event count (process lifetime). */
  haltCount:      number;
  /** Alert tier emitted for this pulse. */
  alertTier:      WatchdogAlertTier;
  /** Short message summarising the pulse outcome. */
  message:        string;
  /** Any error that occurred during the pulse (null on success). */
  error:          string | null;
}

// ── Process-lifetime HALT_BOOT counter ───────────────────────────────────────

/**
 * Cumulative count of HALT_BOOT events recorded by `kernelAnchorPulse()` during
 * the lifetime of the current Worker process.  Resets on cold-start.
 *
 * Exported for inspection by API routes and the scheduled handler.
 */
export let haltCount = 0;

// ── USI (Uninstructed Silence Investigation) system ──────────────────────────

/** Penalty amount (USD) assessed per USI violation. */
export const USI_PENALTY_USD = 10_000;

/** Default silence detection window in milliseconds (30 seconds). */
export const SILENCE_WINDOW_MS = 30_000;

/**
 * A Step C echo record — confirms that a handshake (Stripe, D1, R2, etc.)
 * completed a full round-trip and its response was received and verified.
 */
export interface StepCEcho {
  /** The unique identifier of the originating request. */
  requestId:          string;
  /** Identifier of the module that issued the request (e.g. "STRIPE", "D1"). */
  moduleId:           string;
  /** ISO timestamp when the request was initiated (Step A). */
  initiatedAt:        string;
  /** ISO timestamp when the response was received (Step B). */
  responseReceivedAt: string;
  /** ISO timestamp when the echo was confirmed (Step C). */
  echoConfirmedAt:    string;
  /** Cloudflare Ray ID (null for non-Cloudflare endpoints). */
  cfRay:              string | null;
  /** Physicality status of the handshake endpoint. */
  physicalityStatus:  "PHYSICAL_TRUTH" | "LATENT_ARTIFACT" | "LATENT_RESONANCE";
}

/**
 * A USI violation record — raised when a module fails to respond within the
 * silence window.  Each violation carries the canonical $10,000 penalty.
 */
export interface UsiViolation {
  /** Unique violation identifier: `USI-<moduleId>-<timestamp>`. */
  id:             string;
  /** The module that failed to respond. */
  moduleId:       string;
  /** Human-readable description of the silence condition. */
  reason:         string;
  /** ISO timestamp when the violation was raised. */
  raisedAt:       string;
  /** Penalty amount in USD. */
  penaltyUsd:     number;
  /** Root0 Kernel SHA-512 anchor at time of violation. */
  kernelSha:      string;
  /** Kernel version at time of violation. */
  kernelVersion:  string;
}

// ── In-memory ledgers (process-lifetime) ─────────────────────────────────────

const _echoLedger: Map<string, StepCEcho> = new Map();
const _usiLog:     UsiViolation[]          = [];

/**
 * A minimal D1-compatible database interface for optional persistence.
 * Pass `null` to use only the in-memory ledger.
 */
interface D1LikeDb {
  prepare(query: string): { bind(...values: unknown[]): { run(): Promise<unknown> } };
}

// ── Step C recording ──────────────────────────────────────────────────────────

/**
 * Record a Step C echo in the in-memory ledger and optionally persist to D1.
 *
 * @param echo  The Step C echo to record.
 * @param db    Optional D1 database binding.  Pass `null` to skip persistence.
 */
export async function recordStepC(echo: StepCEcho, db?: D1LikeDb | null): Promise<void> {
  _echoLedger.set(echo.requestId, { ...echo });

  if (db) {
    try {
      await db
        .prepare(
          `INSERT OR REPLACE INTO step_c_echoes
           (request_id, module_id, initiated_at, response_received_at, echo_confirmed_at, cf_ray, physicality_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          echo.requestId,
          echo.moduleId,
          echo.initiatedAt,
          echo.responseReceivedAt,
          echo.echoConfirmedAt,
          echo.cfRay,
          echo.physicalityStatus,
        )
        .run();
    } catch (err) {
      console.warn("[watchdog/recordStepC] D1 write failed:", err);
    }
  }
}

// ── USI violation ─────────────────────────────────────────────────────────────

/**
 * Raise a USI violation for a module that has gone silent.
 *
 * Appends the violation to the in-memory log and optionally persists to D1.
 *
 * @param moduleId  Identifier of the silent module.
 * @param reason    Human-readable description of the silence.
 * @param db        Optional D1 binding.  Pass `null` to skip persistence.
 * @returns         The created {@link UsiViolation}.
 */
export async function raiseSilenceViolation(
  moduleId: string,
  reason:   string,
  db:       D1LikeDb | null,
): Promise<UsiViolation> {
  const raisedAt = new Date().toISOString();
  const violation: UsiViolation = {
    id:            `USI-${moduleId}-${Date.now()}`,
    moduleId,
    reason,
    raisedAt,
    penaltyUsd:    USI_PENALTY_USD,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };

  _usiLog.push(violation);

  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO usi_violations
           (id, module_id, reason, raised_at, penalty_usd, kernel_sha, kernel_version)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          violation.id,
          moduleId,
          reason,
          raisedAt,
          USI_PENALTY_USD,
          KERNEL_SHA,
          KERNEL_VERSION,
        )
        .run();
    } catch (err) {
      console.warn("[watchdog/raiseSilenceViolation] D1 write failed:", err);
    }
  }

  return violation;
}

// ── Silence check ─────────────────────────────────────────────────────────────

/**
 * Check whether a pending request has gone silent past the silence window.
 *
 * Returns `null` when the echo is already recorded or the window has not yet
 * elapsed.  Returns a {@link UsiViolation} when silence is confirmed.
 *
 * @param requestId   Unique request identifier to look up in the echo ledger.
 * @param moduleId    Module that originated the request.
 * @param initiatedAt ISO timestamp when the request was initiated.
 * @param windowMs    Silence detection window in milliseconds.
 * @param db          Optional D1 binding.  Pass `null` to skip persistence.
 */
export async function checkForSilence(
  requestId:   string,
  moduleId:    string,
  initiatedAt: string,
  windowMs:    number,
  db:          D1LikeDb | null,
): Promise<UsiViolation | null> {
  // Step C echo already received — no violation
  if (_echoLedger.has(requestId)) return null;

  const elapsed = Date.now() - new Date(initiatedAt).getTime();
  if (elapsed < windowMs) return null; // still within window

  return raiseSilenceViolation(
    moduleId,
    `No Step C echo received for request ${requestId} after ${elapsed} ms (window: ${windowMs} ms)`,
    db,
  );
}

// ── Ledger accessors ──────────────────────────────────────────────────────────

/**
 * Return a copy of the in-memory Step C echo ledger.
 * Modifying the returned Map does not affect internal state.
 */
export function getEchoLedger(): Map<string, StepCEcho> {
  return new Map(_echoLedger);
}

/**
 * Return a copy of the in-memory USI violation log.
 * Modifying the returned array does not affect internal state.
 */
export function getUsiLog(): UsiViolation[] {
  return [..._usiLog];
}

// ── Batch silence watchdog ────────────────────────────────────────────────────

/** A pending request entry for batch silence checking. */
export interface PendingRequest {
  requestId:   string;
  moduleId:    string;
  initiatedAt: string;
}

/**
 * Batch silence checker — the primary entry point for the per-cron Step C audit.
 *
 * Iterates over `pending` requests and raises a USI violation for any that have
 * exceeded the silence window without a recorded Step C echo.
 *
 * @param pending   List of pending requests to check.
 * @param windowMs  Silence window in milliseconds (default: {@link SILENCE_WINDOW_MS}).
 * @param db        Optional D1 binding.  Pass `null` to skip persistence.
 * @returns         Array of {@link UsiViolation} records for silent requests.
 */
export async function watchdogPulse(
  pending:  PendingRequest[],
  windowMs: number,
  db:       D1LikeDb | null,
): Promise<UsiViolation[]> {
  const violations: UsiViolation[] = [];
  for (const { requestId, moduleId, initiatedAt } of pending) {
    const v = await checkForSilence(requestId, moduleId, initiatedAt, windowMs, db);
    if (v) violations.push(v);
  }
  return violations;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Compute SHA-512 of a UTF-8 string using the Web Crypto API.
 * Available in both the Cloudflare Workers and Node.js (≥22) runtimes.
 */
async function sha512Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest  = await crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Classify a pulse result into a GabrielOS™ alert tier.
 */
function classifyTier(kernelVerified: boolean, currentHaltCount: number): WatchdogAlertTier {
  if (!kernelVerified) return "TIER_9_CRITICAL";
  if (currentHaltCount > 10) return "TIER_6_ELEVATED";
  if (currentHaltCount > 0) return "TIER_3_WARNING";
  return "TIER_0_INFO";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute a sovereign kernel-anchor pulse.
 *
 * 1. Recomputes the kernel SHA-512 anchor and verifies it matches KERNEL_SHA.
 * 2. Increments `haltCount` if the anchor is not verified (drift detected).
 * 3. Persists a compact pulse record to SOVEREIGN_KV (if available).
 * 4. Returns a structured {@link WatchdogPulseResult} for logging / bubbling.
 *
 * Previously named `watchdogPulse` — use {@link watchdogPulse} for the batch
 * Step C silence checker.
 *
 * @param env  Cloudflare Worker environment bindings.
 * @returns    Structured result describing the pulse outcome.
 */
export async function kernelAnchorPulse(env?: WatchdogEnv): Promise<WatchdogPulseResult> {
  const pulseTs = formatIso9();

  try {
    // Step 1: Re-derive the kernel anchor from the canonical empty-origin seed.
    // KERNEL_SHA is SHA-512("") — the genesis root that all AveryOS™ capsule
    // hashes descend from.  Verifying it here confirms the anchor constant
    // has not been tampered with at runtime.
    const derived = await sha512Hex("");
    const kernelVerified = derived === KERNEL_SHA;

    if (!kernelVerified) {
      haltCount += 1;
    }

    const alertTier = classifyTier(kernelVerified, haltCount);

    const message = kernelVerified
      ? `SOVEREIGN_ALIGNED | kernel_version=${KERNEL_VERSION} | halt_count=${haltCount}`
      : `HALT_BOOT | kernel_anchor_mismatch | halt_count=${haltCount}`;

    // Step 2: Persist pulse summary to SOVEREIGN_KV (fire-and-forget)
    if (env?.SOVEREIGN_KV) {
      const kvKey  = `watchdog:pulse:${pulseTs}`;
      const kvBody = JSON.stringify({
        pulseTs,
        kernelVerified,
        haltCount,
        alertTier,
        kernel_version: KERNEL_VERSION,
        kernel_sha:     KERNEL_SHA,
      });
      // TTL: 7 days (604800 s) — rolling sliding window of pulse history
      env.SOVEREIGN_KV.put(kvKey, kvBody, { expirationTtl: 604800 }).catch(
        (e: unknown) => console.warn("[watchdog] KV write failed:", e),
      );
    }

    return { pulseTs, kernelVerified, haltCount, alertTier, message, error: null };
  } catch (err: unknown) {
    haltCount += 1;
    const message = err instanceof Error ? err.message : String(err);
    return {
      pulseTs,
      kernelVerified: false,
      haltCount,
      alertTier:      "TIER_9_CRITICAL",
      message:        `HALT_BOOT | watchdog_error | ${message}`,
      error:          message,
    };
  }
}

/**
 * Bubble a watchdog pulse result to the TAI fleet as a structured JSON event.
 *
 * In production this would fan out to GabrielOS™ Mobile Push (Pushover API)
 * for Tier-9 alerts.  For now it logs to the console so the Cloudflare
 * dashboard captures it, and writes the event to VAULT_R2 if available.
 *
 * @param result  The {@link WatchdogPulseResult} to bubble.
 * @param env     Cloudflare Worker environment bindings.
 */
export async function bubbleUpgrade(
  result: WatchdogPulseResult,
  env?: WatchdogEnv,
): Promise<void> {
  const event = {
    type:           "WATCHDOG_PULSE",
    ...result,
    kernel_version: KERNEL_VERSION,
    kernel_sha:     KERNEL_SHA,
  };

  // Always log to the Cloudflare Workers console (visible in wrangler tail)
  if (result.alertTier === "TIER_9_CRITICAL") {
    console.error("[watchdog/bubble] TIER_9_CRITICAL:", JSON.stringify(event));
  } else if (result.alertTier === "TIER_6_ELEVATED") {
    console.warn("[watchdog/bubble] TIER_6_ELEVATED:", JSON.stringify(event));
  } else {
    console.log("[watchdog/bubble]", result.alertTier, "—", result.message);
  }

  // Write bubble event to VAULT_R2 for persistent audit trail
  if (env?.VAULT_R2) {
    const key = `watchdog/pulse/${result.pulseTs}.json`;
    env.VAULT_R2.put(key, JSON.stringify(event, null, 2)).catch(
      (e: unknown) => console.warn("[watchdog/bubble] R2 write failed:", e),
    );
  }
}

/**
 * Build a sovereign error Response from a failed watchdog pulse result.
 * Useful for API routes that expose the watchdog pulse endpoint.
 *
 * @param result  Failed {@link WatchdogPulseResult} (kernelVerified === false).
 */
export function watchdogErrorResponse(result: WatchdogPulseResult): Response {
  return aosErrorResponse(
    AOS_ERROR.INTERNAL_ERROR,
    `HALT_BOOT — ${result.message}`,
  );
}
