"use client";

/**
 * app/admin/settlements/page.tsx
 *
 * Admin Settlement Dashboard — AveryOS™ Phase 105 GATE 105.3
 *
 * Creator-locked admin page that consolidates:
 *   • TARI™ settlement calculator (moved behind admin lock from public pages)
 *   • Live KaaS valuation ledger with 72-hour audit countdown
 *   • SHA-512 evidence seals for each settlement row
 *   • Stripe settlement initiation links
 *
 * Auth: VaultGate HttpOnly cookie (`aos-vault-auth`) set by /api/v1/vault/auth.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import { getAuditCountdown } from "../../../lib/kaas/reconciliationClock";
import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";

// ── Theme ──────────────────────────────────────────────────────────────────────
const DARK_BG    = "#000000";
const GOLD       = "#D4AF37";
const GOLD_DIM   = "rgba(212,175,55,0.55)";
const GOLD_BG    = "rgba(212,175,55,0.08)";
const GOLD_BORD  = "rgba(212,175,55,0.3)";
const GREEN      = "#4ade80";
const RED        = "#ff4444";
const ORANGE     = "#f97316";
const WHITE      = "#ffffff";
const MUTED      = "rgba(180,200,255,0.65)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: GOLD_BG, border: `1px solid ${GOLD_BORD}`,
    borderRadius: "10px", padding: "1.4rem 1.8rem", marginBottom: "1.4rem",
    ...extra,
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface KaasRow {
  id:                number;
  ip_address:        string | null;
  asn:               string | null;
  tier:              number | null;
  valuation_usd:     string | number | null;
  fee_name:          string | null;
  settlement_status: string | null;
  pulse_hash:        string | null;
  created_at:        string | null;
}

interface KaasResponse {
  valuations: KaasRow[];
  total:      number;
  timestamp:  string;
}

// TARI™ tier definitions (for the calculator)
const TARI_TIERS = [
  { tier: 10, label: "Microsoft / Azure (ASN 8075)",    fee: 10_000_000 },
  { tier: 9,  label: "Google / GCP (ASN 15169)",        fee: 10_000_000 },
  { tier: 8,  label: "GitHub / AWS (ASN 36459 / 16509)",fee: 10_000_000 },
  { tier: 7,  label: "Enterprise Fortune 500",          fee: 1_017_000 },
  { tier: 1,  label: "Unknown / Individual Agent",      fee: 1_017 },
];

function formatUsd(val: string | number | null): string {
  if (val === null || val === undefined) return "$0.00";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatTs(ts: string | null): string {
  if (!ts) return "—";
  try { return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC"; }
  catch { return ts; }
}

function statusColor(status: string | null): string {
  if (status === "SETTLED" || status === "PAID") return GREEN;
  if (status === "PENDING") return ORANGE;
  return RED;
}

// ── Auth gate UI ──────────────────────────────────────────────────────────────
function AuthGate({
  checking, password, setPassword, authError, onSubmit,
}: {
  checking: boolean;
  password: string;
  setPassword: (v: string) => void;
  authError: string;
  onSubmit: () => void;
}) {
  if (checking) {
    return (
      <main className="page" style={{ background: DARK_BG }}>
        <AnchorBanner />
        <p style={{ color: MUTED, textAlign: "center", marginTop: "4rem", fontFamily: FONT_MONO }}>
          Verifying VaultGate…
        </p>
      </main>
    );
  }
  return (
    <main className="page" style={{ background: DARK_BG }}>
      <AnchorBanner />
      <div style={{ maxWidth: 440, margin: "5rem auto", padding: "2rem", background: GOLD_BG, border: `1px solid ${GOLD_BORD}`, borderRadius: 16, textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔒</div>
        <h2 style={{ color: GOLD, marginBottom: "0.5rem" }}>Admin Settlement Dashboard</h2>
        <p style={{ color: MUTED, fontSize: "0.88rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Creator-locked. VaultGate passphrase required.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
          placeholder="VaultGate token…"
          style={{
            width: "100%", padding: "0.75rem 1rem", borderRadius: "8px",
            border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.4)",
            color: WHITE, fontFamily: FONT_MONO, fontSize: "0.9rem",
            outline: "none", boxSizing: "border-box", marginBottom: "0.75rem",
          }}
        />
        {authError && <p style={{ color: RED, fontSize: "0.85rem", marginBottom: "0.75rem" }}>{authError}</p>}
        <button
          onClick={onSubmit}
          style={{
            width: "100%", padding: "0.8rem", background: GOLD_BG,
            border: `1.5px solid ${GOLD}`, borderRadius: "8px",
            color: GOLD, fontWeight: 700, cursor: "pointer", fontFamily: FONT_MONO,
          }}
        >
          🔑 Authenticate
        </button>
      </div>

    </main>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminSettlementsPage() {
  // ── VaultGate auth — uses dedicated /api/v1/vault/auth-check endpoint ─────
  const { authed, checking, password, setPassword, authError, handleAuth } =
    useVaultAuth();

  const [rows, setRows]         = useState<KaasRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<AosUiError | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");

  const [calcTier, setCalcTier] = useState(TARI_TIERS[0]);
  const [calcCount, setCalcCount] = useState(1);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/v1/kaas/valuations?limit=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const json = await res.json() as KaasResponse;
      setRows(json.valuations ?? []);
      setTotal(json.total ?? 0);
      setLastRefresh(new Date().toISOString());
    } catch (err) {
      setError(buildAosUiError(AOS_ERROR.DB_QUERY_FAILED, err instanceof Error ? err.message : String(err)));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authed) void fetchData(); }, [authed, fetchData]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (checking || !authed) {
    return (
      <AuthGate
        checking={checking}
        password={password}
        setPassword={setPassword}
        authError={authError}
        onSubmit={() => void handleAuth()}
      />
    );
  }

  const calcFee    = calcTier.fee * calcCount;
  const pendingRows = rows.filter((r) => r.settlement_status !== "SETTLED" && r.settlement_status !== "PAID");
  const totalAssessed = rows.reduce((sum, r) => {
    const v = typeof r.valuation_usd === "string" ? parseFloat(r.valuation_usd) : (r.valuation_usd ?? 0);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  return (
    <main className="page" style={{ background: DARK_BG }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ background: "repeating-linear-gradient(135deg,#0d0000 0,#0d0000 10px,#1a0000 10px,#1a0000 20px)", borderBottom: `2px solid ${RED}`, padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <span style={{ fontSize: "1.3rem" }}>⚖️</span>
        <div>
          <p style={{ color: RED, fontSize: "0.7rem", fontFamily: FONT_MONO, margin: 0, letterSpacing: "0.12em" }}>
            🔒 ADMIN — CREATOR-LOCKED
          </p>
          <h1 style={{ color: GOLD, margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
            Settlement Dashboard
          </h1>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <p style={{ color: MUTED, fontSize: "0.72rem", fontFamily: FONT_MONO, margin: 0 }}>
            Kernel {KERNEL_VERSION}
          </p>
          {lastRefresh && (
            <p style={{ color: GOLD_DIM, fontSize: "0.68rem", fontFamily: FONT_MONO, margin: "0.1rem 0 0" }}>
              Refreshed {formatTs(lastRefresh)}
            </p>
          )}
        </div>
      </div>

      {error && <SovereignErrorBanner error={error} />}

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 1.25rem 4rem" }}>

        {/* ── TARI™ Calculator ─────────────────────────────────────────────── */}
        <div style={card()}>
          <p style={{ color: GOLD, fontWeight: 700, margin: "0 0 1rem", fontFamily: FONT_MONO, fontSize: "0.88rem" }}>
            🧮 TARI™ SETTLEMENT CALCULATOR
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ color: MUTED, fontFamily: FONT_MONO, fontSize: "0.8rem", display: "block", marginBottom: "0.4rem" }}>
                Entity Tier
              </label>
              <select
                value={calcTier.tier}
                onChange={(e) => {
                  const t = TARI_TIERS.find((x) => x.tier === parseInt(e.target.value));
                  if (t) setCalcTier(t);
                }}
                style={{
                  width: "100%", padding: "0.65rem", borderRadius: "8px",
                  border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.4)",
                  color: WHITE, fontFamily: FONT_MONO, fontSize: "0.85rem", outline: "none",
                }}
              >
                {TARI_TIERS.map((t) => (
                  <option key={t.tier} value={t.tier}>
                    Tier-{t.tier} — {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: MUTED, fontFamily: FONT_MONO, fontSize: "0.8rem", display: "block", marginBottom: "0.4rem" }}>
                Incident Count
              </label>
              <input
                type="number"
                min={1}
                max={10_000}
                value={calcCount}
                onChange={(e) => setCalcCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: "100%", padding: "0.65rem", borderRadius: "8px",
                  border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.4)",
                  color: WHITE, fontFamily: FONT_MONO, fontSize: "0.85rem",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div
            style={{
              background: "rgba(0,0,0,0.4)", border: `1px solid ${GOLD_BORD}`,
              borderRadius: "10px", padding: "1rem 1.5rem", textAlign: "center",
            }}
          >
            <p style={{ color: MUTED, fontFamily: FONT_MONO, fontSize: "0.78rem", margin: "0 0 0.3rem" }}>TOTAL SETTLEMENT VALUE</p>
            <div style={{ color: GOLD, fontFamily: FONT_MONO, fontWeight: 800, fontSize: "2.2rem" }}>
              {formatUsd(calcFee)}
            </div>
            <p style={{ color: GOLD_DIM, fontFamily: FONT_MONO, fontSize: "0.78rem", margin: "0.3rem 0 0" }}>
              Tier-{calcTier.tier} × {calcCount} incident(s) × {formatUsd(calcTier.fee)}/incident
            </p>
          </div>
        </div>

        {/* ── Aggregate metrics ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total Rows",         value: total,                            color: GOLD },
            { label: "Pending",            value: pendingRows.length,               color: ORANGE },
            { label: "Total Assessed",     value: formatUsd(totalAssessed),         color: RED },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card({ padding: "1rem 1.25rem", marginBottom: 0 }) }}>
              <p style={{ color: MUTED, fontSize: "0.75rem", fontFamily: FONT_MONO, margin: "0 0 0.25rem" }}>{label}</p>
              <p style={{ color, fontWeight: 700, fontFamily: FONT_MONO, fontSize: "1.35rem", margin: 0 }}>
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            </div>
          ))}
        </div>

        {/* ── KaaS ledger ───────────────────────────────────────────────────── */}
        <div style={card()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <p style={{ color: GOLD, fontWeight: 700, fontFamily: FONT_MONO, fontSize: "0.88rem", margin: 0 }}>
              📋 KAAS™ VALUATION LEDGER
            </p>
            <button
              onClick={() => void fetchData()}
              disabled={loading}
              style={{
                padding: "0.45rem 1rem", borderRadius: "6px",
                border: `1px solid ${GOLD_BORD}`, background: GOLD_BG,
                color: GOLD, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: FONT_MONO, fontSize: "0.8rem", opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "⏳ Loading…" : "🔄 Refresh"}
            </button>
          </div>

          {rows.length === 0 && !loading && (
            <p style={{ color: MUTED, fontFamily: FONT_MONO, fontSize: "0.85rem", textAlign: "center", padding: "2rem 0" }}>
              No KaaS valuation rows found.
            </p>
          )}

          {rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT_MONO, fontSize: "0.78rem" }}>
                <thead>
                  <tr>
                    {["ID", "IP / ASN", "Tier", "Valuation", "Fee Name", "Status", "Countdown", "Created", "Pulse Hash"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.5rem 0.75rem", borderBottom: `1px solid ${GOLD_BORD}`,
                          color: GOLD_DIM, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const countdown = row.created_at
                      ? getAuditCountdown(row.created_at, row.tier ?? 1)
                      : null;
                    const countdownColor = countdown?.expired
                      ? RED
                      : countdown?.criticalWarning
                      ? ORANGE
                      : GREEN;

                    return (
                      <tr key={row.id} style={{ borderBottom: `1px solid rgba(212,175,55,0.1)` }}>
                        <td style={{ padding: "0.5rem 0.75rem", color: MUTED }}>{row.id}</td>
                        <td style={{ padding: "0.5rem 0.75rem", color: WHITE }}>
                          <div>{row.ip_address ?? "—"}</div>
                          {row.asn && <div style={{ color: GOLD_DIM, fontSize: "0.7rem" }}>ASN {row.asn}</div>}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", color: GOLD, fontWeight: 700 }}>
                          {row.tier != null ? `Tier-${row.tier}` : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", color: RED, fontWeight: 700 }}>
                          {formatUsd(row.valuation_usd)}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", color: MUTED }}>{row.fee_name ?? "—"}</td>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <span style={{ color: statusColor(row.settlement_status), fontWeight: 600 }}>
                            {row.settlement_status ?? "PENDING"}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", color: countdownColor, fontWeight: countdown?.expired ? 700 : 400 }}>
                          {countdown ? countdown.countdownDisplay : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", color: MUTED, whiteSpace: "nowrap" }}>
                          {formatTs(row.created_at)}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          {row.pulse_hash ? (
                            <code style={{ color: GOLD_DIM, fontSize: "0.68rem" }}>
                              {row.pulse_hash.slice(0, 16)}…
                            </code>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Quick links ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { href: "/admin/monetization", label: "💰 Stripe Revenue Dashboard" },
            { href: "/tari-revenue",       label: "💹 TARI™ Revenue (Public)" },
            { href: "/evidence-vault",     label: "🗄️ Evidence Vault" },
            { href: "/admin",              label: "🛡️ Admin Home" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                padding: "0.55rem 1rem", borderRadius: "8px",
                border: `1px solid ${GOLD_BORD}`, background: GOLD_BG,
                color: GOLD, textDecoration: "none",
                fontFamily: FONT_MONO, fontSize: "0.82rem",
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: "1.5rem", padding: "1rem", background: GOLD_BG, border: `1px solid ${GOLD_BORD}`, borderRadius: "8px", fontFamily: FONT_MONO, fontSize: "0.72rem", color: GOLD_DIM }}>
          ⛓️⚓⛓️ Kernel {KERNEL_VERSION} · {KERNEL_SHA.slice(0, 24)}… · CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
        </div>
      </div>


    </main>
  );
}
