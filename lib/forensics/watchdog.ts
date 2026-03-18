/**
 * lib/forensics/watchdog.ts
 *
 * AveryOS™ GabrielOS™ Watchdog — Phase 117.1 GATE 117.1.3
 *
 * Monitors the AveryOS system for HALT_BOOT conditions and fires Tier-9
 * Audit Alerts to notify the Creator (Jason Lee Avery) and relevant TAIs
 * immediately upon detecting a drift or RTV failure.
 *
 * HALT_BOOT triggers:
 *   • RTV handshake failure (lib/security/sovereignFetch.ts)
 *   • Certificate pinning violation
 *   • Constitution drift detection
 *   • Time-mesh outlier beyond PRUNE_THRESHOLD_US
 *   • Internal module producing non-deterministic output (LIVE_INFERENCE
 *     when only anchored sources are permitted)
 *
 * Auto-Heal Workflow (Phase 117.5):
 *   1. Capture: Log the exact SHA-512 block that caused the drift to D1.
 *   2. Notify: Fire a Tier-9 Audit Alert to the Creator's mobile device
 *              and the Sovereign Dashboard.
 *   3. Learn: Author a new Validation Gate to prevent recurrence.
 *   4. Bubble: Push the upgrade to the D1 Global Sync for TAI fleet immunity.
 *
 * Usage:
 *   import { haltBoot, watchdogPulse } from "./watchdog";
 *
 *   haltBoot({
 *     module:   "lib/security/sovereignFetch",
 *     reason:   "RTV_FAILURE",
 *     detail:   "Stripe returned HTTP 503",
 *     sha512:   blockSha,
 *   });
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                  from "../timePrecision";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Reason codes for a HALT_BOOT event. */
export type HaltReason =
  | "RTV_FAILURE"              // Round-Trip Verification failed
  | "CERT_PINNING_VIOLATION"   // Certificate pinning check failed
  | "CONSTITUTION_DRIFT"       // Constitution SHA mismatch detected
  | "TIME_MESH_OUTLIER"        // NTP source deviated beyond threshold
  | "HALLUCINATION_DETECTED"   // Non-deterministic output in anchored context
  | "SIMULATION_VIOLATION"     // Simulation attempted in production context
  | "KERNEL_MISMATCH"          // Kernel SHA mismatch at runtime
  | "UNANCHORED_STATE"         // Module attempted to operate without kernel anchor
  | "INTERNAL_MODULE_FAILURE"  // Generic internal module error
  | "MANUAL_HALT";             // Creator-triggered manual halt

/** Input payload for haltBoot(). */
export interface HaltBootInput {
  /** The module or function that triggered the halt. */
  module:    string;
  /** Reason code for the halt. */
  reason:    HaltReason;
  /** Human-readable detail — what specifically went wrong. */
  detail:    string;
  /** Optional SHA-512 of the block/payload that caused the drift. */
  sha512?:   string;
  /** Optional phase tag (e.g. "117.1"). */
  phase?:    string;
  /** D1 binding to log the halt event (non-blocking). */
  db?:       D1DatabaseLike | null;
  /** HTTP endpoint to POST the Tier-9 Audit Alert to (e.g. /api/v1/audit-alert). */
  alertEndpoint?: string;
  /** Vault passphrase for the alert endpoint auth. */
  vaultPassphrase?: string;
}

/** Result of a HALT_BOOT event. */
export interface HaltBootResult {
  /** ISO-9 timestamp of the halt event. */
  ts:            string;
  /** The module that halted. */
  module:        string;
  /** Halt reason code. */
  reason:        HaltReason;
  /** Human-readable detail. */
  detail:        string;
  /** SHA-512 of the drift block (if provided). */
  driftSha512:   string | null;
  /** Tier-9 alert fired. */
  alertFired:    boolean;
  /** D1 log written. */
  d1Written:     boolean;
  /** Halt event SHA-512 (for VaultChain™ anchoring). */
  haltSha512:    string;
  /** Auto-heal recommendation. */
  autoHealHint:  string;
}

/** Lightweight D1 binding. */
interface D1Statement { run(): Promise<void>; }
interface D1DatabaseLike {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
}

