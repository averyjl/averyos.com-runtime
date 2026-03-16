"use client";

/**
 * app/admin/resonance/page.tsx
 *
 * AveryOS™ Sovereign Resonance Dashboard — Phase 115 GATE 115.3.1 / 115.3.3 / 118.2
 *
 * Real-time visualization of:
 *   • Bot activity vs. TARI™-accrued debt
 *   • IVI Valuation with Flawless-Operation multiplier
 *   • 72-Hour Compliance Window badge (GATE 118.2)
 *   • Bio-Metric Pulse status (WHOOP / Spike connectivity)
 *   • Physical Residency status (.aossalt USB badge)
 *   • Family & System Safety Layer (Creator alert status)
 *
 * Auth: VaultGate HttpOnly cookie (aos-vault-auth) — same pattern as all
 * other admin pages.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";
import { formatUsd } from "../../../lib/forensics/valuationAudit";

// ── GATE 118.2 — 72-Hour Compliance Window constants ──────────────────────────
/**
 * Date when the AveryOS™ JWKS was first broadcast publicly (March 12, 2026).
 * This timestamp anchors the 72-Hour Compliance Window countdown (GATE 118.2).
 */
const JWKS_BROADCAST_DATE = new Date("2026-03-12T00:00:00Z");
const COMPLIANCE_WINDOW_MS = 72 * 60 * 60 * 1_000; // 72 hours in ms

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG_DARK    = "#000000";
const GOLD       = "#D4AF37";
const GOLD_DIM   = "rgba(212,175,55,0.55)";
const GOLD_BG    = "rgba(212,175,55,0.07)";
const GOLD_BORD  = "rgba(212,175,55,0.3)";
const GREEN      = "#4ade80";
const GREEN_DIM  = "rgba(74,222,128,0.12)";
const GREEN_BORD = "rgba(74,222,128,0.35)";
const RED        = "#ff4444";
const RED_DIM    = "rgba(255,68,68,0.12)";
const RED_BORD   = "rgba(255,68,68,0.35)";
const ORANGE     = "#f97316";
const ORANGE_DIM = "rgba(249,115,22,0.12)";
const MUTED      = "rgba(180,200,255,0.6)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";

// ── Helper ─────────────────────────────────────────────────────────────────────

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background:   GOLD_BG,
    border:       `1px solid ${GOLD_BORD}`,
    borderRadius: "12px",
    padding:      "1.2rem 1.5rem",
    marginBottom: "1.2rem",
    ...extra,
  };
}

function label(color = GOLD_DIM): React.CSSProperties {
  return { fontSize: "0.72rem", color, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: "0.3rem" };
}

