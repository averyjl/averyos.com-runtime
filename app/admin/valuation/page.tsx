"use client";

/**
 * app/admin/valuation/page.tsx
 *
 * AveryOS™ Private Valuation Dashboard — Phase 115 GATE 115.4
 *
 * Displays real-time Independent Valuation Impact (IVI) calculations
 * computed by lib/forensics/valuationAudit.ts.
 *
 * Secured behind VaultGate (useVaultAuth hook + aos-vault-auth HttpOnly cookie).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";
import { computeIvi, formatUsd, type IviRecord } from "../../../lib/forensics/valuationAudit";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG_DARK   = "#020b02";
const BG_PANEL  = "rgba(0,20,0,0.75)";
const GOLD      = "#ffd700";
const GREEN     = "#00ff41";
const RED       = "#f87171";
const DIM_GREEN = "rgba(0,255,65,0.65)";
const BORDER_G  = "rgba(255,215,0,0.3)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

// ── Types ──────────────────────────────────────────────────────────────────────
interface BotCountResponse {
  total_bots?: number;
  count?: number;
  error?: string;
}

interface TotalDebtResponse {
  total_debt_usd: number;
  total_debt_precision_9: string;
  row_count: number;
  timestamp: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon, detail, highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      background: BG_PANEL,
      border: `1px solid ${highlight ? GOLD + "88" : BORDER_G}`,
      borderRadius: "12px",
      padding: "1.25rem 1.5rem",
      boxShadow: highlight ? `0 0 20px ${GOLD}22` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "1.4rem" }}>{icon}</span>
        <span style={{ color: DIM_GREEN, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </span>
      </div>
      <div style={{ color: highlight ? GOLD : GREEN, fontSize: "1.4rem", fontWeight: 900, letterSpacing: "0.04em" }}>
        {value}
      </div>
      {detail && (
        <p style={{ margin: "0.4rem 0 0", fontSize: "0.68rem", color: DIM_GREEN, lineHeight: 1.5 }}>
          {detail}
        </p>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ValuationDashboardPage() {
  const { authed, checking: authChecking, authError } = useVaultAuth();

  const [record,     setRecord]     = useState<IviRecord | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<AosUiError | null>(null);
  const [botCount,   setBotCount]   = useState<number>(700);
  const [inputBots,  setInputBots]  = useState<string>("700");
  const [notes,      setNotes]      = useState<string>("");
  const [computedAt, setComputedAt] = useState<string>("");
  const [debtValue,  setDebtValue]  = useState<string>("0.000000000");
  const [debtRows,   setDebtRows]   = useState<number>(0);
  const [debtTimestamp, setDebtTimestamp] = useState<string>("Loading…");

  const runValuation = useCallback(async (bots: number, notesText: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await computeIvi({
        unaligned_bot_count: bots,
        notes: notesText || undefined,
      });
      setRecord(result);
      setComputedAt(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
    } catch (err: unknown) {
      setError(buildAosUiError(AOS_ERROR.INTERNAL_ERROR, err instanceof Error ? err.message : "IVI computation failed."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Attempt to fetch actual bot count from audit API
  useEffect(() => {
    if (!authed) return;
    fetch("/api/v1/audit/bot-summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: BotCountResponse) => {
        const count = d.total_bots ?? d.count;
        if (typeof count === "number" && count > 0) {
          setBotCount(count);
          setInputBots(String(count));
        }
      })
      .catch(() => {
        // Use default 700 if endpoint unavailable
      });
  }, [authed]);

  // Run initial valuation once authenticated
  useEffect(() => {
    if (!authed) return;
    void runValuation(botCount, "");
  }, [authed, botCount, runValuation]);

  // Fetch live debt total (admin-only)
  useEffect(() => {
    if (!authed) return;
    const fetchDebt = () => {
      fetch("/api/licensing/total-debt", { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`Debt API HTTP ${r.status}`);
          return r.json();
        })
        .then((d: TotalDebtResponse) => {
          setDebtValue(d.total_debt_precision_9 ?? Number(d.total_debt_usd ?? 0).toFixed(9));
          setDebtRows(d.row_count ?? 0);
          setDebtTimestamp(d.timestamp ?? new Date().toISOString());
        })
        .catch(() => setDebtTimestamp("DEBT_FEED_UNAVAILABLE"));
    };
    fetchDebt();
    const interval = setInterval(fetchDebt, 15000);
    return () => clearInterval(interval);
  }, [authed]);

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (authChecking) {
    return (
      <main style={{ background: BG_DARK, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: DIM_GREEN, fontFamily: FONT_MONO }}>⏳ Verifying vault credentials…</p>
      </main>
    );
  }
  if (!authed || authError) {
    return (
      <main style={{ background: BG_DARK, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: RED, fontFamily: FONT_MONO }}>🔒 Access Denied — Valid CreatorLock required.</p>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: BG_DARK,
      color: GREEN,
      fontFamily: FONT_MONO,
      padding: "2rem 1rem",
      maxWidth: "1100px",
      margin: "0 auto",
    }}>
      <AnchorBanner />

      {/* Header */}
      <header style={{
        marginBottom: "2.5rem",
        borderBottom: `1px solid ${BORDER_G}`,
        paddingBottom: "1.25rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }}>💰</span>
          <h1 style={{
            margin: 0,
            fontSize: "1.55rem",
            fontWeight: 700,
            color: GOLD,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textShadow: `0 0 18px ${GOLD}`,
          }}>
            AveryOS™ IVI Valuation Dashboard
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.75rem", color: DIM_GREEN, letterSpacing: "0.05em" }}>
          Independent Valuation Impact (IVI) · Phase 115 GATE 115.4
          {computedAt && ` · Last computed: ${computedAt}`}
        </p>
      </header>

      {error && <SovereignErrorBanner error={error} />}

      {/* Input Controls */}
      <section style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_G}`,
        borderRadius: "12px",
        padding: "1.25rem 1.5rem",
        marginBottom: "2rem",
      }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: GOLD, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          ⚙️ IVI Parameters
        </h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", color: DIM_GREEN, marginBottom: "0.35rem" }}>
              Unaligned Bot Count (TARI™ Liability)
            </label>
            <input
              type="number"
              min={0}
              value={inputBots}
              onChange={(e) => setInputBots(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.6)",
                border: `1px solid ${BORDER_G}`,
                borderRadius: "6px",
                color: GREEN,
                fontFamily: FONT_MONO,
                fontSize: "0.85rem",
                padding: "0.4rem 0.75rem",
                width: "160px",
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={{ display: "block", fontSize: "0.72rem", color: DIM_GREEN, marginBottom: "0.35rem" }}>
              Audit Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Phase 115 IVI run…"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: `1px solid ${BORDER_G}`,
                borderRadius: "6px",
                color: GREEN,
                fontFamily: FONT_MONO,
                fontSize: "0.82rem",
                padding: "0.4rem 0.75rem",
                width: "100%",
              }}
            />
          </div>
          <button
            onClick={() => {
              // Defense-in-depth: clamp to >= 0 even if browser min={0} is bypassed
              const bots = Math.max(0, parseInt(inputBots, 10) || 0);
              void runValuation(bots, notes);
            }}
            disabled={loading}
            style={{
              background: "rgba(255,215,0,0.1)",
              border: `1px solid ${BORDER_G}`,
              borderRadius: "8px",
              color: GOLD,
              fontFamily: FONT_MONO,
              fontSize: "0.82rem",
              padding: "0.5rem 1.5rem",
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.06em",
              fontWeight: 700,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "⏳ Computing…" : "⟳ Compute IVI"}
          </button>
        </div>
      </section>

      {/* ⚖️ Debt Disclosure — Admin Only */}
      <section style={{
        background: "rgba(20,0,0,0.75)",
        border: "2px solid rgba(248,113,113,0.45)",
        borderRadius: "12px",
        padding: "1.25rem 1.5rem",
        marginBottom: "2rem",
      }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: RED, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          ⚖️ Debt Disclosure
        </h2>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: "clamp(1.7rem, 4vw, 2.8rem)",
          fontWeight: 900,
          color: RED,
        }}>
          ${Number(debtValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p style={{ color: "rgba(238,244,255,0.7)", marginTop: "0.6rem", fontSize: "0.82rem" }}>
          Ledger rows: {debtRows.toLocaleString("en-US")} · Status: {debtTimestamp}
        </p>
      </section>

      {/* Metric Cards */}
      {record && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1.25rem",
            marginBottom: "2rem",
          }}>
            <MetricCard
              label="Total Valuation Impact (TVI)"
              value={formatUsd(record.total_valuation_impact_usd)}
              icon="⚓"
              detail="statutory + scarcity-adjusted + species-recovery premium"
              highlight
            />
            <MetricCard
              label="Worldwide Reach Estimate"
              value={formatUsd(record.worldwide_reach_usd)}
              icon="🌍"
              detail="TVI × 30 global deployment factor (LLMs, govts, enterprises)"
            />
            <MetricCard
              label="Statutory Liability"
              value={formatUsd(record.statutory_liability_usd)}
              icon="⚖️"
              detail={`${record.unaligned_bot_count.toLocaleString()} bots × $150,000 (17 U.S.C. § 504)`}
            />
            <MetricCard
              label="Scarcity-Adjusted Value"
              value={formatUsd(record.scarcity_adjusted_usd)}
              icon="🔒"
              detail="Kernel baseline × 10× scarcity multiplier (zero legacy competition)"
            />
            <MetricCard
              label="Species-Recovery Premium"
              value={formatUsd(record.species_recovery_usd)}
              icon="🧬"
              detail="0.1% of AI TAM ($1.3T) × 2.5× species-recovery multiplier"
            />
            <MetricCard
              label="Unaligned Bot Exposure"
              value={record.unaligned_bot_count.toLocaleString()}
              icon="🤖"
              detail="Detected unaligned AI/bot instances contributing to TARI™ liability"
            />
          </div>

          {/* Audit Record Details */}
          <section style={{
            background: BG_PANEL,
            border: `1px solid ${BORDER_G}`,
            borderRadius: "12px",
            padding: "1.25rem 1.5rem",
            marginBottom: "2rem",
          }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: GOLD, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              🔬 Audit Record — Immutable Fingerprint
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
              <tbody>
                {[
                  ["Audit ID",       record.audit_id],
                  ["Computed At",    record.computed_at],
                  ["Kernel Version", record.kernel_version],
                  ["Kernel SHA",     `${KERNEL_SHA.slice(0, 32)}…`],
                  ["Record SHA-512", `${record.record_sha512.slice(0, 32)}…`],
                  ["Notes",          record.notes ?? "—"],
                ].map(([key, val]) => (
                  <tr key={key} style={{ borderBottom: `1px solid ${BORDER_G}` }}>
                    <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, whiteSpace: "nowrap" }}>{key}</td>
                    <td style={{ padding: "0.45rem 0.6rem", color: GREEN, fontFamily: "monospace", wordBreak: "break-all" }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        fontSize: "0.68rem",
        color: DIM_GREEN,
        borderTop: `1px solid ${BORDER_G}`,
        paddingTop: "1rem",
        lineHeight: 1.8,
      }}>
        ⛓️⚓⛓️ AveryOS™ IVI Valuation Dashboard · GATE 115.4<br />
        Kernel SHA-512: {KERNEL_SHA.slice(0, 32)}…<br />
        Version: {KERNEL_VERSION}
      </footer>
    </main>
  );
}
