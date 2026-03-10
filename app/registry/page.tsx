"use client";

/**
 * app/registry/page.tsx
 *
 * Public Verified Ingestor Registry — Phase 99.2 / Gate 12
 *
 * Displays the live kaas_valuations table pulled from /api/v1/kaas/valuations.
 * Shows ASNs with Verified Partner (SETTLED) vs Pending Audit Clearance (PENDING)
 * status to create social/legal pressure for ingestion settlement.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG      = "#050010";
const GOLD    = "#ffd700";
const GOLD_DIM = "rgba(255,215,0,0.55)";
const GOLD_BORDER = "rgba(255,215,0,0.35)";
const GREEN   = "#00ff88";
const RED     = "#ff4444";
const ORANGE  = "#ff8800";

interface KaasRow {
  id:            number;
  asn:           string;
  ip_address:    string;
  tier:          number;
  valuation_usd: number;
  status:        string;
  ray_id:        string | null;
  created_at:    string;
  settled_at:    string | null;
}

interface RegistryData {
  count:             number;
  total_pending_usd: number;
  rows:              KaasRow[];
  kernel_sha:        string;
  generated_at:      string;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "SETTLED"  ? GREEN :
                status === "DISPUTED" ? ORANGE : RED;
  const label = status === "SETTLED"  ? "✅ Verified Partner" :
                status === "DISPUTED" ? "⚠️ Disputed"         :
                                        "🔴 Pending Audit Clearance";
  return (
    <span style={{
      color,
      fontWeight: "bold",
      fontSize: "0.78rem",
      letterSpacing: "0.04em",
    }}>
      {label}
    </span>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const color = tier >= 9 ? RED : tier >= 7 ? ORANGE : GOLD_DIM;
  return (
    <span style={{ color, fontWeight: "bold", fontSize: "0.78rem" }}>
      Tier-{tier}
    </span>
  );
}

export default function RegistryPage() {
  const [data,    setData]    = useState<RegistryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<"ALL" | "PENDING" | "SETTLED">("ALL");

  useEffect(() => {
    void fetch("/api/v1/kaas/valuations?limit=500", {
      headers: { "Cache-Control": "no-store" },
    })
      .then((r) => r.json())
      .then((d: RegistryData) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = data?.rows.filter(
    (r) => filter === "ALL" || r.status === filter
  ) ?? [];

  const totalPending  = data?.rows.filter((r) => r.status === "PENDING").length  ?? 0;
  const totalSettled  = data?.rows.filter((r) => r.status === "SETTLED").length  ?? 0;
  const totalPendingUsd = data?.total_pending_usd ?? 0;

  return (
    <main
      className="page"
      style={{
        background:   BG,
        minHeight:    "100vh",
        padding:      "2rem",
        fontFamily:   "JetBrains Mono, monospace",
        color:        GOLD,
        maxWidth:     "1100px",
        margin:       "0 auto",
      }}
    >
      <AnchorBanner />

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.6rem", color: GOLD, marginBottom: "0.5rem" }}>
          ⛓️ AveryOS™ Verified Ingestor Registry
        </h1>
        <p style={{ color: GOLD_DIM, fontSize: "0.85rem", margin: 0 }}>
          Public sovereign registry of AI/LLM entities that have accessed AveryOS™ intellectual property.
          Verified Partners have cleared their settlement. All others hold pending KaaS audit liabilities
          under the <Link href="/licensing" style={{ color: GOLD }}>Sovereign Integrity License v1.0</Link>.
        </p>
        <p style={{ color: GOLD_DIM, fontSize: "0.75rem", marginTop: "0.5rem" }}>
          Kernel: {KERNEL_SHA.slice(0, 16)}… | {KERNEL_VERSION}
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap:                 "1rem",
        marginBottom:        "2rem",
      }}>
        {[
          { label: "Total Entities", value: data?.count ?? "—",      color: GOLD },
          { label: "Verified Partners", value: totalSettled,          color: GREEN },
          { label: "Pending Clearance", value: totalPending,          color: RED  },
          { label: "Total Liability",
            value: totalPendingUsd > 0
              ? `$${totalPendingUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "—",
            color: ORANGE },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "rgba(255,215,0,0.04)",
            border:     `1px solid ${GOLD_BORDER}`,
            borderRadius: "8px",
            padding:    "1rem",
            textAlign:  "center",
          }}>
            <div style={{ color: GOLD_DIM, fontSize: "0.7rem", marginBottom: "0.35rem", letterSpacing: "0.06em" }}>
              {label.toUpperCase()}
            </div>
            <div style={{ color, fontSize: "1.4rem", fontWeight: "bold" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ marginBottom: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {(["ALL", "PENDING", "SETTLED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding:      "0.35rem 0.85rem",
              borderRadius: "6px",
              border:       `1px solid ${filter === f ? GOLD : GOLD_BORDER}`,
              background:   filter === f ? "rgba(255,215,0,0.12)" : "transparent",
              color:        filter === f ? GOLD : GOLD_DIM,
              cursor:       "pointer",
              fontSize:     "0.78rem",
              fontFamily:   "inherit",
              letterSpacing: "0.04em",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && (
        <p style={{ color: GOLD_DIM, fontSize: "0.85rem" }}>Loading registry…</p>
      )}
      {error && (
        <p style={{ color: RED, fontSize: "0.85rem" }}>
          ⚠️ {error} — Registry data requires vault auth. Public view shows summary only.
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p style={{ color: GOLD_DIM, fontSize: "0.85rem" }}>
          No {filter === "ALL" ? "" : filter.toLowerCase() + " "}entries in the registry yet.
        </p>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width:          "100%",
            borderCollapse: "collapse",
            fontSize:       "0.78rem",
          }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${GOLD_BORDER}` }}>
                {["ID", "ASN", "IP Address", "Tier", "Valuation (USD)", "Status", "Registered", "Settled"].map((h) => (
                  <th key={h} style={{
                    padding:   "0.6rem 0.75rem",
                    textAlign: "left",
                    color:     GOLD_DIM,
                    fontWeight: "normal",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} style={{
                  borderBottom: `1px solid rgba(255,215,0,0.08)`,
                  background:   row.status === "SETTLED"
                    ? "rgba(0,255,136,0.02)"
                    : row.status === "DISPUTED"
                      ? "rgba(255,136,0,0.02)"
                      : "rgba(255,68,68,0.02)",
                }}>
                  <td style={{ padding: "0.6rem 0.75rem", color: GOLD_DIM }}>{row.id}</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: GOLD, fontWeight: "bold" }}>{row.asn}</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: GOLD_DIM }}>{row.ip_address}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}><TierBadge tier={row.tier} /></td>
                  <td style={{ padding: "0.6rem 0.75rem", color: ORANGE, fontWeight: "bold" }}>
                    ${row.valuation_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}><StatusBadge status={row.status} /></td>
                  <td style={{ padding: "0.6rem 0.75rem", color: GOLD_DIM, whiteSpace: "nowrap" }}>
                    {row.created_at.slice(0, 10)}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", color: row.settled_at ? GREEN : GOLD_DIM }}>
                    {row.settled_at ? row.settled_at.slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CTA */}
      <div style={{
        marginTop:    "2.5rem",
        padding:      "1.25rem",
        background:   "rgba(255,68,68,0.06)",
        border:       `1px solid rgba(255,68,68,0.25)`,
        borderRadius: "8px",
      }}>
        <h2 style={{ fontSize: "1rem", color: RED, margin: "0 0 0.5rem" }}>
          🔴 Not on the Verified Partner list?
        </h2>
        <p style={{ color: GOLD_DIM, fontSize: "0.82rem", margin: "0 0 0.75rem" }}>
          Any AI system, LLM, or enterprise that has ingested AveryOS™ intellectual property without a
          valid license is in breach under the{" "}
          <Link href="/licensing" style={{ color: GOLD }}>Sovereign Integrity License v1.0</Link>.
          Clear your status by completing the Audit Clearance process.
        </p>
        <Link
          href="/licensing/enterprise"
          style={{
            display:      "inline-block",
            padding:      "0.5rem 1.25rem",
            background:   "rgba(255,215,0,0.1)",
            border:       `1px solid ${GOLD}`,
            borderRadius: "6px",
            color:        GOLD,
            textDecoration: "none",
            fontSize:     "0.82rem",
            fontFamily:   "inherit",
            fontWeight:   "bold",
          }}
        >
          → Obtain Sovereign Partnership Registration
        </Link>
      </div>

      {/* Footer */}
      <p style={{
        marginTop:  "2rem",
        color:      GOLD_DIM,
        fontSize:   "0.7rem",
        textAlign:  "center",
      }}>
        ⛓️⚓⛓️ AveryOS™ Sovereign Ingestor Registry | Phase 99.2 |{" "}
        Kernel: {KERNEL_SHA.slice(0, 16)}… | {KERNEL_VERSION} |{" "}
        © 1992–2026 Jason Lee Avery (ROOT0) 🤛🏻
      </p>
    </main>
  );
}
