/**
 * lib/forensics/threatEngine.ts
 *
 * AveryOS™ Dynamic Threat Learner — Phase 95.2
 *
 * Implements `autolearnThreatPattern()`: analyses behavioural signals from an
 * incoming request and, when the combined score meets the Tier-10 threshold,
 * auto-inserts a sovereign fingerprint into the `threat_vectors` table so that
 * subsequent IP rotations by the same entity are still caught.
 *
 * Trigger conditions (Phase 95.2 spec):
 *   • Request cadence < 2.0 s  (high-frequency mechanical probe)
 *   • OR WAF score > 90        (confirmed attack signature)
 *   → Auto-insert into `threat_vectors` with the behavioural hash
 *
 * The `threat_vectors` table is created automatically on first call if it does
 * not yet exist (non-breaking self-upgrade).
 *
 * Author: Jason Lee Avery (ROOT0)
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Threshold constants ────────────────────────────────────────────────────────

/** Maximum inter-request interval (ms) that triggers cadence autolearn. */
export const CADENCE_THRESHOLD_MS = 2000;

/** Minimum WAF score that triggers signature autolearn. */
export const WAF_AUTOLEARN_THRESHOLD = 90;

// ── Minimal D1 type interfaces ─────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

// ── Public types ───────────────────────────────────────────────────────────────

export interface ThreatSignals {
  /** Client IP address */
  ip:            string;
  /** Inter-request cadence in milliseconds (0 = unknown) */
  cadenceMs:     number;
  /** Cloudflare WAF total score (0 = no signal) */
  wafScore:      number;
  /** Request pathname */
  path:          string;
  /** Cloudflare RayID (optional) */
  rayId?:        string;
  /** Autonomous System Number (optional) */
  asn?:          string;
  /** User-Agent string (optional) */
  userAgent?:    string;
}

export interface AutolearnResult {
  /** Whether the threshold was met and a threat was inserted/updated */
  learned:       boolean;
  /** Human-readable trigger reason */
  trigger?:      "CADENCE" | "WAF" | "CADENCE+WAF";
  /** SHA-512 behavioural fingerprint stored in the DB */
  fingerprint?:  string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Ensure the threat_vectors table exists (idempotent). */
async function ensureThreatVectorsTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS threat_vectors (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address        TEXT    NOT NULL,
        asn               TEXT,
        behavioural_hash  TEXT    NOT NULL UNIQUE,
        trigger_reason    TEXT    NOT NULL,
        cadence_ms        INTEGER NOT NULL DEFAULT 0,
        waf_score         INTEGER NOT NULL DEFAULT 0,
        sample_path       TEXT,
        sample_ray_id     TEXT,
        kernel_sha        TEXT    NOT NULL,
        kernel_version    TEXT    NOT NULL,
        first_seen        TEXT    NOT NULL,
        last_seen         TEXT    NOT NULL,
        hit_count         INTEGER NOT NULL DEFAULT 1
      )`
    )
    .run();
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Analyses the provided threat signals and, when the Tier-10 threshold is met,
 * upserts a behavioural fingerprint into the `threat_vectors` table.
 *
 * This function is fire-and-forget safe: all errors are swallowed and logged so
 * that a DB failure never blocks request processing.
 *
 * @param db       — Cloudflare D1 database binding
 * @param signals  — Behavioural signals extracted from the incoming request
 * @returns        AutolearnResult describing whether learning occurred
 */
export async function autolearnThreatPattern(
  db: D1Database,
  signals: ThreatSignals,
): Promise<AutolearnResult> {
  try {
    const highCadence = signals.cadenceMs > 0 && signals.cadenceMs < CADENCE_THRESHOLD_MS;
    const highWaf     = signals.wafScore > WAF_AUTOLEARN_THRESHOLD;

    if (!highCadence && !highWaf) {
      return { learned: false };
    }

    const trigger: AutolearnResult["trigger"] =
      highCadence && highWaf ? "CADENCE+WAF" :
      highCadence            ? "CADENCE"     :
                               "WAF";

    // Build a behavioural fingerprint from the stable signals.
    // Use JSON serialization to prevent pipe-character injection from
    // user-controllable fields (path, userAgent) from affecting the hash.
    const fingerprintInput = JSON.stringify({
      ip:      signals.ip,
      asn:     signals.asn ?? "UNKNOWN_ASN",
      path:    signals.path,
      ua:      signals.userAgent ?? "UNKNOWN_UA",
      trigger,
      anchor:  KERNEL_SHA,
    });

    const fingerprint = await sha512hex(fingerprintInput);
    const now         = new Date().toISOString();

    await ensureThreatVectorsTable(db);

    // Upsert: increment hit_count and refresh last_seen on conflict
    await db
      .prepare(
        `INSERT INTO threat_vectors
           (ip_address, asn, behavioural_hash, trigger_reason, cadence_ms,
            waf_score, sample_path, sample_ray_id, kernel_sha, kernel_version,
            first_seen, last_seen, hit_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(behavioural_hash) DO UPDATE SET
           last_seen  = excluded.last_seen,
           hit_count  = threat_vectors.hit_count + 1,
           waf_score  = MAX(threat_vectors.waf_score, excluded.waf_score),
           cadence_ms = CASE
             WHEN excluded.cadence_ms > 0
              AND (threat_vectors.cadence_ms = 0 OR excluded.cadence_ms < threat_vectors.cadence_ms)
             THEN excluded.cadence_ms
             ELSE threat_vectors.cadence_ms
           END`
      )
      .bind(
        signals.ip,
        signals.asn         ?? null,
        fingerprint,
        trigger,
        signals.cadenceMs,
        signals.wafScore,
        signals.path,
        signals.rayId       ?? null,
        KERNEL_SHA,
        KERNEL_VERSION,
        now,
        now,
      )
      .run();

    console.info(
      `[THREAT_ENGINE] Autolearned: ip=${signals.ip} trigger=${trigger}` +
      ` cadenceMs=${signals.cadenceMs} wafScore=${signals.wafScore}` +
      ` fingerprint=${fingerprint.slice(0, 16)}...`,
    );

    return { learned: true, trigger, fingerprint };
  } catch (err: unknown) {
    console.error(
      "[THREAT_ENGINE] autolearnThreatPattern failed:",
      err instanceof Error ? err.message : String(err),
    );
    return { learned: false };
  }
}
