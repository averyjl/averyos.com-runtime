"use client";

/**
 * app/admin/sovereign/page.tsx
 *
 * AveryOS™ Sovereign Admin Hub — GATE 119.8.4 / 119.9.4
 *
 * Consolidates R2, D1, TARI™ metrics and Resonance behind a single
 * VaultGate-secured tab interface. Password verification uses
 * sha512_payload column via /api/v1/vault/auth-check.
 *
 * Tabs: TARI™ · D1 Ledger · R2 Vault · Resonance
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG          = "#000000";
const GOLD        = "#ffd700";
const GOLD_DIM    = "rgba(255,215,0,0.65)";
const GOLD_BORDER = "rgba(255,215,0,0.28)";
const GREEN       = "#00ff41";
const RED         = "#f87171";
const MUTED       = "rgba(255,255,255,0.45)";
const PANEL_BG    = "rgba(10,10,10,0.85)";
const FONT_MONO   = "JetBrains Mono, Courier New, monospace";

// ── Tab type ──────────────────────────────────────────────────────────────────
type SovTab = "tari" | "d1" | "r2" | "resonance";

// ── Data interfaces ───────────────────────────────────────────────────────────
interface TariStats {
  total_entries: number;
  total_tier9_events: number;
  liability_accrued_usd: number;
  stripe_available_usd: number | null;
  stripe_pending_usd: number | null;
  stripe_revenue_status: string;
  firebase_sync_status: string;
  timestamp: string;
}

interface VaultBlock {
  id: number; block_type: string; timestamp: string;
  block_sha512: string; payload: string;
}

interface LedgerData {
  blocks: VaultBlock[]; total: number;
  kernel_sha_prefix: string; timestamp: string;
}

interface HealthData {
  status: string; d1: string; r2?: string;
  kernel_version: string; health_last_anchored: string;
}

// ── Utility ───────────────────────────────────────────────────────────────────
function fmtUsd(val: number | null): string {
  if (val === null) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000)     return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)         return `$${(val / 1_000).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
}

// ── Auth Gate ─────────────────────────────────────────────────────────────────
function AuthGate({
  password, setPassword, onSubmit, error, checking,
}: {
  password: string; setPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null; checking: boolean;
}) {
  return (
    <main style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: FONT_MONO }}>
      <AnchorBanner />
      <div style={{ maxWidth: 420, margin: "8rem auto", padding: "2rem",
                    border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, background: PANEL_BG }}>
        <h1 style={{ color: GOLD, fontSize: "1.2rem", marginBottom: "1.5rem", textAlign: "center" }}>
          🔐 Sovereign Admin — VaultGate
        </h1>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label style={{ color: GOLD_DIM, fontSize: "0.82rem", letterSpacing: "0.08em" }}>
            VAULT PASSPHRASE
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{
              background: "#0a0a0a", color: GOLD, border: `1px solid ${GOLD_BORDER}`,
              borderRadius: 4, padding: "0.6rem 0.85rem", fontFamily: FONT_MONO,
              fontSize: "0.9rem", outline: "none",
            }}
          />
          {error && <p style={{ color: RED, fontSize: "0.8rem", margin: 0 }}>{error}</p>}
          <button type="submit" disabled={checking} style={{
            background: GOLD, color: "#000", border: "none", borderRadius: 4,
            padding: "0.6rem", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem",
            opacity: checking ? 0.6 : 1,
          }}>
            {checking ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>
    </main>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SovereignAdminPage() {
  const { authed, checking: authChecking, password, setPassword,
          authError, handleAuth } = useVaultAuth();

  const [activeTab, setActiveTab] = useState<SovTab>("tari");
  const [tariStats, setTariStats]   = useState<TariStats | null>(null);
  const [tariError, setTariError]   = useState<AosUiError | null>(null);
  const [tariLoading, setTariLoading] = useState(false);
  const [ledger, setLedger]           = useState<LedgerData | null>(null);
  const [ledgerError, setLedgerError] = useState<AosUiError | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [health, setHealth]             = useState<HealthData | null>(null);
  const [healthError, setHealthError]   = useState<AosUiError | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const fetchTari = useCallback(async () => {
    setTariLoading(true); setTariError(null);
    try {
      const res = await fetch("/api/v1/tari-stats", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTariStats(await res.json() as TariStats);
    } catch (err) {
      setTariError(buildAosUiError(AOS_ERROR.EXTERNAL_API_ERROR, err instanceof Error ? err.message : String(err)));
    } finally { setTariLoading(false); }
  }, []);

  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true); setLedgerError(null);
    try {
      const res = await fetch("/api/v1/vaultchain-ledger?limit=10", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLedger(await res.json() as LedgerData);
    } catch (err) {
      setLedgerError(buildAosUiError(AOS_ERROR.EXTERNAL_API_ERROR, err instanceof Error ? err.message : String(err)));
    } finally { setLedgerLoading(false); }
  }, []);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true); setHealthError(null);
    try {
      const res = await fetch("/api/v1/health", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth(await res.json() as HealthData);
    } catch (err) {
      setHealthError(buildAosUiError(AOS_ERROR.EXTERNAL_API_ERROR, err instanceof Error ? err.message : String(err)));
    } finally { setHealthLoading(false); }
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (activeTab === "tari")      fetchTari();
    if (activeTab === "d1")        fetchLedger();
    if (activeTab === "r2" || activeTab === "resonance") fetchHealth();
  }, [authed, activeTab, fetchTari, fetchLedger, fetchHealth]);

  if (authChecking || !authed) {
    return (
      <AuthGate
        password={password}
        setPassword={setPassword}
        onSubmit={handleAuth}
        error={authError}
        checking={authChecking}
      />
    );
  }

  function tabStyle(tab: SovTab): React.CSSProperties {
    const active = activeTab === tab;
    return {
      background: active ? GOLD : "transparent",
      color: active ? "#000" : GOLD_DIM,
      border: `1px solid ${active ? GOLD : GOLD_BORDER}`,
      borderRadius: 4, padding: "0.4rem 1.1rem",
      cursor: "pointer", fontWeight: active ? 700 : 400,
      fontFamily: FONT_MONO, fontSize: "0.82rem",
    };
  }

  function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div style={{ background: PANEL_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: 6, padding: "0.85rem 1.1rem", minWidth: 155 }}>
        <div style={{ color: GOLD_DIM, fontSize: "0.72rem", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>{label}</div>
        <div style={{ color: GOLD, fontSize: "1.1rem", fontWeight: 700 }}>{value}</div>
        {sub && <div style={{ color: MUTED, fontSize: "0.72rem", marginTop: "0.2rem" }}>{sub}</div>}
      </div>
    );
  }

  function RefreshBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
    return (
      <button onClick={onClick} disabled={loading} style={{
        background: GOLD, color: "#000", border: "none", borderRadius: 4,
        padding: "0.35rem 0.9rem", fontWeight: 700, cursor: "pointer", fontSize: "0.78rem",
        opacity: loading ? 0.6 : 1,
      }}>
        {loading ? "Loading…" : "⟳ Refresh"}
      </button>
    );
  }

  return (
    <main style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: FONT_MONO }}>
      <AnchorBanner />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem", borderBottom: `1px solid ${GOLD_BORDER}`, paddingBottom: "1.25rem" }}>
          <h1 style={{ color: GOLD, fontSize: "1.5rem", margin: 0, fontWeight: 900 }}>🛡️ Sovereign Admin Hub</h1>
          <p style={{ color: GOLD_DIM, margin: "0.4rem 0 0", fontSize: "0.82rem" }}>
            Kernel {KERNEL_VERSION} · cf83…{KERNEL_SHA.slice(-8)} · VaultGate Active
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <button style={tabStyle("tari")}      onClick={() => setActiveTab("tari")}>⚡ TARI™</button>
          <button style={tabStyle("d1")}        onClick={() => setActiveTab("d1")}>🗃️ D1 Ledger</button>
          <button style={tabStyle("r2")}        onClick={() => setActiveTab("r2")}>📦 R2 Vault</button>
          <button style={tabStyle("resonance")} onClick={() => setActiveTab("resonance")}>🔮 Resonance</button>
        </div>

        {/* TARI™ Tab */}
        {activeTab === "tari" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ color: GOLD, margin: 0, fontSize: "1.1rem" }}>⚡ TARI™ Revenue</h2>
              <RefreshBtn onClick={fetchTari} loading={tariLoading} />
            </div>
            {tariError && <SovereignErrorBanner error={tariError} />}
            {tariStats && (
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <MetricCard label="STRIPE AVAILABLE" value={fmtUsd(tariStats.stripe_available_usd)} sub={tariStats.stripe_revenue_status} />
                <MetricCard label="STRIPE PENDING"   value={fmtUsd(tariStats.stripe_pending_usd)} />
                <MetricCard label="LIABILITY ACCRUED" value={fmtUsd(tariStats.liability_accrued_usd)} />
                <MetricCard label="TARI ENTRIES"     value={String(tariStats.total_entries)} />
                <MetricCard label="TIER-9 EVENTS"    value={String(tariStats.total_tier9_events)} />
              </div>
            )}
            {!tariStats && !tariLoading && !tariError && (
              <p style={{ color: MUTED }}>Click ⟳ Refresh to load TARI™ metrics.</p>
            )}
          </div>
        )}

        {/* D1 Ledger Tab */}
        {activeTab === "d1" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ color: GOLD, margin: 0, fontSize: "1.1rem" }}>🗃️ VaultChain™ Ledger</h2>
              <RefreshBtn onClick={fetchLedger} loading={ledgerLoading} />
            </div>
            {ledgerError && <SovereignErrorBanner error={ledgerError} />}
            {ledger && (
              <>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
                  <MetricCard label="TOTAL BLOCKS" value={String(ledger.total)} sub={`kernel ${ledger.kernel_sha_prefix}…`} />
                  <MetricCard label="LAST UPDATED" value={ledger.timestamp.slice(0, 19)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {ledger.blocks.map((b) => (
                    <div key={b.id} style={{ background: PANEL_BG, border: `1px solid ${GOLD_BORDER}`,
                                             borderRadius: 6, padding: "0.65rem 0.9rem", fontSize: "0.79rem" }}>
                      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.2rem" }}>
                        <span style={{ color: GOLD, fontWeight: 700 }}>#{b.id}</span>
                        <span style={{ color: GOLD_DIM }}>{b.block_type}</span>
                        <span style={{ color: MUTED, fontSize: "0.74rem" }}>{b.timestamp}</span>
                      </div>
                      <div style={{ color: "#e2e8f0", wordBreak: "break-word" }}>{b.payload}</div>
                      <div style={{ color: MUTED, fontSize: "0.68rem", marginTop: "0.2rem" }}>{b.block_sha512.slice(0, 24)}…</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!ledger && !ledgerLoading && !ledgerError && <p style={{ color: MUTED }}>Click ⟳ Refresh to load ledger data.</p>}
          </div>
        )}

        {/* R2 Vault Tab */}
        {activeTab === "r2" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ color: GOLD, margin: 0, fontSize: "1.1rem" }}>📦 R2 Vault Status</h2>
              <RefreshBtn onClick={fetchHealth} loading={healthLoading} />
            </div>
            {healthError && <SovereignErrorBanner error={healthError} />}
            {health && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <MetricCard label="D1 STATUS"       value={health.d1}                              sub="sovereign database" />
                <MetricCard label="R2 STATUS"       value={health.r2 ?? "PENDING"}                sub="evidence vault" />
                <MetricCard label="KERNEL"          value={health.kernel_version} />
                <MetricCard label="HEALTH ANCHOR"   value={(health.health_last_anchored ?? "—").slice(0, 19)} />
              </div>
            )}
            {!health && !healthLoading && !healthError && <p style={{ color: MUTED }}>Click ⟳ Refresh to load R2 status.</p>}
            <p style={{ color: MUTED, fontSize: "0.78rem", marginTop: "1.25rem" }}>
              R2 capsule keys use <code style={{ color: GOLD }}>averyos-capsules/</code> prefix via <code style={{ color: GOLD }}>capsuleKey()</code>.
            </p>
          </div>
        )}

        {/* Resonance Tab */}
        {activeTab === "resonance" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ color: GOLD, margin: 0, fontSize: "1.1rem" }}>🔮 Kernel Resonance</h2>
              <RefreshBtn onClick={fetchHealth} loading={healthLoading} />
            </div>
            {healthError && <SovereignErrorBanner error={healthError} />}
            <div style={{ background: PANEL_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: 6, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
              <div style={{ color: GOLD_DIM, fontSize: "0.72rem", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>KERNEL ANCHOR</div>
              <div style={{ color: GREEN, fontSize: "0.78rem", wordBreak: "break-all", fontFamily: FONT_MONO }}>{KERNEL_SHA}</div>
              <div style={{ color: MUTED, fontSize: "0.72rem", marginTop: "0.35rem" }}>{KERNEL_VERSION} · 100.000% alignment</div>
            </div>
            {health && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <MetricCard label="SYSTEM STATUS"  value={health.status} />
                <MetricCard label="D1 PARITY"      value={health.d1} />
                <MetricCard label="KERNEL VERSION" value={health.kernel_version} />
                <MetricCard label="LAST ANCHORED"  value={(health.health_last_anchored ?? "—").slice(0, 19)} />
              </div>
            )}
            {!health && !healthLoading && !healthError && <p style={{ color: MUTED }}>Click ⟳ Refresh to load resonance data.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
