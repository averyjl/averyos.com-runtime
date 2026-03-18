/**
 * lib/forensics/watchdog.ts
 *
 * AveryOS™ GabrielOS™ Watchdog — Phase 117.3 GATE 117.3.4
 *
 * Monitors Step C Echo confirmations for every sovereign connection.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-Step Handshake Model (Jason Lee Avery, ROOT0):
 *
 *   Step A — INITIATION   : The sovereign module sends a request.
 *   Step B — RECEIPT       : The remote endpoint returns a response.
 *   Step C — ECHO CONFIRM  : The module confirms it received and processed
 *                            the response (no silent failure).
 *
 * Enforcement: if Step C is absent (i.e. no echo confirmation is logged
 * within the configured window) the watchdog:
 *   1. Logs a USI (Unverified Silence Incident) violation to VaultChain™.
 *   2. Emits a $10,000 penalty event per incident to the audit ledger.
 *   3. Sets the associated module's physicalityStatus to LATENT_PENDING.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION }  from "../sovereignConstants";
import { formatIso9 }                  from "../timePrecision";
import {
  updatePhysicality,
  type PhysicalityStatus,
}                                       from "../registry/coreManifest";

// ── Minimal D1 interface ──────────────────────────────────────────────────────

/** Minimal D1-compatible interface (avoids importing @cloudflare/workers-types). */
interface D1Like {
  prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<void> } };
}

// ── Step C Echo types ─────────────────────────────────────────────────────────

/**
 * An active Step C Echo entry — recorded when a module explicitly confirms
 * receipt and processing of a response.
 */
export interface StepCEcho {
  /** Unique identifier for the originating Step A request. */
  requestId:          string;
  /** Module (registry id) that sent the request. */
  moduleId:           string;
  /** ISO-9 timestamp when the Step A request was sent. */
  initiatedAt:        string;
  /** ISO-9 timestamp when Step B (response receipt) occurred. */
  responseReceivedAt: string;
  /** ISO-9 timestamp when Step C (echo confirmation) was logged. */
  echoConfirmedAt:    string;
  /** Cloudflare Ray ID (if available). */
  cfRay:              string | null;
  /** The PhysicalityStatus resolved for this exchange. */
  physicalityStatus:  PhysicalityStatus;
}

/**
 * A USI (Unverified Silence Incident) — raised when a Step C echo is absent.
 */
