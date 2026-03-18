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
 * Cumulative count of HALT_BOOT events recorded by `watchdogPulse()` during
 * the lifetime of the current Worker process.  Resets on cold-start.
 *
 * Exported for inspection by API routes and the scheduled handler.
 */
export let haltCount = 0;

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
 * Execute a sovereign watchdog pulse.
 *
 * 1. Recomputes the kernel SHA-512 anchor and verifies it matches KERNEL_SHA.
 * 2. Increments `haltCount` if the anchor is not verified (drift detected).
 * 3. Persists a compact pulse record to SOVEREIGN_KV (if available).
 * 4. Returns a structured {@link WatchdogPulseResult} for logging / bubbling.
 *
 * @param env  Cloudflare Worker environment bindings.
 * @returns    Structured result describing the pulse outcome.
 */
export async function watchdogPulse(env?: WatchdogEnv): Promise<WatchdogPulseResult> {
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
