"use client";

/**
 * app/admin/monetization/page.tsx
 *
 * Stripe Revenue Dashboard — AveryOS™ Phase 105.1 GATE 105.1.2
 *
 * Creator-locked admin page showing live Stripe revenue data:
 *   • Genesis Dollar Anchor (first ever payment)
 *   • Total collected vs. total KaaS-assessed liability
 *   • Recent completed checkout sessions
 *   • Outstanding balance
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
interface RevenueData {
  collectedCents:    number;
  collectedDisplay:  string;
  sessionCount:      number;
  latestSessionTs:   number;
  genesisTs:         number;
  genesisCents:      number;
  snapshotAt:        string;
  kernelVersion:     string;
  anchorSha:         string;
}

interface LiabilityData {
  assessedCents:      number;
  assessedDisplay:    string;
  collectedCents:     number;
  collectedDisplay:   string;
  outstandingCents:   number;
  outstandingDisplay: string;
}

interface RevenueResponse {
  revenue:   RevenueData;
  liability: LiabilityData;
  timestamp: string;
}

function formatTs(ts: number | string | null): string {
  if (!ts) return "—";
  try {
    const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch { return String(ts); }
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
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💰</div>
        <h2 style={{ color: GOLD, marginBottom: "0.5rem" }}>Stripe Revenue Dashboard</h2>
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
export default function StripeRevenueDashboard() {
  // ── VaultGate auth — uses dedicated /api/v1/vault/auth-check endpoint ─────
  const { authed, checking, password, setPassword, authError, handleAuth } =
    useVaultAuth();

  const [data, setData]             = useState<RevenueResponse | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<AosUiError | null>(null);
  const [lookbackDays, setLookbackDays] = useState(90);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/stripe/revenue?days=${lookbackDays}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const json = await res.json() as RevenueResponse;
      setData(json);
    } catch (err) {
      setError(buildAosUiError(AOS_ERROR.STRIPE_ERROR, err instanceof Error ? err.message : String(err)));
    } finally { setLoading(false); }
  }, [lookbackDays]);

  useEffect(() => { if (authed) void fetchData(); }, [authed, fetchData]);

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

  const rev  = data?.revenue;
  const liab = data?.liability;

  return (
    <main className="page" style={{ background: DARK_BG }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ background: "repeating-linear-gradient(135deg,#00100a 0,#00100a 10px,#001a10 10px,#001a10 20px)", borderBottom: `2px solid ${GREEN}`, padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <span style={{ fontSize: "1.3rem" }}>💰</span>
        <div>
          <p style={{ color: GREEN, fontSize: "0.7rem", fontFamily: FONT_MONO, margin: 0, letterSpacing: "0.12em" }}>
            🔒 ADMIN — CREATOR-LOCKED
          </p>
          <h1 style={{ color: GOLD, margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
            Stripe Revenue Dashboard
          </h1>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <select
            value={lookbackDays}
            onChange={(e) => setLookbackDays(parseInt(e.target.value))}
            style={{ padding: "0.4rem 0.7rem", borderRadius: "6px", border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.4)", color: WHITE, fontFamily: FONT_MONO, fontSize: "0.8rem", outline: "none" }}
          >
            {[7, 30, 90, 180, 365].map((d) => (
              <option key={d} value={d}>Last {d}d</option>
            ))}
          </select>
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            style={{ padding: "0.45rem 1rem", borderRadius: "6px", border: `1px solid ${GOLD_BORD}`, background: GOLD_BG, color: GOLD, cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT_MONO, fontSize: "0.8rem", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "⏳" : "🔄"} Refresh
          </button>
        </div>
      </div>

      {error && <SovereignErrorBanner error={error} />}

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 1.25rem 4rem" }}>

        {/* ── Genesis Dollar Anchor ────────────────────────────────────────── */}
        {rev && rev.genesisTs > 0 && (
          <div style={{ ...card({ textAlign: "center", background: "rgba(0,40,20,0.6)", border: `2px solid ${GREEN}` }), marginBottom: "1.5rem" }}>
            <p style={{ color: GREEN, fontFamily: FONT_MONO, fontSize: "0.78rem", margin: "0 0 0.4rem", letterSpacing: "0.1em" }}>
              ⚡ GENESIS DOLLAR ANCHOR
            </p>
            <div style={{ color: GOLD, fontFamily: FONT_MONO, fontWeight: 800, fontSize: "2.4rem" }}>
              {(rev.genesisCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </div>
            <p style={{ color: MUTED, fontFamily: FONT_MONO, fontSize: "0.82rem", margin: "0.5rem 0 0" }}>
              First verified alignment payment · {formatTs(rev.genesisTs)}
            </p>
          </div>
        )}

        {/* ── Metric cards ─────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total Collected",    value: rev?.collectedDisplay ?? "—",     color: GREEN },
            { label: "Sessions Paid",      value: rev?.sessionCount?.toLocaleString() ?? "—", color: GOLD },
            { label: "Total Assessed",     value: liab?.assessedDisplay ?? "—",     color: ORANGE },
            { label: "Outstanding",        value: liab?.outstandingDisplay ?? "—",  color: RED },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card({ padding: "1rem 1.25rem", marginBottom: 0 }) }}>
              <p style={{ color: MUTED, fontSize: "0.75rem", fontFamily: FONT_MONO, margin: "0 0 0.25rem" }}>{label}</p>
              <p style={{ color, fontWeight: 700, fontFamily: FONT_MONO, fontSize: "1.3rem", margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Snapshot details ─────────────────────────────────────────────── */}
        {rev && (
          <div style={card()}>
            <p style={{ color: GOLD, fontWeight: 700, fontFamily: FONT_MONO, fontSize: "0.88rem", margin: "0 0 0.8rem" }}>
              📊 REVENUE SNAPSHOT DETAILS
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT_MONO, fontSize: "0.8rem" }}>
              <tbody>
                {[
                  ["Look-back Window",    `Last ${lookbackDays} days`],
                  ["Last Session",        formatTs(rev.latestSessionTs)],
                  ["Genesis Event",       rev.genesisTs > 0 ? formatTs(rev.genesisTs) : "No payments yet"],
                  ["Snapshot At",         rev.snapshotAt],
                  ["Snapshot Kernel",     rev.kernelVersion],
                  ["SHA-512 Anchor",      rev.anchorSha ? rev.anchorSha.slice(0, 32) + "…" : "—"],
                ].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: `1px solid rgba(212,175,55,0.1)` }}>
                    <td style={{ color: MUTED, padding: "0.45rem 1rem 0.45rem 0", whiteSpace: "nowrap" }}>{k}</td>
                    <td style={{ color: GOLD_DIM, wordBreak: "break-all" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── No data placeholder ───────────────────────────────────────────── */}
        {!loading && !data && !error && (
          <p style={{ color: MUTED, fontFamily: FONT_MONO, textAlign: "center", padding: "3rem 0" }}>
            No revenue data loaded. Click Refresh to fetch from Stripe.
          </p>
        )}

        {/* ── Quick links ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {[
            { href: "/admin/settlements", label: "⚖️ Settlement Dashboard" },
            { href: "/tari-revenue",      label: "💹 TARI™ Revenue (Public)" },
            { href: "/admin",             label: "🛡️ Admin Home" },
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