export interface UsiViolation {
  /** Unique violation ID (ISO-9 ts + moduleId). */
  id:            string;
  /** Module (registry id) that failed to echo. */
  moduleId:      string;
  /** ISO-9 timestamp when the incident was detected. */
  detectedAt:    string;
  /** Monetary penalty amount (USD). */
  penaltyUsd:    number;
  /** Human-readable reason for the violation. */
  reason:        string;
  /** Kernel SHA at time of violation. */
  kernelSha:     string;
  /** Kernel version at time of violation. */
  kernelVersion: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Sovereign penalty per Unverified Silence Incident — $10,000 USD. */
export const USI_PENALTY_USD = 10_000;

/**
 * Default silence window in milliseconds.  If no Step C echo is received
 * within this window the watchdog raises a USI violation.
 */
export const SILENCE_WINDOW_MS = 30_000;

// ── In-memory echo ledger (volatile; per-request in Cloudflare Workers) ────────

const _echoLedger = new Map<string, StepCEcho>();
const _usiLog:      UsiViolation[] = [];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * recordStepC — called by any sovereign module after it has confirmed it
 * received and processed a response (Step C Echo).
 *
 * @param echo — the completed Step C Echo record.
 * @param db   — optional D1 binding to persist the echo to `watchdog_echo_log`.
 */
export async function recordStepC(echo: StepCEcho, db?: D1Like | null): Promise<void> {
  _echoLedger.set(echo.requestId, echo);

  if (!db) return;

  try {
    await db
      .prepare(
        `INSERT INTO watchdog_echo_log
           (request_id, module_id, initiated_at, response_received_at,
            echo_confirmed_at, cf_ray, physicality_status,
            kernel_sha, kernel_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
      )
      .bind(
        echo.requestId,
        echo.moduleId,
        echo.initiatedAt,
        echo.responseReceivedAt,
        echo.echoConfirmedAt,
        echo.cfRay,
        echo.physicalityStatus,
        KERNEL_SHA,
        KERNEL_VERSION,
      )
      .run();
  } catch (err) {
    console.error("[watchdog] echo log write failed:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * raiseSilenceViolation — raised by the watchdog when a Step A request has
 * no corresponding Step C echo within the timeout window.
 *
 * Records a $10,000 USI violation, sets the module to LATENT_PENDING, and
 * persists the incident to D1.
 *
 * @param moduleId — registry id of the offending module.
 * @param reason   — human-readable description of why the silence was detected.
 * @param db       — optional D1 binding for persistence.
 * @returns the USI violation record.
 */
export async function raiseSilenceViolation(
  moduleId: string,
  reason:   string,
  db?:      D1Like | null,
): Promise<UsiViolation> {
  const detectedAt = formatIso9();
  const violation:  UsiViolation = {
    id:            `USI-${moduleId}-${detectedAt}`,
    moduleId,
    detectedAt,
    penaltyUsd:    USI_PENALTY_USD,
    reason,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };

  _usiLog.push(violation);

  // Set module physicality to LATENT_PENDING so the registry reflects the breach.
  updatePhysicality(moduleId, "LATENT_PENDING");

  console.error(
    `[watchdog] ⚠ USI VIOLATION — module="${moduleId}" penalty=$${USI_PENALTY_USD.toLocaleString()} — ${reason}`,
  );

  if (!db) return violation;

  try {
    await db
      .prepare(
        `INSERT INTO watchdog_usi_log
           (id, module_id, detected_at, penalty_usd, reason,
            kernel_sha, kernel_version)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        violation.id,
        violation.moduleId,
        violation.detectedAt,
        violation.penaltyUsd,
        violation.reason,
        violation.kernelSha,
        violation.kernelVersion,
      )
      .run();
  } catch (err) {
    console.error("[watchdog] USI log write failed:", err instanceof Error ? err.message : String(err));
  }

  return violation;
}

/**
 * checkForSilence — inspect a pending request; if no Step C echo has been
 * recorded for it within the allowed window, raise a USI violation.
 *
 * @param requestId     — the Step A request identifier.
 * @param moduleId      — registry id of the module.
 * @param initiatedAt   — ISO-9 timestamp when Step A was sent.
 * @param windowMs      — silence timeout in ms (default 30 000 ms).
 * @param db            — optional D1 binding.
 * @returns the USI violation if silence was detected, or null if echo confirmed.
 */
export async function checkForSilence(
  requestId:   string,
  moduleId:    string,
  initiatedAt: string,
  windowMs:    number = SILENCE_WINDOW_MS,
  db?:         D1Like | null,
): Promise<UsiViolation | null> {
  if (_echoLedger.has(requestId)) {
    // Step C echo already recorded — no violation.
    return null;
  }

  const initiatedMs = new Date(initiatedAt).getTime();
  const nowMs       = Date.now();

  if (nowMs - initiatedMs < windowMs) {
    // Still within the window — too early to call it silence.
    return null;
  }

  return raiseSilenceViolation(
    moduleId,
    `No Step C echo received for request "${requestId}" within ${windowMs}ms window.`,
    db,
  );
}

/**
 * getUsiLog — returns all USI violations recorded in this runtime instance.
 * Useful for surfacing in the Sovereign Admin Dashboard.
 */
export function getUsiLog(): UsiViolation[] {
  return [..._usiLog];
}

/**
 * getEchoLedger — returns all Step C echo records recorded in this runtime
 * instance.
 */
export function getEchoLedger(): Map<string, StepCEcho> {
  return new Map(_echoLedger);
}

/**
 * watchdogPulse — periodic check function.  Iterates over all pending
 * request IDs passed in and calls `checkForSilence` for each.
 *
 * Designed to be called from a Cloudflare Cron Trigger or a scheduled
 * Next.js API route (e.g. every minute).
 *
 * @param pending — array of { requestId, moduleId, initiatedAt } tuples.
 * @param windowMs — silence window in ms (default 30 000 ms).
 * @param db      — optional D1 binding.
 * @returns array of USI violations raised during this pulse.
 */
export async function watchdogPulse(
  pending:  Array<{ requestId: string; moduleId: string; initiatedAt: string }>,
  windowMs: number = SILENCE_WINDOW_MS,
  db?:      D1Like | null,
): Promise<UsiViolation[]> {
  const violations: UsiViolation[] = [];

  for (const entry of pending) {
    const v = await checkForSilence(
      entry.requestId,
      entry.moduleId,
      entry.initiatedAt,
      windowMs,
      db,
    );
    if (v) violations.push(v);
  }

  return violations;
}

// ── Schema helpers ────────────────────────────────────────────────────────────

/**
 * Ensure the `watchdog_echo_log` and `watchdog_usi_log` D1 tables exist.
 * Call once on app startup or from a migration script.
 */
export async function ensureWatchdogTables(db: D1Like): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS watchdog_echo_log (
         id                   INTEGER PRIMARY KEY AUTOINCREMENT,
         request_id           TEXT    NOT NULL UNIQUE,
         module_id            TEXT    NOT NULL,
         initiated_at         TEXT    NOT NULL,
         response_received_at TEXT    NOT NULL,
         echo_confirmed_at    TEXT    NOT NULL,
         cf_ray               TEXT,
         physicality_status   TEXT    NOT NULL,
         kernel_sha           TEXT    NOT NULL,
         kernel_version       TEXT    NOT NULL
       )`,
    )
    .bind()
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS watchdog_usi_log (
         id             TEXT    PRIMARY KEY,
         module_id      TEXT    NOT NULL,
         detected_at    TEXT    NOT NULL,
         penalty_usd    INTEGER NOT NULL,
         reason         TEXT    NOT NULL,
         kernel_sha     TEXT    NOT NULL,
         kernel_version TEXT    NOT NULL
       )`,
    )
    .bind()
    .run();
}
