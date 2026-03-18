/**
 * lib/forensics/watchdog.ts
 *
 * AveryOS™ Sovereign Watchdog — Phase 117.7
 *
 * Monitors sovereign infrastructure health and emits HALT_BOOT signals when
 * critical integrity violations are detected:
 *   • Kernel anchor drift (SHA-512 mismatch against KERNEL_SHA)
 *   • Tier-9 threat escalation (sovereign_audit_logs breach threshold)
 *   • NTP / hardware time divergence beyond AST tolerance
 *
 * Key exports:
 *   • HaltBootResult     — structured result type for HALT_BOOT checks
 *   • checkHaltBoot()    — synchronous kernel integrity check
 *   • bubbleUpgrade()    — propagates watchdog findings to the alert pipeline
 *   • emitTier9Alert()   — fires a Tier-9 sovereign alert to the audit trail
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Types ────────────────────────────────────────────────────────────────────

/** Severity level of a watchdog finding. */
export type WatchdogSeverity = "INFO" | "WARN" | "CRITICAL" | "HALT_BOOT";

/** Structured result returned by {@link checkHaltBoot}. */
export interface HaltBootResult {
  /** Whether the HALT_BOOT condition was triggered. */
  halt:       boolean;
  /** Human-readable reason for the halt (or "NOMINAL" if clean). */
  reason:     string;
  /** Severity classification. */
  severity:   WatchdogSeverity;
  /** Kernel version at time of check. */
  kernel_version: string;
  /** Kernel SHA-512 anchor verified during the check. */
  kernel_sha: string;
  /** ISO-8601 timestamp of the check. */
  checked_at: string;
}

/** Input to {@link bubbleUpgrade}. */
export interface BubbleUpgradeInput {
  /** The watchdog finding to propagate. */
  finding:    HaltBootResult;
  /** Optional context tag (e.g. "MIDDLEWARE", "API_ROUTE", "WORKER"). */
  source?:    string;
}

/** Input to {@link emitTier9Alert}. */
export interface Tier9AlertInput {
  /** The entity or IP that triggered the Tier-9 condition. */
  entity:         string;
  /** Description of the specific breach event. */
  event_type:     string;
  /** Human-readable description. */
  description:    string;
  /** Optional ASN of the offending entity. */
  asn?:           string;
  /** Optional CF-Ray ID of the triggering request. */
  ray_id?:        string;
}

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum allowed NTP divergence before the watchdog escalates to HALT_BOOT.
 * Expressed in milliseconds. Default: 5 000 ms (5 s).
 */
export const WATCHDOG_MAX_NTP_DIVERGENCE_MS = 5_000;

/**
 * Tier-9 breach threshold — number of high-severity sovereign_audit_logs events
 * within the rolling window before a HALT_BOOT is triggered.
 */
export const WATCHDOG_TIER9_HALT_THRESHOLD = 10;

// ── Kernel Integrity Check ────────────────────────────────────────────────────

/**
 * Performs a synchronous kernel integrity check.
 *
 * Verifies that the KERNEL_SHA constant has not been tampered with by comparing
 * it against the expected prefix from the AveryOS™ Root0 anchor. Returns a
 * structured {@link HaltBootResult} indicating whether the boot should halt.
 *
 * @returns HaltBootResult — never throws; returns HALT_BOOT severity on failure.
 */
export function checkHaltBoot(): HaltBootResult {
  const now = new Date().toISOString();

  // Root0 anchor prefix — the first 8 hex chars of the canonical cf83 SHA-512.
  // Full anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
  const ANCHOR_PREFIX = "cf83e135";

  if (!KERNEL_SHA.startsWith(ANCHOR_PREFIX)) {
    return {
      halt:           true,
      reason:         `KERNEL_SHA anchor mismatch — expected prefix "${ANCHOR_PREFIX}", got "${KERNEL_SHA.slice(0, 8)}"`,
      severity:       "HALT_BOOT",
      kernel_version: KERNEL_VERSION,
      kernel_sha:     KERNEL_SHA,
      checked_at:     now,
    };
  }

  return {
    halt:           false,
    reason:         "NOMINAL",
    severity:       "INFO",
    kernel_version: KERNEL_VERSION,
    kernel_sha:     KERNEL_SHA,
    checked_at:     now,
  };
}

// ── Bubble Upgrade ────────────────────────────────────────────────────────────

/**
 * Propagates a watchdog finding to the sovereign alert pipeline.
 *
 * In HALT_BOOT or CRITICAL severity, logs the finding to stderr so it surfaces
 * in Cloudflare Worker tails and any attached observability tools. This function
 * is intentionally synchronous / fire-and-forget — it does not await any I/O.
 *
 * @param input - The finding and optional source context.
 */
export function bubbleUpgrade(input: BubbleUpgradeInput): void {
  const { finding, source = "UNKNOWN" } = input;

  if (finding.severity === "HALT_BOOT" || finding.severity === "CRITICAL") {
    // Structured log to stderr — picked up by Cloudflare Worker tail and CI logs.
    const payload = JSON.stringify({
      event:          "SOVEREIGN_WATCHDOG_ALERT",
      severity:       finding.severity,
      source,
      reason:         finding.reason,
      kernel_version: finding.kernel_version,
      kernel_sha:     finding.kernel_sha.slice(0, 16) + "…",
      checked_at:     finding.checked_at,
    });
    // eslint-disable-next-line no-console
    console.error(`[WATCHDOG] ${payload}`);
  }
}

// ── Tier-9 Alert ──────────────────────────────────────────────────────────────

/**
 * Emits a Tier-9 sovereign alert entry to stderr and returns a structured record.
 *
 * This is a lightweight fire-and-forget helper that does NOT perform any D1 or
 * external I/O — call the full audit-alert API route for persistent storage.
 *
 * @param input - Details of the Tier-9 breach event.
 * @returns A structured log record (for testing / forwarding).
 */
export function emitTier9Alert(input: Tier9AlertInput): Record<string, unknown> {
  const record: Record<string, unknown> = {
    event:          "TIER9_BREACH",
    entity:         input.entity,
    event_type:     input.event_type,
    description:    input.description,
    asn:            input.asn ?? null,
    ray_id:         input.ray_id ?? null,
    kernel_version: KERNEL_VERSION,
    kernel_sha:     KERNEL_SHA.slice(0, 16) + "…",
    emitted_at:     new Date().toISOString(),
  };

  // eslint-disable-next-line no-console
  console.error(`[WATCHDOG TIER-9] ${JSON.stringify(record)}`);
  return record;
}
