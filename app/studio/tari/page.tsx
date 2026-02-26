"use client";

import { useEffect, useState } from "react";

interface TariLedgerRow {
  id: number;
  timestamp: string;
  anchor_sha: string | null;
  entity_name: string | null;
  impact_multiplier: number;
  revenue_projection: number;
  status: string;
  created_at: string;
}

interface TariStats {
  trust_premium_index_pct: number | null;
  recent_entries: TariLedgerRow[];
  total_entries: number;
  latest_revenue_projection: number | null;
  timestamp: string;
}

const GREEN = "#4ade80";
const DIM_GREEN = "rgba(74,222,128,0.65)";
const BORDER_GREEN = "rgba(74,222,128,0.3)";
const BG_DARK = "#0a0f0a";
const BG_PANEL = "rgba(0,20,0,0.7)";
const BG_TABLE_HEAD = "rgba(0,40,0,0.8)";
const BG_TABLE_ROW_ALT = "rgba(0,255,80,0.02)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

export default function TariDashboard() {
  const [stats, setStats] = useState<TariStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/tari-stats")
      .then((r) => r.json())
      .then((data: TariStats) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const formatPct = (pct: number | null): string => {
    if (pct === null) return "N/A";
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
  };

  const formatUsd = (val: number | null): string => {
    if (val === null) return "—";
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTs = (ts: string): string => {
    try {
      return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC";
    } catch {
      return ts;
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG_DARK,
        color: GREEN,
        fontFamily: FONT_MONO,
        padding: "2rem 1.5rem",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      {/* ── Header ── */}
      <header style={{ marginBottom: "2.5rem", borderBottom: `1px solid ${BORDER_GREEN}`, paddingBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }} role="img" aria-label="Sovereign Creator fist bump">🤛🏻</span>
          <h1
            style={{
              margin: 0,
              fontSize: "1.6rem",
              fontWeight: 700,
              color: GREEN,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textShadow: `0 0 18px ${GREEN}`,
            }}
          >
            TARI Live Revenue Dashboard
          </h1>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "0.78rem",
            color: DIM_GREEN,
            letterSpacing: "0.05em",
          }}
        >
          Truth Anchored Revenue Initiative™ · AveryOS™ Sovereign Kernel · D1 Anchored
        </p>
      </header>

      {/* ── Loading / Error states ── */}
      {loading && (
        <p style={{ color: DIM_GREEN, fontSize: "0.9rem" }}>
          ⏳ Fetching live TARI data…
        </p>
      )}
      {error && (
        <div
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.4)",
            borderRadius: "8px",
            padding: "1rem 1.25rem",
            color: "#f87171",
            fontSize: "0.85rem",
          }}
        >
          ⚠️ TARI_STATS_ERROR: {error}
        </div>
      )}

      {stats && (
        <>
          {/* ── Trust Premium Index Counter ── */}
          <section
            style={{
              background: BG_PANEL,
              border: `1px solid ${BORDER_GREEN}`,
              borderRadius: "14px",
              padding: "2rem 2.5rem",
              marginBottom: "2rem",
              boxShadow: `0 0 32px rgba(74,222,128,0.08)`,
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: DIM_GREEN,
                marginBottom: "0.6rem",
              }}
            >
              ⚡ Trust Premium Index
            </div>
            <div
              style={{
                fontSize: "4rem",
                fontWeight: 700,
                color: stats.trust_premium_index_pct !== null && stats.trust_premium_index_pct >= 0
                  ? GREEN
                  : "#f87171",
                textShadow: `0 0 28px ${stats.trust_premium_index_pct !== null && stats.trust_premium_index_pct >= 0
                  ? GREEN
                  : "#f87171"}`,
                lineHeight: 1,
                marginBottom: "0.5rem",
                letterSpacing: "-0.02em",
              }}
            >
              {formatPct(stats.trust_premium_index_pct)}
            </div>
            <div style={{ fontSize: "0.8rem", color: DIM_GREEN }}>
              {stats.trust_premium_index_pct !== null
                ? "Revenue projection gain vs. earliest anchor"
                : "Insufficient anchor data — add entries to tari_ledger to compute gain"}
            </div>
            <div
              style={{
                display: "flex",
                gap: "2rem",
                marginTop: "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: "0.65rem", color: DIM_GREEN, textTransform: "uppercase", letterSpacing: "0.08em" }}>Latest Revenue Projection</div>
                <div style={{ fontSize: "1.3rem", color: GREEN, fontWeight: 700 }}>
                  {formatUsd(stats.latest_revenue_projection)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.65rem", color: DIM_GREEN, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ledger Entries (live)</div>
                <div style={{ fontSize: "1.3rem", color: GREEN, fontWeight: 700 }}>
                  {stats.total_entries}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.65rem", color: DIM_GREEN, textTransform: "uppercase", letterSpacing: "0.08em" }}>Last Refreshed</div>
                <div style={{ fontSize: "0.85rem", color: DIM_GREEN }}>
                  {formatTs(stats.timestamp)}
                </div>
              </div>
            </div>
          </section>

          {/* ── Recent Ledger Entries Table ── */}
          <section
            style={{
              background: BG_PANEL,
              border: `1px solid ${BORDER_GREEN}`,
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "1rem 1.5rem",
                borderBottom: `1px solid ${BORDER_GREEN}`,
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: DIM_GREEN,
              }}
            >
              ⛓️ Recent tari_ledger Entries (D1-Anchored)
            </div>

            {stats.recent_entries.length === 0 ? (
              <div
                style={{
                  padding: "2rem 1.5rem",
                  color: DIM_GREEN,
                  fontSize: "0.85rem",
                }}
              >
                No entries yet — tari_ledger is empty. Sovereign anchors will appear here once added.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.8rem",
                  }}
                >
                  <thead>
                    <tr style={{ background: BG_TABLE_HEAD }}>
                      {["ID", "Timestamp", "Entity", "Impact Multiplier", "Revenue Projection", "Status", "Anchor SHA"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              padding: "0.6rem 0.85rem",
                              textAlign: "left",
                              color: GREEN,
                              fontWeight: 700,
                              fontSize: "0.68rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              borderBottom: `1px solid ${BORDER_GREEN}`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_entries.map((row, idx) => {
                      const isAnchored = row.status === "ANCHORED";
                      return (
                        <tr
                          key={row.id}
                          style={{
                            background: idx % 2 === 0 ? BG_TABLE_ROW_ALT : "transparent",
                            borderBottom: `1px solid rgba(74,222,128,0.08)`,
                          }}
                        >
                          <td style={{ padding: "0.55rem 0.85rem", color: DIM_GREEN }}>{row.id}</td>
                          <td style={{ padding: "0.55rem 0.85rem", color: DIM_GREEN, whiteSpace: "nowrap" }}>
                            {formatTs(row.timestamp)}
                          </td>
                          <td style={{ padding: "0.55rem 0.85rem", color: row.entity_name ? GREEN : DIM_GREEN }}>
                            {row.entity_name ?? "—"}
                          </td>
                          <td style={{ padding: "0.55rem 0.85rem", color: GREEN, fontWeight: 700 }}>
                            ×{row.impact_multiplier.toFixed(2)}
                          </td>
                          <td style={{ padding: "0.55rem 0.85rem", color: GREEN, fontWeight: 700 }}>
                            {formatUsd(row.revenue_projection)}
                          </td>
                          <td style={{ padding: "0.55rem 0.85rem" }}>
                            <span
                              style={{
                                color: isAnchored ? GREEN : "#fbbf24",
                                textShadow: isAnchored ? `0 0 8px ${GREEN}` : "none",
                                fontWeight: 700,
                                fontSize: "0.72rem",
                                letterSpacing: "0.05em",
                              }}
                            >
                              {isAnchored ? "✅ ANCHORED" : row.status}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "0.55rem 0.85rem",
                              color: "rgba(74,222,128,0.45)",
                              fontSize: "0.68rem",
                              maxWidth: "120px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.anchor_sha ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Footer ── */}
      <footer
        style={{
          marginTop: "3rem",
          paddingTop: "1rem",
          borderTop: `1px solid ${BORDER_GREEN}`,
          textAlign: "center",
          fontSize: "0.72rem",
          color: DIM_GREEN,
          letterSpacing: "0.06em",
        }}
      >
        ⛓️⚓⛓️ TARI™ · Truth Anchored Revenue Initiative · AveryOS™ Kernel Active · 🤛🏻 Jason Lee Avery
      </footer>
    </main>
  );
}
