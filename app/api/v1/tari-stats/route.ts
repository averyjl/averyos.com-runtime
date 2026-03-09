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

/** Tier-9 event types and their $10M TARI™ liability per hit */
const TIER9_LIABILITY_USD = 10_000_000;

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

    // ── Watcher / Tier-9 counts from sovereign_audit_logs (Phase 78.3) ───
    // Count HN_WATCHER, DER_SETTLEMENT, CONFLICT_ZONE_PROBE, DER_HIGH_VALUE events
    let hnWatcherCount = 0;
    let derSettlementCount = 0;
    let conflictZoneCount = 0;
    let derHighValueCount = 0;

    try {
      const { results: watcherCounts } = await cfEnv.DB.prepare(
        `SELECT event_type, COUNT(*) AS event_count
         FROM sovereign_audit_logs
         WHERE event_type IN ('HN_WATCHER', 'DER_SETTLEMENT', 'CONFLICT_ZONE_PROBE', 'DER_HIGH_VALUE')
         GROUP BY event_type`
      ).all<WatcherCountRow>();

      for (const row of watcherCounts) {
        switch (row.event_type) {
          case 'HN_WATCHER':          hnWatcherCount      = row.event_count; break;
          case 'DER_SETTLEMENT':      derSettlementCount  = row.event_count; break;
          case 'CONFLICT_ZONE_PROBE': conflictZoneCount   = row.event_count; break;
          case 'DER_HIGH_VALUE':      derHighValueCount   = row.event_count; break;
        }
      }
    } catch {
      // sovereign_audit_logs may not exist yet — non-fatal
    }

    const totalTier9Events = hnWatcherCount + derSettlementCount + conflictZoneCount + derHighValueCount;
    const liabilityAccruedUsd = totalTier9Events * TIER9_LIABILITY_USD;

    // ── Multi-Cloud D1/Firebase Sync — sync watcher totals (fire-and-forget) ──
    // Mirrors the aggregated watcher counter to Firebase Realtime DB for
    // cross-cloud parity. Non-blocking — failures do not affect the response.
    let firebaseSyncStatus = 'PENDING_CREDENTIALS';
    try {
      const syncResult = await syncD1RowToFirebase({
        id:              `tari-stats-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        event_type:      'TARI_STATS_SYNC',
        ip_address:      '0.0.0.0',
        target_path:     '/api/v1/tari-stats',
        threat_level:    0,
        tari_liability_usd: liabilityAccruedUsd,
        timestamp_ns:    new Date().toISOString(),
      });
      if (syncResult) {
        firebaseSyncStatus = 'SYNCED';
      }
    } catch {
      firebaseSyncStatus = 'SYNC_ERROR';
    }

    const response: TariStatsResponse = {
      trust_premium_index_pct: trustPremiumIndexPct,
      recent_entries: recent,
      total_entries: totalEntries,
      latest_revenue_projection: latest ? latest.revenue_projection : null,
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
