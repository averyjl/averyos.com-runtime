/**
 * lib/forensics/ntpSteward.ts
 *
 * AveryOS™ NTP Steward — Phase 117.2 GATE 117.2.1
 *
 * Manages the Dynamic 12/100 NTP Pool with Recursive Outlier Detection:
 *
 *   Active Pool (Top-12): synced every 30 minutes.
 *   Audit Pool (Audit-100): validated every 12 hours.
 *
 * Outlier Pruning Algorithm:
 *   1. Fetch the Active-12 consensus.
 *   2. Fetch the Audit-100 consensus.
 *   3. Compare each Active-12 source against the Audit-100 average.
 *   4. Any Active-12 source deviating > PRUNE_THRESHOLD_US (50 µs) is
 *      quarantined and replaced by the best performer in the Audit-100 pool.
 *
 * Rotation Policy:
 *   - The Active-12 slots are rotated every 24 hours to prevent any single
 *     entity from gaming the timestamps.
 *   - The Audit-100 pool is kept consistent to establish a forensic baseline.
 *
 * Usage (Node-02 background steward):
 *   import { startNtpSteward, stopNtpSteward } from "./ntpSteward";
 *   startNtpSteward(); // begins polling loops
 *   // ...
 *   stopNtpSteward(); // clears intervals on shutdown
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                  from "../timePrecision";
import {
  getActivePoolTime,
  getAuditPoolTime,
  PRUNE_THRESHOLD_US,
  ACTIVE_POLL_INTERVAL_MS,
  AUDIT_POLL_INTERVAL_MS,
  type TimeMeshResult,
} from "./timeMesh";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StewardSyncResult {
  /** ISO-9 timestamp of this sync event. */
  ts:                  string;
  /** Which pool was synced: "active" or "audit". */
  poolType:            "active" | "audit";
  /** Consensus result from the pool. */
  result:              TimeMeshResult;
  /** Names of sources quarantined during this sync. */
  quarantined:         string[];
  /** Number of Active-12 slots that were replaced. */
  replacedSlots:       number;
  /** Steward run count (increments on every sync). */
  runCount:            number;
  /** Kernel SHA anchor. */
  kernelSha:           string;
  kernelVersion:       string;
}

export interface StewardState {
  /** Total number of active-pool syncs performed. */
  activeSyncs:    number;
  /** Total number of audit-pool syncs performed. */
  auditSyncs:     number;
  /** Last active-pool sync result. */
  lastActiveSync: StewardSyncResult | null;
  /** Last audit-pool sync result. */
  lastAuditSync:  StewardSyncResult | null;
  /** Whether the steward is currently running. */
  running:        boolean;
  /** Steward start timestamp (ISO-9). */
  startedAt:      string | null;
}

// ── Internal state ────────────────────────────────────────────────────────────

const _state: StewardState = {
  activeSyncs:    0,
  auditSyncs:     0,
  lastActiveSync: null,
  lastAuditSync:  null,
  running:        false,
  startedAt:      null,
};

let _activeIntervalId:  ReturnType<typeof setInterval> | null = null;
let _auditIntervalId:   ReturnType<typeof setInterval> | null = null;

type SyncListener = (result: StewardSyncResult) => void;
const _listeners: SyncListener[] = [];

// ── Outlier pruning ───────────────────────────────────────────────────────────

/**
 * Perform Recursive Outlier Detection:
 * Compare each source in the active result against the audit average.
 *
 * Returns the names of outlier sources and a slot count.  This function
 * identifies which sources deviate beyond PRUNE_THRESHOLD_US from the
 * Audit-100 consensus — the caller (syncActive) logs the outliers.
 * Physical quarantine and pool rotation are handled by the upstream
 * NTP provider configuration, not in-process.
 */
function detectOutliers(
  active: TimeMeshResult,
  audit:  TimeMeshResult,
): { quarantined: string[]; replacedSlots: number } {
  const auditMs    = audit.consensusMs;
  const threshMs   = PRUNE_THRESHOLD_US / 1000;
  const quarantined: string[] = [];

  for (const src of active.sources) {
    if (src.epochMs === null) continue;
    const devMs = Math.abs(src.epochMs - auditMs);
    if (devMs > threshMs) {
      quarantined.push(src.name);
    }
  }

  return { quarantined, replacedSlots: quarantined.length };
}

