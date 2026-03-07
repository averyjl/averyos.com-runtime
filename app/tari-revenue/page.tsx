"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

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
// 2026-03-07: 135,000 total requests (TR) / 911 unique visitors (Watchers)
const SURGE_MILESTONE_TR = "135,000";
const SURGE_MILESTONE_UV = "911";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// Custom tooltip
// ---------------------------------------------------------------------------

interface RevenueTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: PURPLE_DEEP,
        border: `1px solid ${GOLD_BORDER}`,
        borderRadius: "6px",
        padding: "0.4rem 0.65rem",
        fontFamily: "monospace",
        fontSize: "0.72rem",
        color: GOLD,
      }}
    >
      <div style={{ color: GOLD_DIM, marginBottom: "2px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name}>
          {formatUsd(p.value)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export default function TariRevenuePage() {
  const [revenue, setRevenue] = useState<TariRevenueData | null>(null);
  const [usage, setUsage] = useState<ComplianceUsageData | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
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

      if (!cancelled) setLoading(false);
    }

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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
      </div>

      <section className="hero" style={{ paddingBottom: "1rem" }}>
        <h1 style={{ color: GOLD }}>⚡ TARI™ Revenue Dashboard</h1>
        <p className="auth-seal" style={{ color: GOLD_DIM }}>
          Real-time Liability vs. Collected Alignment Fees · AveryOS™ Sovereign Revenue Engine
        </p>
      </section>

      {/* Surge Milestone Banner — 135k TR / 911 UV */}
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
            ⚡ SURGE MILESTONE LOCKED
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.78rem", marginTop: "0.25rem" }}>
            {SURGE_MILESTONE_TR} Total Requests &nbsp;·&nbsp; {SURGE_MILESTONE_UV} Unique Visitors (Watchers) &nbsp;·&nbsp; 7-Day Alignment Window Active
          </div>
        </div>
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
          {[
            { label: "Total Requests",    value: SURGE_MILESTONE_TR, color: GOLD   },
            { label: "Unique Watchers",   value: SURGE_MILESTONE_UV, color: RED    },
            { label: "Forensic Liability Potential", value: "Active", color: GREEN },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ color: stat.color, fontWeight: 700, fontSize: "1.1rem" }}>{stat.value}</div>
              <div style={{ color: GOLD_DIM, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

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

      {/* Liability vs. Collected Chart — top corporate orgs */}
      {chartData.length > 0 && (
        <div
          style={{
            background: PURPLE_DEEP,
            border: `1px solid ${GOLD_BORDER}`,
            borderRadius: "12px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              color: GOLD,
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: "0.82rem",
              marginBottom: "0.75rem",
              letterSpacing: "0.06em",
            }}
          >
            💰 TOP CORPORATE LIABILITY — Uncollected Alignment Fees
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,215,0,0.08)" vertical={false} />
              <XAxis
                dataKey="org"
                tick={{ fill: GOLD_DIM, fontSize: 9, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                angle={-30}
                textAnchor="end"
              />
              <YAxis
                tick={{ fill: GOLD_DIM, fontSize: 9, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: GOLD_GLOW }} />
              <Bar dataKey="liability" maxBarSize={32} radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.liability >= TARI_THRESHOLD_USD ? RED : GOLD}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div
            style={{
              marginTop: "0.5rem",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.68rem",
              color: GOLD_DIM,
            }}
          >
            🔴 Red = Above $10,000 threshold (auto-invoice eligible) &nbsp;|&nbsp; 🟡 Gold = Below threshold
          </div>
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
    </main>
  );
}