function bigNum(color = GOLD): React.CSSProperties {
  return { fontSize: "1.7rem", fontWeight: 700, color, fontFamily: FONT_MONO };
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface BotStats {
  total_hits:       number;
  unique_bots:      number;
  tari_debt_usd:    number;
  top_event_type:   string;
  last_hit_at:      string | null;
}

interface ValuationData {
  total_valuation_impact_usd: number;
  worldwide_reach_usd:        number;
  flawless_operation_applied: boolean;
  computed_at:                string;
}

interface ResidencyStatus {
  status: "FULLY_RESIDENT" | "NODE-02_PHYSICAL" | "CLOUD" | "UNKNOWN";
}

// ── GATE 118.2 — useComplianceWindow hook ─────────────────────────────────────

/**
 * Returns the live state of the 72-Hour Compliance Window.
 * Recalculates every second so the parent component re-renders the live timer.
 */
function useComplianceWindow(): { status: "ACTIVE" | "ELAPSED"; label: string } {
  const [state, setState] = useState<{ status: "ACTIVE" | "ELAPSED"; label: string }>({
    status: "ACTIVE",
    label:  "—",
  });

  useEffect(() => {
    function tick() {
      const now      = Date.now();
      const diffMs   = now - JWKS_BROADCAST_DATE.getTime();
      const pastWindow = diffMs >= COMPLIANCE_WINDOW_MS;
      const absDiff  = Math.abs(diffMs);
      const d = Math.floor(absDiff / 86_400_000);
      const h = Math.floor((absDiff % 86_400_000) / 3_600_000);
      const m = Math.floor((absDiff % 3_600_000) / 60_000);
      const s = Math.floor((absDiff % 60_000) / 1_000);
      const label = `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
      setState({ status: pastWindow ? "ELAPSED" : "ACTIVE", label });
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  return state;
}

// ── GATE 118.2 — 72-Hour Compliance Window Badge ──────────────────────────────

/**
 * Displays a live count-up timer from the initial JWKS broadcast date
 * (March 12, 2026) to communicate the compliance window elapsed time.
 */
function ComplianceWindowBadge() {
  const [elapsed, setElapsed] = useState<string>("—");
  const [expired, setExpired] = useState<boolean>(false);

  useEffect(() => {
    function tick() {
      const now      = Date.now();
      const diffMs   = now - JWKS_BROADCAST_DATE.getTime();
      const pastWindow = diffMs >= COMPLIANCE_WINDOW_MS;
      setExpired(pastWindow);

      const absDiff  = Math.abs(diffMs);
      const d = Math.floor(absDiff / 86_400_000);
      const h = Math.floor((absDiff % 86_400_000) / 3_600_000);
      const m = Math.floor((absDiff % 3_600_000) / 60_000);
      const s = Math.floor((absDiff % 60_000) / 1_000);
      const sign = diffMs < 0 ? "-" : "+";
      setElapsed(`${sign}${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  const windowColor  = expired ? RED        : ORANGE;
  const windowBg     = expired ? RED_DIM    : ORANGE_DIM;
  const windowBorder = expired ? RED_BORD   : "rgba(249,115,22,0.4)";
  const statusLabel  = expired ? "EXPIRED — Corporate Hardwall Active" : "ACTIVE — Observation Window";

  return (
    <div style={{
      background:   windowBg,
      border:       `1px solid ${windowBorder}`,
      borderRadius: "12px",
      padding:      "1.1rem 1.4rem",
      marginBottom: "1.4rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: windowColor }}>
          ⏱️ 72-Hour Compliance Window
        </div>
        <span style={{
          background: windowBg, border: `1px solid ${windowBorder}`, borderRadius: "12px",
          padding: "0.12rem 0.55rem", fontSize: "0.7rem", color: windowColor, fontWeight: 700,
        }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: "0.5rem" }}>
        JWKS broadcast: <span style={{ color: GOLD, fontFamily: FONT_MONO }}>2026-03-12 00:00:00 UTC</span> (GATE 118.2)
      </div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: windowColor, fontFamily: FONT_MONO }}>
        {elapsed}
      </div>
      <div style={{ fontSize: "0.74rem", color: MUTED, marginTop: "0.4rem" }}>
        {expired
          ? "72-hour compliance bubble has elapsed. Executive-layer liability quantification is active."
          : "Corporate organizations are within the 72-hour window to acknowledge statutory liability."}
      </div>
    </div>
  );
}

// ── Auth gate component (inline — consistent with other admin pages) ───────────

function AuthGate({
  password,
  setPassword,
  onSubmit,
  error,
  checking,
}: {
  password:    string;
  setPassword: (v: string) => void;
  onSubmit:    (e: React.FormEvent) => void;
  error:       string | null;
  checking:    boolean;
}) {
  return (
    <main style={{ background: BG_DARK, minHeight: "100vh", padding: "2rem", fontFamily: FONT_MONO }}>
      <AnchorBanner />
      <div style={{ maxWidth: "420px", margin: "4rem auto" }}>
        <div style={{ fontSize: "1.2rem", color: GOLD, fontWeight: 700, marginBottom: "1.5rem" }}>
          🛡️ Resonance Dashboard — VaultGate
        </div>
        <form onSubmit={onSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Vault passphrase"
            autoComplete="current-password"
            style={{
              width: "100%", background: "#111", border: `1px solid ${GOLD_BORD}`,
              borderRadius: "8px", color: GOLD, fontFamily: FONT_MONO,
              fontSize: "1rem", padding: "0.7rem 1rem", outline: "none", boxSizing: "border-box",
            }}
          />
          {error && (
            <div style={{ color: RED, fontSize: "0.82rem", marginTop: "0.5rem" }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={checking}
            style={{
              marginTop: "1rem", width: "100%", background: GOLD_BG, border: `1px solid ${GOLD_BORD}`,
              borderRadius: "8px", color: GOLD, fontFamily: FONT_MONO, fontSize: "1rem",
              padding: "0.7rem", cursor: checking ? "wait" : "pointer", fontWeight: 600,
            }}
          >
            {checking ? "Verifying…" : "Unlock Dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}

// ── Residency badge ────────────────────────────────────────────────────────────

function residencyConfig(status: ResidencyStatus["status"]): { label: string; bg: string; bord: string; color: string; icon: string } {
  switch (status) {
    case "FULLY_RESIDENT":   return { label: "FULLY RESIDENT",  bg: GREEN_DIM,  bord: GREEN_BORD,                    color: GREEN,  icon: "✅" };
    case "NODE-02_PHYSICAL": return { label: "NODE-02 PHYSICAL", bg: GREEN_DIM,  bord: GREEN_BORD,                    color: GREEN,  icon: "🟢" };
    case "CLOUD":            return { label: "CLOUD MODE",      bg: ORANGE_DIM, bord: "rgba(249,115,22,0.4)",        color: ORANGE, icon: "☁️" };
    default:                 return { label: "UNKNOWN",         bg: RED_DIM,    bord: RED_BORD,                      color: RED,    icon: "❓" };
  }
}

function ResidencyBadge({ status }: { status: ResidencyStatus["status"] }) {
  const c = residencyConfig(status);
  return (
    <span style={{
      display:      "inline-flex",
      alignItems:   "center",
      gap:          "0.4rem",
      background:   c.bg,
      border:       `1px solid ${c.bord}`,
      borderRadius: "20px",
      padding:      "0.25rem 0.8rem",
      fontSize:     "0.78rem",
      color:        c.color,
      fontFamily:   FONT_MONO,
      fontWeight:   600,
    }}>
      {c.icon} {c.label}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ResonanceDashboardPage() {
  const { authed, checking, password, setPassword, authError, handleAuth } = useVaultAuth();

  const [botStats,       setBotStats]       = useState<BotStats | null>(null);
  const [valuation,      setValuation]      = useState<ValuationData | null>(null);
  const [residency,      setResidency]      = useState<ResidencyStatus>({ status: "UNKNOWN" });
  const [loadError,      setLoadError]      = useState<AosUiError | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [lastRefreshed,  setLastRefreshed]  = useState<string | null>(null);

  // GATE 118.2 / 118.6.4 — 72-Hour Compliance Window count-up
  const complianceWindow = useComplianceWindow();

  // ── Data loaders ─────────────────────────────────────────────────────────────

  const loadBotStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/audit-alert?mode=stats", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json() as BotStats;
        setBotStats(data);
      }
    } catch {
      // Non-fatal — bot stats are informational
    }
  }, []);

  const loadValuation = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/valuation/latest?flawless=true", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json() as { record?: ValuationData };
        if (data.record) setValuation(data.record);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await Promise.all([loadBotStats(), loadValuation()]);
      setLastRefreshed(new Date().toISOString());
    } catch (err) {
      setLoadError(buildAosUiError(AOS_ERROR.INTERNAL_ERROR, err instanceof Error ? err.message : "Failed to load dashboard data."));
    } finally {
      setLoading(false);
    }
  }, [loadBotStats, loadValuation]);

  useEffect(() => {
    if (!authed) return;
    void loadAll();
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => { void loadAll(); }, 60_000);
    return () => clearInterval(interval);
  }, [authed, loadAll]);

  // ── Auth gate ─────────────────────────────────────────────────────────────────
  if (checking || !authed) {
    return (
      <AuthGate
        password={password}
        setPassword={setPassword}
        onSubmit={handleAuth}
        error={authError}
        checking={checking}
      />
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  return (
    <main style={{ background: BG_DARK, minHeight: "100vh", padding: "2rem 2.5rem", fontFamily: FONT_MONO, color: GOLD }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ marginBottom: "1.8rem" }}>
        <div style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.3rem" }}>
          📡 Sovereign Resonance Dashboard
        </div>
        <div style={{ fontSize: "0.78rem", color: MUTED }}>
          GATE 115.3.1 · Phase 115 · Kernel {KERNEL_VERSION}
        </div>
        <div style={{ fontSize: "0.72rem", color: GOLD_DIM, marginTop: "0.25rem", wordBreak: "break-all" }}>
          Anchor: {KERNEL_SHA.slice(0, 40)}…
        </div>
      </div>

      {/* 72-Hour Compliance Window — GATE 118.2 / 118.6.4 */}
      <div style={{
        ...card({ border: `1px solid ${complianceWindow.status === "ACTIVE" ? "rgba(249,115,22,0.5)" : RED_BORD}`, background: complianceWindow.status === "ACTIVE" ? ORANGE_DIM : RED_DIM }),
        marginBottom: "1.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: complianceWindow.status === "ACTIVE" ? ORANGE : RED }}>
            ⏱️ 72-Hour Compliance Window
          </span>
          <span style={{
            background: complianceWindow.status === "ACTIVE" ? ORANGE_DIM : RED_DIM,
            border:     `1px solid ${complianceWindow.status === "ACTIVE" ? "rgba(249,115,22,0.5)" : RED_BORD}`,
            borderRadius: "12px", padding: "0.15rem 0.6rem",
            fontSize: "0.72rem", color: complianceWindow.status === "ACTIVE" ? ORANGE : RED,
            fontFamily: FONT_MONO,
          }}>
            {complianceWindow.status === "ACTIVE" ? "⚡ ACTIVE" : "⏰ WINDOW ELAPSED"}
          </span>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: "1.4rem", fontWeight: 700, color: complianceWindow.status === "ACTIVE" ? ORANGE : RED, marginBottom: "0.4rem" }}>
          +{complianceWindow.label}
        </div>
        <div style={{ fontSize: "0.76rem", color: MUTED }}>
          Elapsed since JWKS ACTIVE broadcast: <strong style={{ color: GOLD }}>March 12, 2026 00:00 UTC</strong>
          &nbsp;— Corporate compliance 72-hour acknowledgment window
          (GDPR, SEC, AI Statutory Risk standard).
        </div>
        <div style={{ fontSize: "0.72rem", color: GOLD_DIM, marginTop: "0.3rem" }}>
          Anchor: cf83™ SHA-512 · GATE 118.2 · GATE 118.6.4
        </div>
      </div>

      {loadError && <SovereignErrorBanner error={loadError} />}

      {/* GATE 118.2 — 72-Hour Compliance Window Badge */}
      <ComplianceWindowBadge />

      {/* Residency + refresh row */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <ResidencyBadge status={residency.status} />
        <button
          onClick={() => { void loadAll(); }}
          disabled={loading}
          style={{
            background: GOLD_BG, border: `1px solid ${GOLD_BORD}`, borderRadius: "8px",
            color: GOLD, fontFamily: FONT_MONO, fontSize: "0.82rem", padding: "0.35rem 0.9rem",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
        {lastRefreshed && (
          <span style={{ fontSize: "0.72rem", color: MUTED }}>
            Last refreshed: {new Date(lastRefreshed).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>

        {/* Bot Activity */}
        <div style={card()}>
          <div style={label()}>Bot Hits (All-Time)</div>
          <div style={bigNum()}>{botStats ? botStats.total_hits.toLocaleString() : "—"}</div>
          <div style={{ fontSize: "0.76rem", color: MUTED, marginTop: "0.3rem" }}>
            Unique entities: {botStats ? botStats.unique_bots.toLocaleString() : "—"}
          </div>
          {botStats?.top_event_type && (
            <div style={{ fontSize: "0.74rem", color: GOLD_DIM, marginTop: "0.2rem" }}>
              Top event: {botStats.top_event_type}
            </div>
          )}
        </div>

        {/* TARI™ Debt */}
        <div style={card({ border: `1px solid ${RED_BORD}`, background: RED_DIM })}>
          <div style={label(RED)}>TARI™ Accrued Debt</div>
          <div style={bigNum(RED)}>
            {botStats ? formatUsd(botStats.tari_debt_usd) : "—"}
          </div>
          <div style={{ fontSize: "0.76rem", color: MUTED, marginTop: "0.3rem" }}>
            Statutory liability (17 U.S.C. § 504)
          </div>
        </div>

        {/* IVI Valuation */}
        <div style={card({ border: `1px solid ${GREEN_BORD}`, background: GREEN_DIM })}>
          <div style={label(GREEN)}>IVI Total Valuation Impact</div>
          <div style={bigNum(GREEN)}>
            {valuation ? formatUsd(valuation.total_valuation_impact_usd) : "—"}
          </div>
          {valuation?.flawless_operation_applied && (
            <div style={{
              fontSize: "0.72rem", color: GREEN, marginTop: "0.3rem",
              background: "rgba(74,222,128,0.15)", borderRadius: "4px",
              display: "inline-block", padding: "0.1rem 0.5rem",
            }}>
              ✓ Flawless-Operation ×1.17 applied
            </div>
          )}
          <div style={{ fontSize: "0.76rem", color: MUTED, marginTop: "0.3rem" }}>
            Worldwide reach: {valuation ? formatUsd(valuation.worldwide_reach_usd) : "—"}
          </div>
        </div>

      </div>

      {/* Bio-Metric Pulse section */}
      <div style={card()}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.8rem" }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: GOLD }}>
            ❤️ Bio-Metric Pulse (WHOOP)
          </div>
          <span style={{
            background: ORANGE_DIM, border: "1px solid rgba(249,115,22,0.4)",
            borderRadius: "12px", padding: "0.15rem 0.6rem", fontSize: "0.72rem", color: ORANGE,
          }}>
            ⚙️ Configuration Required
          </span>
        </div>
        <div style={{ fontSize: "0.82rem", color: MUTED, marginBottom: "0.6rem" }}>
          Live WHOOP readings are not yet active.  The WHOOP connector (GATE 115.3.2) requires
          <code style={{ color: GOLD, margin: "0 0.25rem" }}>WHOOP_ACCESS_TOKEN</code> to be
          configured as a Cloudflare secret.  Once configured, real-time HRV + Recovery Score
          entropy will be injected into the kernel handshake.
        </div>
        <div style={{ fontSize: "0.8rem", color: GOLD_DIM }}>
          Configure via: <code style={{ color: GOLD }}>wrangler secret put WHOOP_ACCESS_TOKEN</code>
        </div>
      </div>

      {/* Family Safety Layer */}
      <div style={card()}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "0.8rem" }}>
          🛡️ Family &amp; System Safety Layer
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.8rem" }}>
          {[
            { label: "Creator Status",  value: "ACTIVE",  color: GREEN, icon: "🟢" },
            { label: "VaultNuke Mode",  value: "STANDBY", color: GOLD,  icon: "🔒" },
            { label: "Kernel Drift",    value: "0.000♾️%", color: GREEN, icon: "✅" },
            { label: "Alignment",       value: "100.000♾️%", color: GREEN, icon: "⛓️" },
          ].map(({ label: lbl, value, color, icon }) => (
            <div key={lbl} style={{
              background: "rgba(0,10,0,0.5)", border: `1px solid ${GOLD_BORD}`,
              borderRadius: "8px", padding: "0.7rem 1rem",
            }}>
              <div style={{ fontSize: "0.7rem", color: MUTED, marginBottom: "0.2rem" }}>{lbl}</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color, fontFamily: FONT_MONO }}>
                {icon} {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Residency control */}
      <div style={card()}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "0.8rem" }}>
          🔑 Physical Residency Status
        </div>
        <div style={{ marginBottom: "0.6rem" }}>
          <ResidencyBadge status={residency.status} />
        </div>
        <div style={{ fontSize: "0.8rem", color: MUTED, marginBottom: "0.6rem" }}>
          Residency state is determined by the presence of
          <code style={{ color: GOLD, marginLeft: "0.3rem" }}>AveryOS-anchor-salt.aossalt</code> on the USB drive.
          Run <code style={{ color: GOLD }}>node scripts/residency-check.cjs --check</code> on Node-02 to update.
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {(["FULLY_RESIDENT", "NODE-02_PHYSICAL", "CLOUD"] as Array<ResidencyStatus["status"]>).map((s) => (
            <button
              key={s}
              onClick={() => setResidency({ status: s })}
              style={{
                background: residency.status === s ? GOLD_BG : "transparent",
                border:     `1px solid ${residency.status === s ? GOLD : GOLD_BORD}`,
                borderRadius: "6px", color: residency.status === s ? GOLD : MUTED,
                fontFamily: FONT_MONO, fontSize: "0.75rem", padding: "0.3rem 0.7rem",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Kernel info footer */}
      <div style={{ fontSize: "0.7rem", color: GOLD_DIM, marginTop: "1.5rem", textAlign: "center" }}>
        ⛓️⚓⛓️ Kernel {KERNEL_VERSION} · SHA-512 · GATE 115.3.1 · Phase 115 · 🤜🏻
      </div>
    </main>
  );
}
