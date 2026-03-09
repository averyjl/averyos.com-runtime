import { getCloudflareContext } from '@opennextjs/cloudflare';
import { d1ErrorResponse } from '../../../../lib/sovereignError';
import { syncD1RowToFirebase } from '../../../../lib/firebaseClient';

interface D1PreparedStatement {
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

interface TariLedgerRow {
  id: number;
  timestamp: string;
  anchor_sha: string | null;
  entity_name: string | null;
  impact_multiplier: number;
  trust_premium_index: number;
  revenue_projection: number;
  status: string;
  event_type: string;
  description: string | null;
  created_at: string;
}

interface WatcherCountRow {
  event_type: string;
  event_count: number;
}

interface TariStatsResponse {
  trust_premium_index_pct: number | null;
  recent_entries: TariLedgerRow[];
  total_entries: number;
  latest_revenue_projection: number | null;
  // DER 2.0 / HN Watcher counts from sovereign_audit_logs (Phase 78.3)
  hn_watcher_count: number;
  der_settlement_count: number;
  watcher_liability_accrued: number;
  timestamp: string;
  // Watcher counts from sovereign_audit_logs (Phase 78.3)
  hn_watcher_count: number;
  der_settlement_count: number;
  conflict_zone_count: number;
  der_high_value_count: number;
  total_tier9_events: number;
  liability_accrued_usd: number;
  firebase_sync_status: string;
}

/** TARI™ liability rates mirrored from audit-alert route for watcher accrual. */
const DER_SETTLEMENT_RATE_USD = 10_000;

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Tari Ledger queries ────────────────────────────────────────────────
    const { results: recent } = await cfEnv.DB.prepare(
      `SELECT id, timestamp, anchor_sha, entity_name, impact_multiplier, trust_premium_index, revenue_projection, status, event_type, description, created_at
       FROM tari_ledger
       ORDER BY id DESC
       LIMIT 20`
    ).all<TariLedgerRow>();

    const countRow = await cfEnv.DB.prepare(
      `SELECT COUNT(*) AS total FROM tari_ledger`
    ).first<{ total: number }>();
    const totalEntries = countRow ? countRow.total : 0;

    const oldest = await cfEnv.DB.prepare(
      `SELECT revenue_projection FROM tari_ledger ORDER BY id ASC LIMIT 1`
    ).first<{ revenue_projection: number }>();

    const latest = recent.length > 0 ? recent[0] : null;

    let trustPremiumIndexPct: number | null = null;
    if (
      oldest &&
      typeof oldest.revenue_projection === 'number' &&
      oldest.revenue_projection !== 0 &&
      latest &&
      typeof latest.revenue_projection === 'number'
    ) {
      trustPremiumIndexPct =
        ((latest.revenue_projection - oldest.revenue_projection) /
          Math.abs(oldest.revenue_projection)) *
        100;
      trustPremiumIndexPct = Math.round(trustPremiumIndexPct * 100) / 100;
    }

    // ── Watcher Counter — Phase 78.3 ─────────────────────────────────────────
    // Count HN_WATCHER and DER_SETTLEMENT events logged via /api/v1/audit-alert.
    // Single conditional-aggregation query to minimise D1 round trips.
    // Returns 0 gracefully if sovereign_audit_logs doesn't exist yet or is empty.
    let hnWatcherCount = 0;
    let derSettlementCount = 0;
    try {
      const watcherRow = await cfEnv.DB.prepare(
        `SELECT
           SUM(CASE WHEN event_type = 'HN_WATCHER'     THEN 1 ELSE 0 END) AS hn_cnt,
           SUM(CASE WHEN event_type = 'DER_SETTLEMENT'  THEN 1 ELSE 0 END) AS der_cnt
         FROM sovereign_audit_logs`
      ).first() as { hn_cnt: number | null; der_cnt: number | null } | null;
      hnWatcherCount    = watcherRow?.hn_cnt  ?? 0;
      derSettlementCount = watcherRow?.der_cnt ?? 0;
    } catch {
      // Table may not exist yet — non-fatal, return zeros
    }

    const watcherLiabilityAccrued = derSettlementCount * DER_SETTLEMENT_RATE_USD;

    const response: TariStatsResponse = {
      trust_premium_index_pct: trustPremiumIndexPct,
      recent_entries: recent,
      total_entries: totalEntries,
      latest_revenue_projection: latest ? latest.revenue_projection : null,
      hn_watcher_count: hnWatcherCount,
      der_settlement_count: derSettlementCount,
      watcher_liability_accrued: watcherLiabilityAccrued,
      timestamp: new Date().toISOString(),
      hn_watcher_count: hnWatcherCount,
      der_settlement_count: derSettlementCount,
      conflict_zone_count: conflictZoneCount,
      der_high_value_count: derHighValueCount,
      total_tier9_events: totalTier9Events,
      liability_accrued_usd: liabilityAccruedUsd,
      firebase_sync_status: firebaseSyncStatus,
    };

    return Response.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, 'tari_ledger');
  }
}
