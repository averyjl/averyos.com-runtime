/**
 * lib/compliance/clockEngine.ts
 *
 * Settlement Reconciliation Clock — AveryOS™ Phase 102.1 / Gate 5
 *
 * Provides a deterministic 72-hour settlement deadline tracker.
 * When a licensing entity completes the attestation handshake, this
 * module records the deadline and allows the system to query the
 * remaining time or check whether the window has elapsed.
 *
 * Storage:
 *   • Deadlines are persisted in Cloudflare KV when a KV binding is
 *     available.  The key format is `settlement_clock:<entityId>`.
 *   • In-memory fallback is provided for environments without KV.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_VERSION } from "../sovereignConstants";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default reconciliation window in hours. */
export const SETTLEMENT_WINDOW_HOURS = 72;

/** KV key prefix for settlement clock entries. */
export const SETTLEMENT_CLOCK_KV_PREFIX = "settlement_clock:";

/** KV TTL — keep deadline records for 30 days after creation. */
const KV_TTL_SECONDS = 30 * 24 * 60 * 60;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SettlementClock {
  entityId:    string;
  startedAt:   string; // ISO-8601
  deadlineAt:  string; // ISO-8601
  windowHours: number;
  kernelVersion: string;
}

export interface ClockStatus {
  entityId:          string;
  startedAt:         string;
  deadlineAt:        string;
  windowHours:       number;
  remainingMs:       number;
  remainingHours:    number;
  isExpired:         boolean;
  kernelVersion:     string;
}

/** Minimal KV interface (matches Cloudflare Workers KV). */
interface KvStore {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
}

// ── In-memory fallback ─────────────────────────────────────────────────────────
const memStore = new Map<string, string>();

// ── Core functions ─────────────────────────────────────────────────────────────

/**
 * Start the 72-hour reconciliation clock for the given entity.
 * Records `startedAt` (now) and `deadlineAt` (now + windowHours).
 *
 * @param entityId  Unique identifier for the licensing entity (e.g. ASN or UUID).
 * @param kv        Optional Cloudflare KV binding for persistence.
 * @param windowHours  Override for the settlement window (default 72 h).
 * @returns         The created SettlementClock record.
 */
export async function startReconciliationClock(
  entityId:    string,
  kv?:         KvStore | null,
  windowHours: number = SETTLEMENT_WINDOW_HOURS,
): Promise<SettlementClock> {
  const now         = new Date();
  const deadline    = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

  const record: SettlementClock = {
    entityId,
    startedAt:    now.toISOString(),
    deadlineAt:   deadline.toISOString(),
    windowHours,
    kernelVersion: KERNEL_VERSION,
  };

  const key   = `${SETTLEMENT_CLOCK_KV_PREFIX}${entityId}`;
  const value = JSON.stringify(record);

  if (kv) {
    await kv.put(key, value, { expirationTtl: KV_TTL_SECONDS });
  } else {
    memStore.set(key, value);
  }

  return record;
}

/**
 * Retrieve the current status of the settlement clock for the given entity.
 *
 * @param entityId  Unique identifier for the licensing entity.
 * @param kv        Optional Cloudflare KV binding for persistence.
 * @returns         ClockStatus, or null if no clock exists for this entity.
 */
export async function getClockStatus(
  entityId: string,
  kv?:      KvStore | null,
): Promise<ClockStatus | null> {
  const key = `${SETTLEMENT_CLOCK_KV_PREFIX}${entityId}`;
  let raw: string | null = null;

  if (kv) {
    raw = await kv.get(key);
  } else {
    raw = memStore.get(key) ?? null;
  }

  if (!raw) return null;

  let record: SettlementClock;
  try {
    record = JSON.parse(raw) as SettlementClock;
  } catch {
    return null;
  }

  const now         = Date.now();
  const deadlineMs  = new Date(record.deadlineAt).getTime();
  const remainingMs = Math.max(0, deadlineMs - now);

  return {
    entityId:       record.entityId,
    startedAt:      record.startedAt,
    deadlineAt:     record.deadlineAt,
    windowHours:    record.windowHours,
    remainingMs,
    remainingHours: remainingMs / (60 * 60 * 1000),
    isExpired:      deadlineMs <= now,
    kernelVersion:  record.kernelVersion,
  };
}

/**
 * Check whether the settlement clock for the given entity has expired
 * (i.e. the 72-hour window has elapsed without payment).
 *
 * @param entityId  Unique identifier for the licensing entity.
 * @param kv        Optional Cloudflare KV binding.
 * @returns         true if expired or not found, false if still active.
 */
export async function isClockExpired(
  entityId: string,
  kv?:      KvStore | null,
): Promise<boolean> {
  const status = await getClockStatus(entityId, kv);
  return status === null || status.isExpired;
}