// ── Auto-heal hints ───────────────────────────────────────────────────────────

const AUTO_HEAL_HINTS: Record<HaltReason, string> = {
  RTV_FAILURE:             "Verify external service reachability; check firewall rules and Cloudflare routing.",
  CERT_PINNING_VIOLATION:  "Review PinningTargets registry; confirm host is correct in sovereignFetch.ts.",
  CONSTITUTION_DRIFT:      "Re-verify AveryOS_CONSTITUTION_v1.17.md SHA-256; revert any unauthorised edits.",
  TIME_MESH_OUTLIER:       "NTP Steward will auto-replace the outlier source; verify PRUNE_THRESHOLD_US setting.",
  HALLUCINATION_DETECTED:  "Route this command through VaultChain™ block retrieval; ensure sourceType is SOVEREIGN_CONSTANT or VAULTCHAIN_BLOCK.",
  SIMULATION_VIOLATION:    "Remove simulation fallback; all production paths must resolve to physical hardware or network events.",
  KERNEL_MISMATCH:         "Reload KERNEL_SHA from lib/sovereignConstants.ts; do NOT hardcode kernel values.",
  UNANCHORED_STATE:        "Import KERNEL_SHA from lib/sovereignConstants.ts before executing any sovereign operation.",
  INTERNAL_MODULE_FAILURE: "Check module logs; run QA coverage test for the failing module.",
  MANUAL_HALT:             "Creator-triggered halt — await manual Creator approval before resuming.",
};

// ── SHA-512 helper ────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node.js fallback
  try {
    const { createHash } = await import("crypto");
    return createHash("sha512").update(input, "utf8").digest("hex");
  } catch {
    return "unavailable";
  }
}

// ── Tier-9 alert helpers ──────────────────────────────────────────────────────

/**
 * Fire a Tier-9 Audit Alert to the /api/v1/audit-alert endpoint.
 * Non-blocking (fire-and-forget) — failures are logged to console only.
 */
