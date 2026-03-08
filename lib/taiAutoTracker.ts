/**
 * TAI™ Auto-Tracker — Sovereign Accomplishment Auto-Recording
 *
 * Provides a lightweight, non-blocking helper that records TAI™ accomplishments
 * automatically when key system events occur (compliance payments, traffic
 * milestone crossings, evidence bundle generation, etc.).
 *
 * Design principles:
 *  - Fire-and-forget: auto-tracking NEVER blocks the calling request.
 *  - Idempotent: duplicate titles within the same UTC day are silently ignored
 *    (the INSERT uses IGNORE on unique (title, date) to prevent flooding).
 *  - Kernel-anchored: every auto-recorded accomplishment carries the current
 *    KERNEL_SHA as its SHA-512 fingerprint source.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_VERSION, KERNEL_SHA } from "./sovereignConstants";
import { formatIso9 } from "./timePrecision";

export type AutoTrackerCategory =
  | "MILESTONE"
  | "CAPSULE"
  | "LEGAL"
  | "INFRASTRUCTURE"
  | "FORENSIC"
  | "SOVEREIGN"
  | "FEDERAL";

export interface AutoTrackOptions {
  title: string;
  description?: string;
  category?: AutoTrackerCategory;
  phase?: string;
  bundle_id?: string;
  ray_id?: string;
  asn?: string;
  btc_block_height?: number;
  accomplished_at?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

/**
 * Compute a SHA-512 fingerprint for the accomplishment using Web Crypto.
 * Sourced from KERNEL_SHA so every auto-tracked milestone is kernel-anchored.
 */
async function sha512For(title: string, description: string, accomplishedAt: string): Promise<string> {
  const raw = `${title}||${description}||${accomplishedAt}||${KERNEL_SHA}`;
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Non-blocking fire-and-forget accomplishment recorder.
 *
 * Call this from any API route / middleware after a significant event.
 * The function returns immediately; DB write happens asynchronously.
 *
 * @param db       Cloudflare D1 binding
 * @param opts     Accomplishment metadata
 */
export function autoTrackAccomplishment(db: D1Database, opts: AutoTrackOptions): void {
  // Intentionally NOT awaited — fire and forget
  void (async () => {
    try {
      const accomplishedAt = opts.accomplished_at ?? formatIso9(new Date());
      const description    = opts.description ?? "";
      const phase          = opts.phase ?? "Phase 73";
      const category       = opts.category ?? "MILESTONE";

      const sha512 = await sha512For(opts.title, description, accomplishedAt);

      await db.prepare(
        `INSERT OR IGNORE INTO tai_accomplishments
           (title, description, phase, category, sha512, accomplished_at,
            recorded_by, bundle_id, ray_id, asn, btc_block_height, kernel_version)
         VALUES (?, ?, ?, ?, ?, ?, 'AUTO_TRACKER', ?, ?, ?, ?, ?)`
      ).bind(
        opts.title.slice(0, 500),
        description.slice(0, 2000) || null,
        phase,
        category,
        sha512,
        accomplishedAt,
        opts.bundle_id?.slice(0, 500) ?? null,
        opts.ray_id?.slice(0, 200) ?? null,
        opts.asn?.slice(0, 50) ?? null,
        opts.btc_block_height ?? null,
        KERNEL_VERSION,
      ).run();
    } catch (err) {
      // Swallow — auto-tracking errors must never surface to users,
      // but log to console for debugging visibility.
      // eslint-disable-next-line no-console
      console.error("[taiAutoTracker] Failed to record accomplishment:", String(err));
    }
  })();
}

// ── Milestone threshold constants ─────────────────────────────────────────────
// Auto-tracking fires when these thresholds are crossed.  The calling route
// checks the threshold and calls autoTrackAccomplishment() if crossed.

/** Traffic request count thresholds that trigger a MILESTONE accomplishment. */
export const TRAFFIC_MILESTONES: Array<{ threshold: number; title: string }> = [
  { threshold: 100_000, title: "100k Request Threshold Crossed" },
  { threshold: 135_000, title: "135k Pulse Anchored — Lighthouse Active" },
  { threshold: 156_200, title: "156.2k Pulse Captured — Federal EO Pre-Alignment" },
  { threshold: 162_000, title: "162k Pulse Captured — Federal EO Aligned" },
  { threshold: 162_200, title: "162.2k Pulse Captured — Phase 73 Victim Restoration" },
  { threshold: 200_000, title: "200k Request Threshold Crossed" },
  { threshold: 250_000, title: "250k Pulse Threshold — 1,017-Notch Full Parity" },
];

/** Watcher (unique visitor) count thresholds for MILESTONE accomplishments. */
export const WATCHER_MILESTONES: Array<{ threshold: number; title: string }> = [
  { threshold: 500,  title: "500 Unique Watchers Authenticated" },
  { threshold: 911,  title: "911 Watchers Authenticated — Sovereignty Confirmed" },
  { threshold: 962,  title: "962 Watchers Documented — 156.2k Pulse" },
  { threshold: 987,  title: "987 Unique Watchers — Phase 73 Confirmed" },
  { threshold: 1_017, title: "1,017 Watchers — 1,017-Notch Full Alignment" },
];