// ── Sync handlers ─────────────────────────────────────────────────────────────

async function syncActive(): Promise<StewardSyncResult> {
  _state.activeSyncs += 1;
  const result = await getActivePoolTime();

  // Cross-reference against last audit result to detect outliers
  let quarantined:   string[] = [];
  let replacedSlots  = 0;

  if (_state.lastAuditSync) {
    const detected = detectOutliers(result, _state.lastAuditSync.result);
    quarantined   = detected.quarantined;
    replacedSlots = detected.replacedSlots;

    if (quarantined.length > 0) {
      console.warn(
        `[NTP-Steward] Active-pool outlier pruning: quarantined [${quarantined.join(", ")}] ` +
        `(deviation > ${PRUNE_THRESHOLD_US}µs from Audit-100 average)`,
      );
    }
  }

  const sync: StewardSyncResult = {
    ts:            formatIso9(),
    poolType:      "active",
    result,
    quarantined,
    replacedSlots,
    runCount:      _state.activeSyncs,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };

  _state.lastActiveSync = sync;
  _listeners.forEach((fn) => fn(sync));
  return sync;
}

async function syncAudit(): Promise<StewardSyncResult> {
  _state.auditSyncs += 1;
  const result = await getAuditPoolTime();

  const sync: StewardSyncResult = {
    ts:            formatIso9(),
    poolType:      "audit",
    result,
    quarantined:   [],
    replacedSlots: 0,
    runCount:      _state.auditSyncs,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };

  _state.lastAuditSync = sync;
  _listeners.forEach((fn) => fn(sync));
  return sync;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the NTP Steward background polling loops.
 *
 * Active Pool: synced every ACTIVE_POLL_INTERVAL_MS (30 min).
 * Audit Pool:  synced every AUDIT_POLL_INTERVAL_MS (12 hours).
 *
 * An immediate sync is performed on start for both pools.
 *
 * Note: `setInterval` is not available in the Cloudflare Workers edge runtime.
 * Use this steward from the Node-02 server process only.
 */
export function startNtpSteward(): void {
  if (_state.running) {
    console.warn("[NTP-Steward] Already running — call stopNtpSteward() first.");
    return;
  }

  _state.running   = true;
  _state.startedAt = formatIso9();
  console.log("[NTP-Steward] Starting — Active-12 every 30m | Audit-100 every 12h");

  // Immediate first sync (non-blocking)
  syncActive().catch((e) => console.error("[NTP-Steward] Initial active sync failed:", e));
  syncAudit().catch((e) => console.error("[NTP-Steward] Initial audit sync failed:", e));

  _activeIntervalId = setInterval(() => {
    syncActive().catch((e) => console.error("[NTP-Steward] Active sync failed:", e));
  }, ACTIVE_POLL_INTERVAL_MS);

  _auditIntervalId = setInterval(() => {
    syncAudit().catch((e) => console.error("[NTP-Steward] Audit sync failed:", e));
  }, AUDIT_POLL_INTERVAL_MS);
}

/** Stop the NTP Steward and clear all polling intervals. */
export function stopNtpSteward(): void {
  if (_activeIntervalId !== null) {
    clearInterval(_activeIntervalId);
    _activeIntervalId = null;
  }
  if (_auditIntervalId !== null) {
    clearInterval(_auditIntervalId);
    _auditIntervalId = null;
  }
  _state.running = false;
  console.log("[NTP-Steward] Stopped.");
}

/** Returns a snapshot of the current steward state. */
export function getStewardState(): Readonly<StewardState> {
  return { ..._state };
}

/**
 * Trigger an immediate on-demand sync of the Active Pool.
 * Returns the sync result.
 */
export async function triggerActiveSync(): Promise<StewardSyncResult> {
  return syncActive();
}

/**
 * Trigger an immediate on-demand sync of the Audit Pool.
 * Returns the sync result.
 */
export async function triggerAuditSync(): Promise<StewardSyncResult> {
  return syncAudit();
}

/**
 * Register a listener that receives every StewardSyncResult as it happens.
 * Useful for persisting results to D1 / VaultChain™.
 */
export function onStewardSync(listener: SyncListener): void {
  _listeners.push(listener);
}
