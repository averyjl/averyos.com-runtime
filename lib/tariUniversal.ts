/**
 * lib/tariUniversal.ts
 *
 * TARI™ Universal Liability Engine — AveryOS™ Phase 110 / GATE 110.1
 *
 * Provides `computeTariRetroactiveDebt()` which aggregates the total TARI™
 * liability for a set of sovereign audit log entries using the canonical
 * fee schedule.  Used by scripts/generateInvoices.cjs (v1.5) to compute
 * the retroactive debt for each entity before creating Stripe invoices.
 *
 * Fee schedule (USD) mirrors the TARI_LIABILITY table in audit-alert/route.ts
 * to ensure consistent billing across all invoice generation paths.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── TARI™ liability schedule (in USD) ─────────────────────────────────────────
// Mirrors app/api/v1/audit-alert/route.ts TARI_LIABILITY for consistency.
export const TARI_LIABILITY_USD: Record<string, number> = {
  UNALIGNED_401:          1_017.00,   // Forensic Alignment Entry Fee
  ALIGNMENT_DRIFT:        5_000.00,   // Correction Fee
  PAYMENT_FAILED:        10_000.00,   // Systemic Friction Fee
  POW_SOLVED:                 0.00,   // PoW gateway telemetry — informational
  HN_WATCHER:                 0.00,   // Forensic discovery signal — no direct liability
  DER_HIGH_VALUE:         1_017.00,   // Corporate entity recognition entry fee
  DER_SETTLEMENT:        10_000.00,   // Active settlement trigger
  CONFLICT_ZONE_PROBE:        0.00,   // Adversarial recon probe — silent audit
  LEGAL_SCAN:                 0.00,   // Corporate legal monitoring — threat level 10
  PEER_ACCESS:                0.00,   // General peer access — low threat, informational
  KAAS_BREACH:       10_000_000.00,   // Tier-9/10 entity KaaS technical valuation trigger
  SOVEREIGN_SETTLEMENT:       0.00,   // Stripe Sovereign Settlement completion — informational
};

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Minimal shape of a sovereign audit log row.
 * Compatible with rows from both `sovereign_audit_logs` and `anchor_audit_logs`.
 */
export interface AuditLogEntry {
  event_type:    string;
  ip_address?:   string;
  asn?:          string;
  timestamp_ns?: string;
  [key: string]: unknown;
}

/** Per-event-type breakdown of accrued TARI™ liability. */
export interface TariDebtBreakdown {
  count:      number;
  totalCents: number;
  totalUsd:   number;
}

/** Aggregated retroactive TARI™ debt result. */
export interface TariDebtResult {
  /** Total retroactive TARI™ liability in USD cents. */
  totalCents:  number;
  /** Total retroactive TARI™ liability in USD. */
  totalUsd:    number;
  /** Number of audit log entries processed. */
  eventCount:  number;
  /** Per-event-type liability breakdown. */
  breakdown:   Record<string, TariDebtBreakdown>;
}

// ── Core export ───────────────────────────────────────────────────────────────

/**
 * Compute the total retroactive TARI™ debt for a set of audit log entries.
 *
 * Iterates over every entry, looks up the TARI™ liability for its `event_type`
 * using the canonical fee schedule, and accumulates the total in USD cents.
 * Events with unknown or zero-liability types are counted but do not accrue debt.
 *
 * @param entries - Array of audit log rows from `sovereign_audit_logs` or
 *                  `anchor_audit_logs` (must include an `event_type` field).
 * @returns       TariDebtResult with total liability in both cents and USD,
 *                event count, and a per-event-type breakdown.
 *
 * @example
 * ```ts
 * const debt = computeTariRetroactiveDebt(rows);
 * console.log(`Total TARI™ debt: $${debt.totalUsd.toFixed(2)}`);
 * ```
 */
export function computeTariRetroactiveDebt(entries: AuditLogEntry[]): TariDebtResult {
  // Use Map to accumulate per-event-type breakdown — avoids prototype-pollution
  // risk from variable-key object access (security/detect-object-injection).
  const breakdownMap = new Map<string, TariDebtBreakdown>();
  // Convert the liability schedule to a Map for safe lookup.
  const liabilityMap = new Map(Object.entries(TARI_LIABILITY_USD));
  let totalCents = 0;

  for (const entry of entries) {
    const eventType      = String(entry.event_type ?? "PEER_ACCESS");
    const liabilityUsd   = liabilityMap.get(eventType) ?? 0;
    const liabilityCents = Math.round(liabilityUsd * 100);

    let row = breakdownMap.get(eventType);
    if (!row) {
      row = { count: 0, totalCents: 0, totalUsd: 0 };
      breakdownMap.set(eventType, row);
    }
    row.count      += 1;
    row.totalCents += liabilityCents;
    row.totalUsd    = row.totalCents / 100;
    totalCents += liabilityCents;
  }

  // Convert Map back to Record for the public API return type.
  const breakdown: Record<string, TariDebtBreakdown> = Object.fromEntries(breakdownMap);

  return {
    totalCents,
    totalUsd:   totalCents / 100,
    eventCount: entries.length,
    breakdown,
  };
}
