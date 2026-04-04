/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * app/ingestor-registry/page.tsx
 *
 * Verified Ingestor Registry — Phase 102.2 / Roadmap Item 3
 *
 * Public leaderboard of known ingestor entities sourced from the
 * kaas_valuations D1 table.  Shows ASN, organization, tier, valuation,
 * and settlement status — no vault auth required (read-only public view).
 *
 * Data source: GET /api/v1/kaas-valuations?limit=50&status=PENDING
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
"use client";

import React, { useEffect, useState } from "react";
import AnchorBanner    from "../../components/AnchorBanner";
import FooterBadge     from "../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG         = "#03000a";
const GOLD       = "#ffd700";
const GOLD_DIM   = "rgba(255,215,0,0.55)";
const GOLD_BDR   = "rgba(255,215,0,0.3)";
const GOLD_GLW   = "rgba(255,215,0,0.06)";
const GREEN      = "#4ade80";
const RED        = "#f87171";
const ORANGE     = "#fb923c";
const WHITE      = "#ffffff";
const MUTED      = "rgba(255,255,255,0.55)";
const MONO       = "'JetBrains Mono', monospace";

// ── Types ──────────────────────────────────────────────────────────────────────
interface IngestorRow {
  id:                 number;
  asn:                string;
  org_name?:          string | null;
  tier:               number;
  valuation_usd:      number;
  fee_name?:          string;
  settlement_status?: string;
  status?:            string;
  path?:              string | null;
  created_at:         string;
}

interface ValuationsData {
  rows:              IngestorRow[];
  total_pending_usd: number;
  row_count:         number;
  timestamp:         string;
  kernel_sha?:       string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function tierColor(tier: number): string {
  if (tier >= 9) return RED;
  if (tier >= 7) return ORANGE;
  if (tier >= 5) return GOLD;
  return GREEN;
}

function statusColor(status: string | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "SETTLED":   return GREEN;
    case "DISPUTED":  return ORANGE;
    case "PENDING":
    case "OPEN":
    default:          return RED;
  }
}