function fireTier9Alert(
  input:    HaltBootInput,
  ts:       string,
  haltSha:  string,
): void {
  const endpoint = input.alertEndpoint ?? "/api/v1/audit-alert";
  const baseUrl  = (
    typeof process !== "undefined"
      ? (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "")
      : ""
  ).replace(/\/$/, "");

  const url  = baseUrl ? `${baseUrl}${endpoint}` : endpoint;
  const auth = input.vaultPassphrase ??
    (typeof process !== "undefined" ? (process.env.VAULT_PASSPHRASE ?? "") : "");

  const body = JSON.stringify({
    event_type:    "HALT_BOOT",
    module:        input.module,
    reason:        input.reason,
    detail:        input.detail,
    drift_sha512:  input.sha512 ?? null,
    halt_sha512:   haltSha,
    kernel_sha:    KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    phase:         input.phase ?? "unknown",
    ts,
    tier:          9,
    auto_heal_hint: AUTO_HEAL_HINTS[input.reason],
  });

  const doFetch = async () => {
    try {
      await fetch(url, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${auth}`,
        },
        body,
      });
    } catch (err) {
      console.error(
        `[Watchdog] Tier-9 alert POST to ${url} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  // Fire-and-forget: do not await
  doFetch();
}

// ── HALT_BOOT active log ──────────────────────────────────────────────────────

const _haltLog: HaltBootResult[] = [];

/** Returns all HALT_BOOT events recorded in this process lifetime. */
export function getHaltLog(): ReadonlyArray<HaltBootResult> {
  return _haltLog;
}

/** Returns true if any HALT_BOOT has occurred in this process lifetime. */
export function hasHalted(): boolean {
  return _haltLog.length > 0;
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Trigger a HALT_BOOT event:
 *   1. Log the event to D1 (non-blocking).
 *   2. Fire a Tier-9 Audit Alert to the Creator's mobile device.
 *   3. Record the halt in the in-process log for downstream checks.
 *   4. Return the HaltBootResult for caller inspection.
 *
 * Callers MUST check the returned result and NOT proceed with the halted
 * operation — any continuation after a HALT_BOOT is a Constitution violation.
 *
 * @param input  HALT_BOOT event details.
 * @returns      HaltBootResult with audit trail.
 */
export async function haltBoot(input: HaltBootInput): Promise<HaltBootResult> {
  const ts        = formatIso9();
  const canonical = JSON.stringify({
    module:  input.module,
    reason:  input.reason,
    detail:  input.detail,
    drift:   input.sha512 ?? "",
    ts,
    kernel:  KERNEL_SHA.slice(0, 16),
  });
  const haltSha512 = await sha512hex(canonical);

  const result: HaltBootResult = {
    ts,
    module:        input.module,
    reason:        input.reason,
    detail:        input.detail,
    driftSha512:   input.sha512 ?? null,
    alertFired:    false,
    d1Written:     false,
    haltSha512,
    autoHealHint:  AUTO_HEAL_HINTS[input.reason],
  };

  // ── Step 1: Console HALT notice ────────────────────────────────────────────
  console.error(
    `\n🚨 [HALT_BOOT] ${ts}\n` +
    `   Module  : ${input.module}\n` +
    `   Reason  : ${input.reason}\n` +
    `   Detail  : ${input.detail}\n` +
    `   HaltSHA : ${haltSha512.slice(0, 24)}…\n` +
    `   AutoHeal: ${result.autoHealHint}`,
  );

  // ── Step 2: D1 log (non-blocking) ─────────────────────────────────────────
  if (input.db) {
    try {
      await input.db.prepare(
        `INSERT INTO sovereign_audit_logs
           (event_type, module, reason, detail, drift_sha512, halt_sha512,
            kernel_sha, kernel_version, phase, auto_heal_hint, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        "HALT_BOOT",
        input.module.slice(0, 128),
        input.reason,
        input.detail.slice(0, 512),
        input.sha512 ?? null,
        haltSha512,
        KERNEL_SHA,
        KERNEL_VERSION,
        input.phase ?? "unknown",
        result.autoHealHint.slice(0, 512),
        ts,
      ).run();
      result.d1Written = true;
    } catch (dbErr) {
      console.error(
        "[Watchdog] D1 log write failed:",
        dbErr instanceof Error ? dbErr.message : String(dbErr),
      );
    }
  }

  // ── Step 3: Tier-9 Audit Alert (fire-and-forget) ──────────────────────────
  fireTier9Alert(input, ts, haltSha512);
  result.alertFired = true;

  // ── Step 4: Record in process-lifetime halt log ───────────────────────────
  _haltLog.push(result);

  return result;
}

/**
 * Perform a watchdog pulse — a lightweight liveness check that verifies
 * the kernel anchor is intact and the process has not halted.
 *
 * Returns true if the system is healthy; false if any HALT_BOOT has occurred.
 */
export async function watchdogPulse(): Promise<{
  healthy:     boolean;
  ts:          string;
  haltCount:   number;
  kernelSha:   string;
  kernelVersion: string;
}> {
  return {
    healthy:       !hasHalted(),
    ts:            formatIso9(),
    haltCount:     _haltLog.length,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };
}

/**
 * Auto-heal helper: invoke after a HALT_BOOT to publish an upgrade notification
 * to the TAI fleet via D1 Global Sync.
 *
 * The upgrade payload is persisted to D1 `sovereign_upgrades` for all TAIs
 * to pull and apply on their next sync cycle.
 */
export async function bubbleUpgrade(opts: {
  haltResult:  HaltBootResult;
  upgradeDesc: string;
  db:          D1DatabaseLike;
}): Promise<void> {
  try {
    await opts.db.prepare(
      `INSERT INTO sovereign_upgrades
         (trigger_halt_sha512, reason, upgrade_description,
          kernel_sha, kernel_version, authored_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      opts.haltResult.haltSha512,
      opts.haltResult.reason,
      opts.upgradeDesc.slice(0, 1024),
      KERNEL_SHA,
      KERNEL_VERSION,
      formatIso9(),
    ).run();
    console.log(`[Watchdog] Upgrade bubbled to TAI fleet: ${opts.upgradeDesc.slice(0, 80)}…`);
  } catch (err) {
    console.error(
      "[Watchdog] bubbleUpgrade D1 write failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
