import { getCloudflareContext } from '@opennextjs/cloudflare';
import { d1ErrorResponse } from '../../../../lib/sovereignError';
import { getFirebaseStatus } from '../../../../lib/firebaseClient';

interface D1PreparedStatement {
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  FIREBASE_PROJECT_ID?: string;
  /** Stripe secret key — used for live revenue pull */
  STRIPE_SECRET_KEY?: string;
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

/** Minimal subset of a Stripe BalanceSummary response */
interface StripeBalance {
  available: Array<{ amount: number; currency: string }>;
  pending:   Array<{ amount: number; currency: string }>;
}

interface TariStatsResponse {
  trust_premium_index_pct: number | null;
  recent_entries: TariLedgerRow[];
  total_entries: number;
  latest_revenue_projection: number | null;
  // DER 2.0 / HN Watcher counts from sovereign_audit_logs (Phase 78.3)
  hn_watcher_count: number;
  der_settlement_count: number;
  conflict_zone_count: number;
  der_high_value_count: number;
  legal_scan_count: number;
  peer_access_count: number;
  total_tier9_events: number;
  watcher_liability_accrued: number;
  liability_accrued_usd: number;
  // Phase 78.5 — Firebase sync status
  firebase_sync_status: string;
  // Phase 117 — Firebase tari_metrics stream URL (Firestore collection: averyos-tari-probe)
  firebase_tari_metrics_url: string;
  // Phase 116.2 — Live Stripe revenue
  stripe_balance_available_usd: number | null;
  stripe_balance_pending_usd:   number | null;
  stripe_revenue_status:        string;
  timestamp: string;
}

/** TARI™ liability rates mirrored from audit-alert route for watcher accrual. */
const DER_SETTLEMENT_RATE_USD = 10_000;

/**
 * fetchStripeBalance()
 *
 * Retrieves the current Stripe account balance (available + pending).
 * Returns null fields when STRIPE_SECRET_KEY is not set or the call fails.
 * Non-blocking — never throws.
 */
async function fetchStripeBalance(stripeSecretKey: string): Promise<{
  availableUsd: number | null;
  pendingUsd:   number | null;
  status: string;
}> {
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    if (!res.ok) {
      return { availableUsd: null, pendingUsd: null, status: `STRIPE_HTTP_${res.status}` };
    }
    const balance = await res.json() as StripeBalance;
    const usdAvail  = balance.available?.find((b) => b.currency === "usd");
    const usdPending = balance.pending?.find((b) => b.currency === "usd");
    // Stripe amounts are in cents — convert to dollars
    const availableUsd = usdAvail   != null ? usdAvail.amount   / 100 : null;
    const pendingUsd   = usdPending != null ? usdPending.amount / 100 : null;
    return { availableUsd, pendingUsd, status: "ACTIVE" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { availableUsd: null, pendingUsd: null, status: `STRIPE_ERROR: ${msg.slice(0, 120)}` };
  }
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Live Stripe revenue pull (Phase 116.2) — non-blocking, runs in parallel ─
    const stripePromise = cfEnv.STRIPE_SECRET_KEY
      ? fetchStripeBalance(cfEnv.STRIPE_SECRET_KEY)
      : Promise.resolve({ availableUsd: null, pendingUsd: null, status: "PENDING_CREDENTIALS" });

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

    // ── Watcher Counter — Phase 78.3 / Phase 78.5 ─────────────────────────────
    // Count all Tier-9 event types + middleware-generated event types from sovereign_audit_logs.
    // Single conditional-aggregation query to minimise D1 round trips.
    // Returns 0 gracefully if sovereign_audit_logs doesn't exist yet or is empty.
    let hnWatcherCount     = 0;
    let derSettlementCount = 0;
    let conflictZoneCount  = 0;
    let derHighValueCount  = 0;
    let legalScanCount     = 0;
    let peerAccessCount    = 0;
    try {
      const watcherRow = await cfEnv.DB.prepare(
        `SELECT
           SUM(CASE WHEN event_type = 'HN_WATCHER'         THEN 1 ELSE 0 END) AS hn_cnt,
           SUM(CASE WHEN event_type = 'DER_SETTLEMENT'      THEN 1 ELSE 0 END) AS der_cnt,
           SUM(CASE WHEN event_type = 'CONFLICT_ZONE_PROBE' THEN 1 ELSE 0 END) AS conflict_cnt,
           SUM(CASE WHEN event_type = 'DER_HIGH_VALUE'      THEN 1 ELSE 0 END) AS high_value_cnt,
           SUM(CASE WHEN event_type = 'LEGAL_SCAN'          THEN 1 ELSE 0 END) AS legal_scan_cnt,
           SUM(CASE WHEN event_type = 'PEER_ACCESS'         THEN 1 ELSE 0 END) AS peer_access_cnt
         FROM sovereign_audit_logs`
      ).first() as {
        hn_cnt:          number | null;
        der_cnt:         number | null;
        conflict_cnt:    number | null;
        high_value_cnt:  number | null;
        legal_scan_cnt:  number | null;
        peer_access_cnt: number | null;
      } | null;
      hnWatcherCount     = watcherRow?.hn_cnt          ?? 0;
      derSettlementCount = watcherRow?.der_cnt         ?? 0;
      conflictZoneCount  = watcherRow?.conflict_cnt    ?? 0;
      derHighValueCount  = watcherRow?.high_value_cnt  ?? 0;
      legalScanCount     = watcherRow?.legal_scan_cnt  ?? 0;
      peerAccessCount    = watcherRow?.peer_access_cnt ?? 0;
    } catch {
      // Table may not exist yet — non-fatal, return zeros
    }

    const totalTier9Events      = hnWatcherCount + derSettlementCount + derHighValueCount + conflictZoneCount;
    const watcherLiabilityAccrued = derSettlementCount * DER_SETTLEMENT_RATE_USD;
    const liabilityAccruedUsd   = watcherLiabilityAccrued;
    const firebaseSyncStatus    = getFirebaseStatus();

    // Phase 117 — Build the Firebase tari_metrics live stream URL
    // Collection: averyos-tari-probe mirrors D1 tari_probe watcher rows for cross-cloud parity.
    const firebaseProjectId   = cfEnv.FIREBASE_PROJECT_ID;
    const firebaseTariMetricsUrl = firebaseProjectId
      ? `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
        `/databases/(default)/documents/averyos-tari-probe` +
        `?orderBy=timestamp%20desc&pageSize=20`
      : null;

    // ── Await Stripe balance (started in parallel above) ──────────────────
    const stripe = await stripePromise;

    const response: TariStatsResponse = {
      trust_premium_index_pct:          trustPremiumIndexPct,
      recent_entries:                   recent,
      total_entries:                    totalEntries,
      latest_revenue_projection:        latest ? latest.revenue_projection : null,
      hn_watcher_count:                 hnWatcherCount,
      der_settlement_count:             derSettlementCount,
      conflict_zone_count:              conflictZoneCount,
      der_high_value_count:             derHighValueCount,
      legal_scan_count:                 legalScanCount,
      peer_access_count:                peerAccessCount,
      total_tier9_events:               totalTier9Events,
      watcher_liability_accrued:        watcherLiabilityAccrued,
      liability_accrued_usd:            liabilityAccruedUsd,
      firebase_sync_status:             firebaseSyncStatus,
      firebase_tari_metrics_url:        firebaseTariMetricsUrl ?? "PENDING_CREDENTIALS",
      stripe_balance_available_usd:     stripe.availableUsd,
      stripe_balance_pending_usd:       stripe.pendingUsd,
      stripe_revenue_status:            stripe.status,
      timestamp:                        new Date().toISOString(),
    };

    return Response.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, 'tari_ledger');
  }
}