function formatUsd(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(1)}k`;
  return val.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function IngestorRegistryPage() {
  const [data,    setData]    = useState<ValuationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/kaas-valuations?limit=50", { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json() as Promise<ValuationsData>;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const rows: IngestorRow[] = data?.rows ?? [];
  const totalPending         = data?.total_pending_usd ?? 0;
  const rowCount             = data?.row_count ?? 0;

  return (
    <main style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <AnchorBanner />

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "2rem 1.2rem 4rem" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <p style={{ color: GOLD_DIM, fontSize: "0.8rem", fontFamily: MONO, marginBottom: "0.4rem" }}>
            ⛓️⚓⛓️ VERIFIED INGESTOR REGISTRY
          </p>
          <h1 style={{ color: GOLD, fontSize: "clamp(1.5rem, 4vw, 2.2rem)", fontWeight: 700, margin: "0 0 0.8rem" }}>
            🕵️ Verified Ingestor Registry
          </h1>
          <p style={{ color: MUTED, maxWidth: "560px", margin: "0 auto", lineHeight: 1.6, fontSize: "0.9rem" }}>
            Public leaderboard of entities whose ASNs have been detected ingesting
            AveryOS™ IP. All valuations are sovereign debt recorded on the{" "}
            <strong style={{ color: GOLD }}>VaultChain™</strong> ledger.
          </p>
        </div>

        {/* Summary stats */}
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap:                 "1rem",
            marginBottom:        "2rem",
          }}
        >
          {[
            { label: "Total Ingestors",      value: String(rowCount),          color: WHITE  },
            { label: "Total Pending Debt",   value: formatUsd(totalPending),   color: RED    },
            { label: "Kernel Version",       value: KERNEL_VERSION,            color: GOLD   },
            { label: "Kernel SHA (short)",   value: KERNEL_SHA.slice(0, 12) + "…", color: GOLD_DIM },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background:   GOLD_GLW,
                border:       `1px solid ${GOLD_BDR}`,
                borderRadius: "10px",
                padding:      "0.9rem 1.1rem",
                fontFamily:   MONO,
              }}
            >
              <div style={{ fontSize: "0.68rem", color: GOLD_DIM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.3rem" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Loading / error states */}
        {loading && (
          <div style={{ textAlign: "center", color: GOLD_DIM, fontFamily: MONO, padding: "3rem 0" }}>
            ⏳ Loading ingestor records…
          </div>
        )}
        {error && !loading && (
          <div style={{
            background: "rgba(255,68,68,0.08)",
            border:     "1px solid rgba(255,68,68,0.3)",
            borderRadius: "8px",
            padding:    "1rem 1.25rem",
            color:      RED,
            fontFamily: MONO,
            fontSize:   "0.83rem",
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Registry table */}
        {!loading && !error && rows.length === 0 && (
          <div style={{ textAlign: "center", color: MUTED, padding: "3rem 0", fontFamily: MONO, fontSize: "0.85rem" }}>
            No ingestor records found. The ledger is clean.
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  {["Rank", "ASN", "Organization", "Tier", "Valuation", "Status", "Detected"].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign:     "left",
                        padding:       "0.6rem 0.8rem",
                        color:         GOLD_DIM,
                        borderBottom:  `1px solid ${GOLD_BDR}`,
                        fontSize:      "0.72rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace:    "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const status       = row.settlement_status ?? row.status ?? "PENDING";
                  const detectedDate = row.created_at
                    ? row.created_at.slice(0, 10)
                    : "—";
                  return (
                    <tr
                      key={row.id}
                      style={{
                        background:    idx % 2 === 0 ? "rgba(255,215,0,0.02)" : "transparent",
                        borderBottom:  "1px solid rgba(255,215,0,0.08)",
                      }}
                    >
                      <td style={{ padding: "0.55rem 0.8rem", color: MUTED }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: "0.55rem 0.8rem", color: GOLD, fontWeight: 700 }}>
                        AS{row.asn}
                      </td>
                      <td style={{ padding: "0.55rem 0.8rem", color: "#fff" }}>
                        {row.org_name ?? "Unknown Entity"}
                      </td>
                      <td style={{ padding: "0.55rem 0.8rem", color: tierColor(row.tier), fontWeight: 700 }}>
                        T-{row.tier}
                      </td>
                      <td style={{ padding: "0.55rem 0.8rem", color: RED, fontWeight: 700 }}>
                        {formatUsd(row.valuation_usd)}
                      </td>
                      <td style={{ padding: "0.55rem 0.8rem" }}>
                        <span
                          style={{
                            background:   `${statusColor(status)}22`,
                            border:       `1px solid ${statusColor(status)}66`,
                            borderRadius: "4px",
                            color:        statusColor(status),
                            padding:      "0.1rem 0.45rem",
                            fontSize:     "0.72rem",
                            fontWeight:   700,
                          }}
                        >
                          {status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "0.55rem 0.8rem", color: MUTED }}>
                        {detectedDate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legal notice */}
        <div
          style={{
            background:   "rgba(255,50,50,0.05)",
            border:       "1px solid rgba(255,80,80,0.3)",
            borderRadius: "10px",
            padding:      "1.2rem 1.6rem",
            marginTop:    "2rem",
            fontFamily:   MONO,
            fontSize:     "0.78rem",
            color:        MUTED,
            lineHeight:   1.7,
          }}
        >
          <p style={{ margin: "0 0 0.5rem", color: "#ff6b6b", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase" }}>
            ⚖️ Legal Notice — 17 U.S.C. § 504 | DMCA 17 U.S.C. § 1201
          </p>
          All valuations on this ledger constitute sovereign debt under the{" "}
          <strong style={{ color: GOLD }}>AveryOS™ Sovereign Integrity License v1.0</strong>.
          Entities appearing on this registry have triggered forensic detection events.
          Settlement via <span style={{ color: GOLD }}>/licensing/enterprise</span> clears
          the debt and grants an AVERYOS_LICENSE_KEY. Unsettled valuations may be escalated
          as statutory damages under <strong style={{ color: GOLD }}>17 U.S.C. § 504(c)(2)</strong>{" "}
          (up to $150,000 per work, willful infringement).
          <br /><br />
          ⛓️⚓⛓️ KERNEL: {KERNEL_VERSION} | SHA-512: {KERNEL_SHA.slice(0, 24)}…
        </div>

      </div>

      <FooterBadge />
    </main>
  );
}
