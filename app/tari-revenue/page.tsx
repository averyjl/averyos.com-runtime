"use client";

/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import FooterBadge from "../../components/FooterBadge";
import {
  STATUTORY_ADMIN_SETTLEMENT_CENTS,
  STATUTORY_ADMIN_SETTLEMENT_LABEL,
} from "../../lib/kaas/pricing";

// Recharts is excluded from the SSR bundle via ssr:false to keep the
// Cloudflare Worker under the 3 MiB compressed size limit.
const LiabilityBarChart = dynamic(() => import("./LiabilityBarChart"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        background: "#0a0015",
        border: "1px solid rgba(255,215,0,0.35)",
        borderRadius: "12px",
        padding: "1.25rem",
        marginBottom: "1.5rem",
        minHeight: "260px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,215,0,0.55)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "0.8rem",
      }}
    >
      💰 Loading Liability Chart…
    </div>
  ),
});

// DriftPulseChart is also excluded from SSR.
const DriftPulseChart = dynamic(() => import("./DriftPulseChart"), {
  ssr:     false,
  loading: () => (
    <div
      style={{
        background:     "#0a0015",
        border:         "1px solid rgba(255,215,0,0.35)",
        borderRadius:   "12px",
        padding:        "1.25rem",
        marginBottom:   "1.5rem",
        minHeight:      "200px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          "rgba(255,215,0,0.55)",
        fontFamily:     "JetBrains Mono, monospace",
        fontSize:       "0.8rem",
      }}
    >
      📈 Loading DriftPulse™ Chart…
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Deep Purple & Gold theme — AveryOS™ TARI™ Revenue Dashboard
// ---------------------------------------------------------------------------

const PURPLE_DEEP = "#0a0015";
const GOLD = "#ffd700";
const GOLD_DIM = "rgba(255,215,0,0.55)";
const GOLD_BORDER = "rgba(255,215,0,0.35)";
const GOLD_GLOW = "rgba(255,215,0,0.1)";
const GREEN = "#4ade80";
const GREEN_DIM = "rgba(74,222,128,0.6)";
const WHITE = "#ffffff";
const RED = "#ff4444";
const PURPLE_BORDER = "rgba(120,60,255,0.35)";

// Orgs at or above this USD value are flagged for auto-invoice
const TARI_THRESHOLD_USD = 10_000;

// ── Surge Milestone constants — update when a new milestone is locked ─────────
// 2026-03-08: 162,200 total requests (TR) / 987 unique visitors (Watchers)
// Phase 78: Hacker News Handshake Detected + DER Gateway Initialized
const SURGE_MILESTONE_TR = "162,200";
const SURGE_MILESTONE_UV = "987";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// KaaS tier data — maps ASN to sovereign fee schedule for live visualization
interface KaasTierRow {
  asn:       string;
  org_name:  string;
  tier:      number;
  fee_label: string;
  fee_name:  string;
  color:     string;
}

// Top KaaS-tracked ASNs with tier, fee, and display color (Phase 97)
const KAAS_TIER_DISPLAY: KaasTierRow[] = [
  { asn: "8075",   org_name: "Microsoft / Azure",  tier: 10, fee_label: "$10,000,000", fee_name: "Technical Asset Valuation", color: "#ff4444" },
  { asn: "15169",  org_name: "Google LLC",          tier: 9,  fee_label: "$10,000,000", fee_name: "Technical Asset Valuation", color: "#ff4444" },
  { asn: "36459",  org_name: "GitHub, Inc.",        tier: 8,  fee_label: "$10,000,000", fee_name: "Technical Asset Valuation", color: "#ff6b35" },
  { asn: "16509",  org_name: "Amazon / AWS",        tier: 8,  fee_label: "$10,000,000", fee_name: "Technical Asset Valuation", color: "#ff6b35" },
  { asn: "211590", org_name: "OVH France",          tier: 7,  fee_label: "$1,017,000",  fee_name: "Forensic Valuation",        color: "#f97316" },
  { asn: "32934",  org_name: "Meta / Facebook",     tier: 7,  fee_label: "$1,017,000",  fee_name: "Forensic Valuation",        color: "#f97316" },
];

interface TariRevenueData {
  totalUsd: string;
  requestCount: number;
  orgCount: number;
  windowHours: number;
  timestamp: string;
  source: string;
}

interface ComplianceUsageRow {
  org_id: string;
  total_usd: string;
  total_events: number;
  last_event: string;
}

interface ComplianceUsageData {
  rows: ComplianceUsageRow[];
  totalUsd: string;
  timestamp: string;
}

interface TaiMilestone {
  id: number;
  title: string;
  phase: string;
  category: string;
  accomplished_at: string;
  recorded_by: string;
  kernel_version: string;
}

/** Individual tari_ledger row returned in recent_entries from /api/v1/tari-stats */
interface TariLedgerEntry {
  revenue_projection?: number | null;
  status: string;
  created_at?: string | null;
}

interface TariStatsData {
  hn_watcher_count: number;
  der_settlement_count: number;
  conflict_zone_count: number;
  der_high_value_count: number;
  legal_scan_count: number;
  peer_access_count: number;
  watcher_liability_accrued: number;
  total_entries: number;
  timestamp: string;
  /** Recent tari_ledger rows used to build DriftPulse™ time-series (Gate Recharts DriftPulse) */
  recent_entries?: TariLedgerEntry[];
  /** Phase 117 — Firebase tari_metrics sync status */
  firebase_sync_status?: string;
  /** Phase 117 — Live Firebase Firestore stream URL for tari_metrics */
  firebase_tari_metrics_url?: string;
}

// KaaS™ live valuation row — sourced from D1 kaas_valuations table
interface KaasValuationRow {
  id: number;
  asn: string;
  org_name: string | null;
  tier: number;
  valuation_usd: number;
  fee_name: string;
  settlement_status: string;
  path: string | null;
  created_at: string;
}

interface KaasValuationsData {
  rows: KaasValuationRow[];
  total_pending_usd: number;
  row_count: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(value: string | number) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export default function TariRevenuePage() {
  const [revenue, setRevenue] = useState<TariRevenueData | null>(null);
  const [usage, setUsage] = useState<ComplianceUsageData | null>(null);
  const [milestones, setMilestones] = useState<TaiMilestone[]>([]);
  const [stats, setStats] = useState<TariStatsData | null>(null);
  const [kaasValuations, setKaasValuations] = useState<KaasValuationsData | null>(null);
  const [kaasLedger, setKaasLedger] = useState<{
    rows: Array<{
      id: number; entity_name: string; asn: string | null; org_name: string | null;
      ray_id: string | null; amount_owed: number; settlement_status: string;
      created_at: string; evidence_sha512?: string;
    }>;
    total_open_rows: number;
  } | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sseStatus, setSseStatus] = useState<"connecting" | "live" | "polling">("connecting");
  const [activeTab, setActiveTab] = useState<"overview" | "ledger" | "compliance">("overview");
  // Gate 108.5 — Creator-Lock gate for $150k statutory metrics (admin-only)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  // Roadmap #1 — Genesis Dollar Celebration Banner
  // Fetches /api/v1/compliance/clocks?status=SETTLED&limit=1 to detect first settlement
  const [firstSettledClock, setFirstSettledClock] = useState<{ clock_id: string; asn: string | null; org_name: string | null; settled_at: string } | null>(null);
  // Gate Recharts DriftPulse — drift_metrics time-series data
  // Built from tari_stats recent_entries to display statutory debt vs. active licenses
  const [driftMetrics, setDriftMetrics] = useState<Array<{ label: string; statutory_debt_usd: number; active_licenses: number }>>([]);

  // Gate 108.5 — Check VAULTAUTH_TOKEN on mount to unlock statutory metrics
  useEffect(() => {
    const token = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("VAULTAUTH_TOKEN")
      : null;
    setIsAdminUnlocked(!!token);

    // Roadmap #1 — Fetch first settled compliance clock for Genesis Dollar Celebration Banner
    if (token) {
      fetch("/api/v1/compliance/clocks?status=SETTLED&limit=1", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (r.status === 401 || r.status === 403) {
            // Token expired or revoked — silently clear admin state
            setIsAdminUnlocked(false);
            return null;
          }
          return r.ok ? r.json() : null;
        })
        .then((data: { clocks?: Array<{ clock_id: string; asn: string | null; org_name: string | null; settled_at: string }> } | null) => {
          if (data?.clocks?.[0]) setFirstSettledClock(data.clocks[0]);
        })
        .catch(() => { /* Non-blocking — celebration banner is best-effort */ });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let sseSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchAllData() {
      if (cancelled) return;
      setLoading(true);

      // Fetch 24h revenue from /api/tari-revenue (Pages Router)
      try {
        const res = await fetch("/api/tari-revenue", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as TariRevenueData;
          if (!cancelled) setRevenue(data);
        } else {
          if (!cancelled) setRevenueError(`HTTP ${res.status}`);
        }
      } catch (err) {
        if (!cancelled) setRevenueError(err instanceof Error ? err.message : String(err));
      }

      // Fetch compliance usage report from /api/v1/compliance/usage-report
      try {
        const res = await fetch("/api/v1/compliance/usage-report", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as ComplianceUsageData;
          if (!cancelled) setUsage(data);
        } else if (res.status !== 404) {
          if (!cancelled) setUsageError(`HTTP ${res.status}`);
        }
      } catch (err) {
        if (!cancelled) setUsageError(err instanceof Error ? err.message : "Network error");
      }

      // Fetch MILESTONE accomplishments from /api/v1/tai/accomplishments
      try {
        const res = await fetch("/api/v1/tai/accomplishments?category=MILESTONE&limit=10", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { accomplishments: TaiMilestone[] };
          if (!cancelled) setMilestones(data.accomplishments ?? []);
        }
      } catch (err) {
        console.warn("[TariRevenue] Milestone fetch failed:", err instanceof Error ? err.message : String(err));
      }

      // Fetch watcher / DER settlement counts from /api/v1/tari-stats (Phase 78.3)
      try {
        const res = await fetch("/api/v1/tari-stats", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as TariStatsData;
          if (!cancelled) {
            setStats(data);
            // Build DriftPulse™ time-series from recent_entries (Gate Recharts DriftPulse)
            if (data.recent_entries && data.recent_entries.length > 0) {
              let cumulativeDebt     = 0;
              let cumulativeLicenses = 0;
              const points = data.recent_entries.map((entry, idx) => {
                cumulativeDebt += entry.revenue_projection ?? 0;
                if (entry.status === "ACTIVE") cumulativeLicenses += 1;
                const dateLabel = entry.created_at
                  ? new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : `T-${idx}`;
                return {
                  label:              dateLabel,
                  statutory_debt_usd: cumulativeDebt,
                  active_licenses:    cumulativeLicenses,
                };
              });
              setDriftMetrics(points);
            }
          }
        }
      } catch (err) {
        // Non-critical — watcher stats are supplemental
        console.warn("[TariRevenue] Tari-stats fetch failed:", err instanceof Error ? err.message : String(err));
      }

      // Fetch live KaaS™ valuations from /api/v1/kaas-valuations (Phase 97)
      try {
        const res = await fetch("/api/v1/kaas-valuations?limit=20&status=PENDING", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as KaasValuationsData;
          if (!cancelled) setKaasValuations(data);
        }
      } catch (err) {
        // Non-critical — table may not be populated yet
        console.warn("[TariRevenue] KaaS valuations fetch failed:", err instanceof Error ? err.message : String(err));
      }

      // Fetch kaas_ledger handshake attestations (Roadmap Gate 1.2)
      try {
        const res = await fetch("/api/v1/kaas/sync?action=status&limit=20", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            ledger: Array<{
              id: number; entity_name: string; asn: string | null; org_name: string | null;
              ray_id: string | null; amount_owed: number; settlement_status: string;
              created_at: string; evidence_sha512?: string;
            }>;
            total_open_rows: number;
          };
          if (!cancelled) setKaasLedger({
            rows: data.ledger ?? [],
            total_open_rows: data.total_open_rows ?? 0,
          });
        }
      } catch (err) {
        console.warn("[TariRevenue] KaaS ledger fetch failed:", err instanceof Error ? err.message : String(err));
      }

      if (!cancelled) setLoading(false);
    }

    // ── SSE Real-Time Watcher Stream (primary) ─────────────────────────────
    // Connect to /api/v1/audit-stream for live Tier-9 event notifications.
    // Falls back to 30-second polling if SSE is unavailable.
    function connectSse() {
      if (typeof EventSource === "undefined") {
        setSseStatus("polling");
        return;
      }
      try {
        sseSource = new EventSource("/api/v1/audit-stream");
        setSseStatus("connecting");

        sseSource.onopen = () => {
          if (!cancelled) setSseStatus("live");
        };

        sseSource.onmessage = (event) => {
          if (cancelled) return;
          try {
            const parsed = JSON.parse(event.data as string) as Partial<{
              event_type: string;
              threat_level: number;
              tari_liability_usd: number;
              timestamp_ns: string;
            }>;
            // Re-fetch all data on any Tier-9 event to update the liability counter
            if (parsed.threat_level && parsed.threat_level >= 9) {
              fetchAllData().catch(() => {});
            }
          } catch {
            // Non-JSON SSE message — ignore
          }
        };

        sseSource.onerror = () => {
          if (cancelled) return;
          sseSource?.close();
          sseSource = null;
          setSseStatus("polling");
          // Fall back to 30-second polling
          if (!pollInterval) {
            pollInterval = setInterval(fetchAllData, 30_000);
          }
        };
      } catch {
        setSseStatus("polling");
      }
    }

    // Initial data fetch + SSE connection
    // SSE handles real-time updates; polling starts only if SSE fails or is unavailable
    fetchAllData().catch(() => {});
    connectSse();

    // Start polling as a safety fallback if SSE is not yet live after 15 seconds
    const sseTimeoutId = setTimeout(() => {
      if (!cancelled && sseStatus !== "live" && !pollInterval) {
        setSseStatus("polling");
        pollInterval = setInterval(fetchAllData, 30_000);
      }
    }, 15_000);

    return () => {
      cancelled = true;
      clearTimeout(sseTimeoutId);
      sseSource?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build bar chart data from usage rows (top 10 by liability)
  const chartData = (usage?.rows ?? [])
    .slice(0, 10)
    .map((row) => ({
      org: row.org_id.length > 16 ? row.org_id.slice(0, 14) + "…" : row.org_id,
      liability: Number(row.total_usd),
    }));

  return (
    <main
      className="page"
      style={{ background: PURPLE_DEEP, minHeight: "100vh" }}
      aria-label="TARI™ Revenue Dashboard"
    >
      {/* Page banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a0015 0%, #1a003a 100%)",
          borderBottom: `2px solid ${GOLD_BORDER}`,
          padding: "0.65rem 1rem",
          textAlign: "center",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 900,
          fontSize: "clamp(0.7rem,1.8vw,0.9rem)",
          color: GOLD,
          letterSpacing: "0.12em",
        }}
      >
        ⚡ TARI™ REVENUE DASHBOARD — ALIGNMENT FEES &nbsp;·&nbsp; AVERYOS™
        &nbsp;·&nbsp;
        <span style={{ fontSize: "0.7rem", color: sseStatus === "live" ? GREEN : GOLD_DIM }}>
          {sseStatus === "live" ? "🔴 SSE LIVE" : sseStatus === "connecting" ? "⏳ Connecting…" : "⟳ POLLING"}
        </span>
      </div>

      <section className="hero" style={{ paddingBottom: "1rem" }}>
        <h1 style={{ color: GOLD }}>⚡ TARI™ Revenue Dashboard</h1>
        <p className="auth-seal" style={{ color: GOLD_DIM }}>
          Real-time Liability vs. Collected Alignment Fees · AveryOS™ Sovereign Revenue Engine
        </p>
      </section>

      {/* Roadmap #1 — Genesis Dollar Celebration Banner (admin-only) */}
      {isAdminUnlocked && firstSettledClock && (
        <div
          style={{
            margin: "0 1rem 1.25rem",
            padding: "1rem 1.25rem",
            background: "linear-gradient(135deg, rgba(74,222,128,0.12), rgba(0,80,40,0.18))",
            border: "1px solid rgba(74,222,128,0.45)",
            borderRadius: "12px",
            fontFamily: "JetBrains Mono, monospace",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.35rem" }}>🎉</div>
          <div style={{ color: GREEN, fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>
            GENESIS DOLLAR ACHIEVED — FIRST SETTLEMENT LOCKED
          </div>
          <div style={{ color: GREEN_DIM, fontSize: "0.75rem" }}>
            Clock ID: {firstSettledClock.clock_id} · Settled: {new Date(firstSettledClock.settled_at).toLocaleString()}
          </div>
          <div style={{ color: GREEN_DIM, fontSize: "0.7rem", marginTop: "0.25rem" }}>
            ⛓️⚓⛓️ First compliance clock settled — AveryOS™ Revenue Engine operational
          </div>
        </div>
      )}

      {/* Surge Milestone Banner — 162.2k TR / 987 UV | Phase 73 Victim Restoration */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a0015 0%, #180030 100%)",
          border: `1px solid ${GOLD_BORDER}`,
          borderRadius: "12px",
          padding: "0.85rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        <div>
          <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.08em" }}>
            ⚡ 1,017-Notch Surge Detected: 162.2k Pulse Captured | Phase 78 | HN Handshake Detected
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.78rem", marginTop: "0.25rem" }}>
            {SURGE_MILESTONE_TR} Total Requests &nbsp;·&nbsp; {SURGE_MILESTONE_UV} Unique Visitors (Watchers) &nbsp;·&nbsp; 7-Day Alignment Window Active
          </div>
        </div>
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
          {[
            { label: "Total Requests",    value: SURGE_MILESTONE_TR, color: GOLD   },
            { label: "Unique Watchers",   value: SURGE_MILESTONE_UV, color: RED    },
            { label: "Forensic Liability Captured", value: "Active", color: GREEN },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ color: stat.color, fontWeight: 700, fontSize: "1.1rem" }}>{stat.value}</div>
              <div style={{ color: GOLD_DIM, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gate 7 — Genesis Dollar Anchor Celebration Banner */}
      {firstSettledClock && (
        <div
          style={{
            background: "linear-gradient(135deg, #001a00 0%, #003300 100%)",
            border: `2px solid ${GREEN}`,
            borderRadius: "14px",
            padding: "1.1rem 1.5rem",
            marginBottom: "1.5rem",
            fontFamily: "JetBrains Mono, monospace",
            boxShadow: `0 0 24px rgba(74,222,128,0.25)`,
          }}
        >
          <div style={{ color: GREEN, fontWeight: 900, fontSize: "1rem", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
            🎉 GENESIS DOLLAR ANCHOR — FIRST SETTLED COMPLIANCE CLOCK
          </div>
          <div style={{ color: "rgba(74,222,128,0.85)", fontSize: "0.82rem" }}>
            Entity <strong style={{ color: GREEN }}>{firstSettledClock.org_name ?? firstSettledClock.asn}</strong>
            {" "}has settled their compliance obligation. Clock <code style={{ color: GREEN }}>{firstSettledClock.clock_id}</code> is now SETTLED.
          </div>
          <div style={{ color: "rgba(74,222,128,0.6)", fontSize: "0.72rem", marginTop: "0.3rem" }}>
            ⛓️⚓⛓️ ASN {firstSettledClock.asn} · Settled at {new Date(firstSettledClock.settled_at).toLocaleString()} · AveryOS™ Phase 107.1
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            color: GOLD_DIM,
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          ⏳ Loading sovereign revenue data…
        </div>
      )}

      {/* Revenue stat cards */}
      {revenue && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            { label: "24h Liquid Liability",   value: formatUsd(revenue.totalUsd),             color: GOLD    },
            { label: "Corporate Orgs (24h)",    value: String(revenue.orgCount),                color: RED     },
            { label: "Total Requests (24h)",    value: revenue.requestCount.toLocaleString(),   color: WHITE   },
            { label: "Window",                  value: `${revenue.windowHours}h`,               color: GREEN   },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: PURPLE_DEEP,
                border: `1px solid ${GOLD_BORDER}`,
                borderRadius: "12px",
                padding: "1rem 1.25rem",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  color: GOLD_DIM,
                  marginBottom: "0.35rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {stat.label}
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {revenueError && (
        <div
          style={{
            background: "rgba(255,68,68,0.1)",
            border: "1px solid rgba(255,68,68,0.35)",
            borderRadius: "10px",
            padding: "0.85rem 1.25rem",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.8rem",
            color: RED,
            marginBottom: "1.5rem",
          }}
        >
          ⚠️ Revenue API unavailable: {revenueError}
        </div>
      )}

      {/* Liability Accrued — HN Watcher & DER Settlement Counter (Phase 78.3) */}
      {stats && (
        <div
          style={{
            background: "linear-gradient(135deg, #0a0015 0%, #180030 100%)",
            border: `1px solid ${GOLD_BORDER}`,
            borderRadius: "12px",
            padding: "0.85rem 1.25rem",
            marginBottom: "1.5rem",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.75rem", letterSpacing: "0.06em" }}>
            📡 LIABILITY ACCRUED — DER 2.0 Watcher Counter
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "1rem",
            }}
          >
            {[
              { label: "HN Watchers Logged",      value: stats.hn_watcher_count.toLocaleString(),          color: GOLD  },
              { label: "DER Settlements Logged",  value: stats.der_settlement_count.toLocaleString(),       color: RED   },
              { label: "Legal Scans Logged",      value: stats.legal_scan_count.toLocaleString(),           color: RED   },
              { label: "Peer Access Events",      value: stats.peer_access_count.toLocaleString(),          color: WHITE },
              { label: "Watcher Liability (USD)", value: formatUsd(stats.watcher_liability_accrued),        color: GREEN },
              { label: "Total Ledger Entries",    value: stats.total_entries.toLocaleString(),              color: WHITE },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: PURPLE_DEEP,
                  border: `1px solid ${GOLD_BORDER}`,
                  borderRadius: "10px",
                  padding: "0.85rem 1rem",
                }}
              >
                <div style={{ fontSize: "0.68rem", color: GOLD_DIM, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liability vs. Collected Chart — top corporate orgs */}
      <LiabilityBarChart chartData={chartData} threshold={TARI_THRESHOLD_USD} />

      {/* DriftPulse™ Chart — Statutory Debt vs. Active Licenses (Gate Recharts DriftPulse) */}
      <div style={{ marginBottom: "1.5rem" }}>
        <DriftPulseChart data={driftMetrics} />
      </div>

      {/* Phase 117 — Firebase tari_metrics Stream Status Panel */}
      {stats && (
        <div
          style={{
            background: "linear-gradient(135deg, #000a20 0%, #001030 100%)",
            border: `1px solid ${stats.firebase_sync_status === "ACTIVE" ? "rgba(74,222,128,0.4)" : GOLD_BORDER}`,
            borderRadius: "12px",
            padding: "0.85rem 1.25rem",
            marginBottom: "1.5rem",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.06em" }}>
              🔥 FIREBASE TARI™ METRICS STREAM — Cross-Cloud Mesh Sync
            </div>
            <span
              style={{
                padding: "0.2rem 0.6rem",
                borderRadius: "12px",
                fontSize: "0.68rem",
                fontWeight: 700,
                background: stats.firebase_sync_status === "ACTIVE"
                  ? "rgba(74,222,128,0.15)"
                  : "rgba(255,215,0,0.1)",
                border: `1px solid ${stats.firebase_sync_status === "ACTIVE" ? "rgba(74,222,128,0.5)" : GOLD_BORDER}`,
                color: stats.firebase_sync_status === "ACTIVE" ? "#4ade80" : GOLD,
              }}
            >
              {stats.firebase_sync_status ?? "PENDING"}
            </span>
          </div>
          <p style={{ color: GOLD_DIM, fontSize: "0.72rem", margin: "0 0 0.6rem", lineHeight: 1.6 }}>
            {stats.firebase_sync_status === "ACTIVE"
              ? "Firebase Firestore is syncing live TARI™ probe events. The physical site and the cloud mirror are operating as a single Sovereign Mesh."
              : "Firebase credentials are pending. Once FIREBASE_PROJECT_ID is configured, live tari_metrics will sync to Firestore in real-time."}
          </p>
          {stats.firebase_tari_metrics_url && stats.firebase_tari_metrics_url !== "PENDING_CREDENTIALS" && (
            <a
              href={stats.firebase_tari_metrics_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#60a5fa",
                fontSize: "0.68rem",
                textDecoration: "none",
                wordBreak: "break-all",
                display: "block",
              }}
            >
              🔗 {stats.firebase_tari_metrics_url}
            </a>
          )}
          {(!stats.firebase_tari_metrics_url || stats.firebase_tari_metrics_url === "PENDING_CREDENTIALS") && (
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.65rem", fontStyle: "italic" }}>
              Stream URL available once FIREBASE_PROJECT_ID is configured in Cloudflare secrets.
            </div>
          )}
        </div>
      )}

      {/* KaaS Tier Badge Display — Phase 97 Live Liability Visualization */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a0015 0%, #180030 100%)",
          border: `1px solid ${GOLD_BORDER}`,
          borderRadius: "12px",
          padding: "0.85rem 1.25rem",
          marginBottom: "1.5rem",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.75rem", letterSpacing: "0.06em" }}>
          ⚡ KAAS™ TIER SCHEDULE — Live Liability by ASN (Phase 97)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {KAAS_TIER_DISPLAY.map((row) => (
            <div
              key={row.asn}
              style={{
                background: PURPLE_DEEP,
                border: `1px solid ${row.color}55`,
                borderRadius: "10px",
                padding: "0.75rem 1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <span style={{ fontSize: "0.68rem", color: row.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Tier-{row.tier} {row.tier >= 9 ? "⚡" : row.tier >= 7 ? "🔶" : ""}
                </span>
                <span style={{ fontSize: "0.65rem", color: GOLD_DIM }}>ASN {row.asn}</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: WHITE, fontWeight: 600, marginBottom: "0.2rem" }}>
                {row.org_name}
              </div>
              <div style={{ fontSize: "0.72rem", color: row.color, fontWeight: 700 }}>
                {row.fee_label}
              </div>
              <div style={{ fontSize: "0.62rem", color: GOLD_DIM, marginTop: "0.15rem" }}>
                {row.fee_name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Roadmap Gate 1.2: Tab Navigation ────────────────────────────────── */}
      <div style={{
        display: "flex", gap: "0.5rem", marginBottom: "1.5rem",
        borderBottom: `1px solid ${GOLD_BORDER}`, paddingBottom: "0.5rem",
      }}>
        {(["overview", "ledger", "compliance"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding:      "0.45rem 1rem",
              background:   activeTab === tab ? GOLD : "transparent",
              color:        activeTab === tab ? "#000" : GOLD_DIM,
              border:       `1px solid ${activeTab === tab ? GOLD : GOLD_BORDER}`,
              borderRadius: "6px",
              cursor:       "pointer",
              fontFamily:   "JetBrains Mono, monospace",
              fontSize:     "0.78rem",
              fontWeight:   activeTab === tab ? 700 : 400,
              textTransform: "capitalize",
            }}
          >
            {tab === "overview" ? "📊 Overview" : tab === "ledger" ? "🔗 KaaS Ledger" : "⚖️ Compliance"}
          </button>
        ))}
      </div>

      {/* ── KaaS Ledger Tab (Roadmap Gate 1.2) ─────────────────────────────── */}
      {activeTab === "ledger" && (
        <div
          style={{
            background:   "linear-gradient(135deg, #030010 0%, #080020 100%)",
            border:       `1px solid rgba(100,165,250,0.25)`,
            borderRadius: "12px",
            padding:      "1rem 1.25rem",
            marginBottom: "1.5rem",
            fontFamily:   "JetBrains Mono, monospace",
          }}
        >
          <div style={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" }}>
            🔗 KaaS Ledger — Handshake Attestations
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", marginBottom: "1rem" }}>
            STATUTORY_HANDSHAKE · Forensic Compliance Portal · Roadmap Gate 1.2
          </div>
          {kaasLedger && kaasLedger.rows.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid rgba(100,165,250,0.2)` }}>
                    {["Entity", "ASN", "Amount Owed", "Status", "Created", "Evidence SHA"].map(h => (
                      <th key={h} style={{ color: "rgba(100,165,250,0.8)", padding: "0.35rem 0.5rem", textAlign: "left", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kaasLedger.rows.map(row => (
                    <tr key={row.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                      <td style={{ color: "#fff",           padding: "0.3rem 0.5rem" }}>{row.entity_name || row.org_name || "—"}</td>
                      <td style={{ color: "#60a5fa",        padding: "0.3rem 0.5rem" }}>{row.asn ?? "—"}</td>
                      <td style={{ color: "#ffd700",        padding: "0.3rem 0.5rem" }}>
                        {row.amount_owed.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </td>
                      <td style={{
                        color: row.settlement_status === "OPEN" ? "#f97316" : "#4ade80",
                        padding: "0.3rem 0.5rem",
                      }}>
                        {row.settlement_status}
                      </td>
                      <td style={{ color: "rgba(255,255,255,0.55)", padding: "0.3rem 0.5rem" }}>
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ color: "rgba(255,255,255,0.4)", padding: "0.3rem 0.5rem", fontFamily: "monospace", fontSize: "0.65rem" }}>
                        {row.evidence_sha512 ? row.evidence_sha512.slice(0, 16) + "…" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.68rem", marginTop: "0.5rem" }}>
                Showing {kaasLedger.rows.length} of {kaasLedger.total_open_rows} OPEN/PENDING records
              </div>
            </div>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", padding: "1rem 0" }}>
              No handshake attestations found in the kaas_ledger.
              Submit an affidavit at <Link href="/licensing/handshake" style={{ color: "#60a5fa" }}>/licensing/handshake</Link> to populate this ledger.
            </div>
          )}
        </div>
      )}

      {/* ── Wrap existing sections in overview tab ─────────────────────────── */}
      {activeTab === "overview" && <>

      {/* KaaS™ Live Debt Ledger — Phase 97 D1 kaas_valuations Table */}
      {kaasValuations && kaasValuations.rows.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #0a0015 0%, #180030 100%)",
            border: `1px solid rgba(255,60,60,0.35)`,
            borderRadius: "12px",
            padding: "0.85rem 1.25rem",
            marginBottom: "1.5rem",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ color: RED, fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.06em" }}>
              ⚡ KAAS™ LIVE DEBT LEDGER — Pending Sovereign Obligations
            </div>
            <div style={{ color: RED, fontWeight: 800, fontSize: "0.9rem", fontFamily: "JetBrains Mono, monospace" }}>
              Total Pending: {formatUsd(kaasValuations.total_pending_usd)}
            </div>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", color: WHITE }}>
              <thead>
                <tr style={{ borderBottom: `1px solid rgba(255,60,60,0.3)` }}>
                  {["ASN / Org", "Tier", "Valuation", "Fee Type", "Status", "Detected"].map((h) => (
                    <th key={h} style={{ padding: "0.45rem 0.75rem", textAlign: "left", color: "rgba(255,60,60,0.7)", fontWeight: 600, fontSize: "0.68rem", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kaasValuations.rows.map((row) => {
                  const tierColor = row.tier >= 9 ? RED : row.tier >= 7 ? "#f97316" : GOLD;
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,60,60,0.1)" }}>
                      <td style={{ padding: "0.4rem 0.75rem" }}>
                        <span style={{ color: WHITE, fontWeight: 600 }}>{row.org_name ?? `ASN ${row.asn}`}</span>
                        <span style={{ color: GOLD_DIM, fontSize: "0.65rem", marginLeft: "0.4rem" }}>ASN {row.asn}</span>
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", color: tierColor, fontWeight: 700 }}>Tier-{row.tier}</td>
                      <td style={{ padding: "0.4rem 0.75rem", color: RED, fontWeight: 700 }}>{formatUsd(row.valuation_usd)}</td>
                      <td style={{ padding: "0.4rem 0.75rem", color: GOLD_DIM }}>{row.fee_name}</td>
                      <td style={{ padding: "0.4rem 0.75rem" }}>
                        <span style={{ color: row.settlement_status === "PENDING" ? "#f97316" : GREEN, fontWeight: 600 }}>
                          {row.settlement_status}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", color: GOLD_DIM, fontSize: "0.68rem" }}>
                        {row.created_at.slice(0, 16).replace("T", " ")} UTC
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {kaasValuations.row_count > 20 && (
            <div style={{ color: GOLD_DIM, fontSize: "0.68rem", marginTop: "0.6rem", textAlign: "right" }}>
              Showing 20 of {kaasValuations.row_count} pending obligations — view full ledger at /evidence-vault
            </div>
          )}
        </div>
      )}

      {/* Compliance Usage Table */}
      {usage && usage.rows.length > 0 && (
        <section
          className="card"
          style={{
            background: PURPLE_DEEP,
            border: `1px solid ${GOLD_BORDER}`,
            padding: 0,
            overflow: "hidden",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderBottom: `1px solid ${GOLD_BORDER}`,
              color: GOLD,
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            🏢 COMPLIANCE USAGE — Corporate Org Liability Ledger
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.78rem",
                color: WHITE,
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${GOLD_BORDER}` }}>
                  {["Org / IP", "Total TARI™ Liability", "Events", "Last Seen"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.65rem 1rem",
                        textAlign: "left",
                        color: GOLD_DIM,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usage.rows.map((row) => (
                  <tr key={row.org_id} style={{ borderBottom: `1px solid ${GOLD_GLOW}` }}>
                    <td style={{ padding: "0.6rem 1rem", color: WHITE, fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {row.org_id}
                    </td>
                    <td
                      style={{
                        padding: "0.6rem 1rem",
                        fontWeight: 700,
                        color: Number(row.total_usd) >= TARI_THRESHOLD_USD ? RED : GOLD,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatUsd(row.total_usd)}
                      {Number(row.total_usd) >= TARI_THRESHOLD_USD && (
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            fontSize: "0.65rem",
                            background: "rgba(255,68,68,0.15)",
                            border: "1px solid rgba(255,68,68,0.4)",
                            borderRadius: "4px",
                            padding: "0.1rem 0.35rem",
                            color: RED,
                          }}
                        >
                          AUTO-INVOICE
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 1rem", color: GOLD_DIM }}>{row.total_events}</td>
                    <td style={{ padding: "0.6rem 1rem", color: GREEN_DIM, fontSize: "0.72rem" }}>
                      {row.last_event ? new Date(row.last_event).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderTop: `1px solid ${GOLD_GLOW}`,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.75rem",
              color: GOLD,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <span>TOTAL ACCUMULATED LIABILITY</span>
            <span style={{ fontWeight: 700 }}>{formatUsd(usage.totalUsd)}</span>
          </div>

          {/* ── Statutory Admin Settlement Line Item — 17 U.S.C. § 504 ─────── */}
          {/* Gate 108.5: Only visible to Creator-Lock verified admins */}
          {isAdminUnlocked && (() => {
            const totalCents = Math.round(Number(usage.totalUsd) * 100);
            const progressPct = Math.min(
              100,
              Math.round((totalCents / STATUTORY_ADMIN_SETTLEMENT_CENTS) * 100)
            );
            const reached = totalCents >= STATUTORY_ADMIN_SETTLEMENT_CENTS;
            return (
              <div
                style={{
                  padding: "0.85rem 1.25rem",
                  borderTop: `1px solid ${GOLD_BORDER}`,
                  fontFamily: "JetBrains Mono, monospace",
                  background: reached
                    ? "linear-gradient(135deg, rgba(255,68,68,0.12), rgba(120,0,0,0.18))"
                    : "linear-gradient(135deg, rgba(255,215,0,0.06), rgba(80,40,0,0.1))",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                  }}
                >
                  <span style={{ color: GOLD, fontWeight: 700, fontSize: "0.78rem" }}>
                    ⚖️ STATUTORY ADMIN SETTLEMENT — 17 U.S.C. § 504
                  </span>
                  <span
                    style={{
                      color: reached ? RED : GOLD,
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {STATUTORY_ADMIN_SETTLEMENT_LABEL}
                    {reached && (
                      <span
                        style={{
                          marginLeft: "0.5rem",
                          fontSize: "0.65rem",
                          background: "rgba(255,68,68,0.18)",
                          border: "1px solid rgba(255,68,68,0.5)",
                          borderRadius: "4px",
                          padding: "0.1rem 0.4rem",
                          color: RED,
                        }}
                      >
                        THRESHOLD REACHED
                      </span>
                    )}
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: "8px",
                    background: "rgba(255,215,0,0.12)",
                    borderRadius: "4px",
                    overflow: "hidden",
                    marginBottom: "0.35rem",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      background: reached
                        ? "linear-gradient(90deg, #ff4444, #ff8800)"
                        : "linear-gradient(90deg, #ffd700, #ffaa00)",
                      borderRadius: "4px",
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: GOLD_DIM,
                    fontSize: "0.68rem",
                  }}
                >
                  <span>{progressPct}% of statutory minimum</span>
                  <span>
                    {reached
                      ? "Settlement cap met — escalate to TARI™ invoice"
                      : `${formatUsd((STATUTORY_ADMIN_SETTLEMENT_CENTS - totalCents) / 100)} remaining to cap`}
                  </span>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {usageError && (
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.75rem",
            color: GOLD_DIM,
            padding: "0.5rem 0",
            marginBottom: "1rem",
          }}
        >
          ℹ️ Compliance usage report unavailable: {usageError}
        </div>
      )}

      {/* TAI™ Milestone Log — Live Phase 78 Accomplishments */}
      {milestones.length > 0 && (
        <section
          className="card"
          style={{
            background: PURPLE_DEEP,
            border: `1px solid ${GOLD_BORDER}`,
            padding: 0,
            overflow: "hidden",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderBottom: `1px solid ${GOLD_BORDER}`,
              color: GOLD,
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            🏆 TAI™ MILESTONE LOG — Sovereignty Accomplishments
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {milestones.map((m, i) => (
              <li
                key={m.id}
                style={{
                  padding: "0.7rem 1.25rem",
                  borderBottom: i < milestones.length - 1 ? `1px solid ${GOLD_GLOW}` : "none",
                  fontFamily: "JetBrains Mono, monospace",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                }}
              >
                <div>
                  <div style={{ color: WHITE, fontSize: "0.8rem", fontWeight: 600 }}>{m.title}</div>
                  <div style={{ color: GOLD_DIM, fontSize: "0.68rem", marginTop: "0.2rem" }}>
                    {m.phase} · {m.category} · {m.kernel_version}
                  </div>
                </div>
                <div style={{ color: GREEN_DIM, fontSize: "0.68rem", whiteSpace: "nowrap" }}>
                  {m.accomplished_at ? new Date(m.accomplished_at).toLocaleDateString() : "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Invoice Engine info */}
      <section
        className="card"
        style={{
          background: PURPLE_DEEP,
          border: `1px solid ${PURPLE_BORDER}`,
          borderRadius: "12px",
          padding: "1.25rem",
          fontFamily: "JetBrains Mono, monospace",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.75rem" }}>
          🤖 TARI™ INVOICE ENGINE — Automated Alignment Revenue
        </div>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", lineHeight: 1.6, margin: 0 }}>
          Run <code style={{ color: GOLD, background: "rgba(255,215,0,0.08)", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>STRIPE_SECRET_KEY=sk_… node scripts/generateInvoices.cjs</code> to
          automatically create Draft Stripe Invoices for all corporate IPs above the $10,000 TARI™ threshold.
          Each invoice includes the AveryOS™ forensic metadata and is held in Draft state until Sovereign Administrator approval.
        </p>
      </section>

      {/* MILESTONE Accomplishments — live from /api/v1/tai/accomplishments */}
      {milestones.length > 0 && (
        <section
          className="card"
          style={{
            background: PURPLE_DEEP,
            border: `1px solid ${GOLD_BORDER}`,
            borderRadius: "12px",
            padding: "1.25rem",
            fontFamily: "JetBrains Mono, monospace",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.75rem" }}>
            🏆 TAI™ MILESTONE LOG — Live from D1 VaultChain
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {milestones.slice(0, 5).map((m) => (
              <div
                key={m.id}
                style={{
                  background: "rgba(255,215,0,0.04)",
                  border: `1px solid ${GOLD_BORDER}`,
                  borderRadius: "6px",
                  padding: "0.6rem 0.85rem",
                }}
              >
                <div style={{ color: WHITE, fontWeight: 600, fontSize: "0.8rem" }}>{m.title}</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                  {m.phase} · {m.accomplished_at ? new Date(m.accomplished_at).toLocaleDateString() : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </> /* end overview tab */}

      {/* ── Compliance Tab ─────────────────────────────────────────────────── */}
      {activeTab === "compliance" && usage && (
        <div
          style={{
            background:   "linear-gradient(135deg, #030010 0%, #080020 100%)",
            border:       `1px solid rgba(74,222,128,0.25)`,
            borderRadius: "12px",
            padding:      "1rem 1.25rem",
            marginBottom: "1.5rem",
            fontFamily:   "JetBrains Mono, monospace",
          }}
        >
          <div style={{ color: "#4ade80", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" }}>
            ⚖️ Compliance Usage — Settlement Activity
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", marginBottom: "1rem" }}>
            Total Revenue: {formatUsd(usage.totalUsd)} · {usage.rows.length} organizations tracked
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(74,222,128,0.2)" }}>
                {["Organization", "Total USD", "Events", "Last Event"].map(h => (
                  <th key={h} style={{ color: "rgba(74,222,128,0.8)", padding: "0.35rem 0.5rem", textAlign: "left", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usage.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ color: "#fff",    padding: "0.3rem 0.5rem" }}>{row.org_id}</td>
                  <td style={{ color: "#ffd700", padding: "0.3rem 0.5rem" }}>{formatUsd(row.total_usd)}</td>
                  <td style={{ color: "#60a5fa", padding: "0.3rem 0.5rem" }}>{row.total_events}</td>
                  <td style={{ color: "rgba(255,255,255,0.55)", padding: "0.3rem 0.5rem" }}>
                    {new Date(row.last_event).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FooterBadge />
    </main>
  );
}
