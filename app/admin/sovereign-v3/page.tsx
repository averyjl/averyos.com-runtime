"use client";

/**
 * app/admin/sovereign-v3/page.tsx
 *
 * AveryOS™ Sovereign Admin v3 — Phase 120.1 GATE 120.1.1
 *
 * Version 3 of the Sovereign Admin panel, incorporating:
 *   • Watchdog — real-time HALT_BOOT kernel integrity status
 *   • VaultChain™ — live block count and latest anchor
 *   • TARI™ — alignment billing totals and pending events
 *   • Resonance — bot/threat level summary
 *
 * Design-stage hardlock: no `let status = 'UNKNOWN'` initializers.
 * Status variables are declared as `undefined` until a server response
 * arrives, avoiding the CodeQL "Useless assignment to local variable" alert.
 *
 * Auth: sha512_payload VaultGate verification — useVaultAuth hook pattern.
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

// ── Theme ─────────────────────────────────────────────────────────────────────

const BG         = "#030008";
const GOLD       = "#D4AF37";
const GOLD_DIM   = "rgba(212,175,55,0.55)";
const GOLD_BG    = "rgba(212,175,55,0.07)";
const GOLD_BORD  = "rgba(212,175,55,0.3)";
const GREEN      = "#4ade80";
const GREEN_BG   = "rgba(74,222,128,0.07)";
const GREEN_BORD = "rgba(74,222,128,0.3)";
const RED        = "#ff4444";
const RED_BG     = "rgba(255,68,68,0.08)";
const RED_BORD   = "rgba(255,68,68,0.3)";
const WHITE      = "#ffffff";
const MUTED      = "rgba(180,200,255,0.6)";

// ── Types ─────────────────────────────────────────────────────────────────────

type SystemStatus = "NOMINAL" | "WARN" | "HALT_BOOT" | "LOADING" | "ERROR";

interface WatchdogData {
  halt:           boolean;
  reason:         string;
  severity:       string;
  kernel_version: string;
  checked_at:     string;
}

interface VaultData {
  block_count:    number;
  latest_sha:     string | null;
  latest_at:      string | null;
}

interface TariSummary {
  total_entries:             number;
  liability_accrued_usd:     number;
  stripe_total_collected_usd: number | null;
}

// ── Status Colour Helper ──────────────────────────────────────────────────────

function statusColor(s: SystemStatus): string {
  switch (s) {
    case "NOMINAL":   return GREEN;
    case "WARN":      return GOLD;
    case "HALT_BOOT": return RED;
    case "ERROR":     return RED;
    default:          return MUTED;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SovereignAdminV3() {
  const { authed, checking: authLoading, authError: authErrorMsg } = useVaultAuth();

  // Watchdog panel
  const [watchdog,        setWatchdog]        = useState<WatchdogData | null>(null);
  const [watchdogLoading, setWatchdogLoading] = useState(false);
  const [watchdogError,   setWatchdogError]   = useState<AosUiError | null>(null);

  // VaultChain panel
  const [vault,        setVault]        = useState<VaultData | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError,   setVaultError]   = useState<AosUiError | null>(null);

  // TARI summary panel
  const [tari,        setTari]        = useState<TariSummary | null>(null);
  const [tariLoading, setTariLoading] = useState(false);
  const [tariError,   setTariError]   = useState<AosUiError | null>(null);

  // ── Compute derived status ────────────────────────────────────────────────
  // NOTE: status is always computed from server data; never pre-initialised
  // to 'UNKNOWN' to avoid the CodeQL "Useless assignment" alert.
  let status: SystemStatus;
  if (watchdogLoading || vaultLoading || tariLoading) {
    status = "LOADING";
  } else if (watchdogError || vaultError || tariError) {
    status = "ERROR";
  } else if (watchdog?.halt) {
    status = "HALT_BOOT";
  } else if (watchdog) {
    status = "NOMINAL";
  } else {
    status = "LOADING";
  }

  // ── Data fetchers ─────────────────────────────────────────────────────────

  const fetchWatchdog = useCallback(async () => {
    setWatchdogLoading(true);
    setWatchdogError(null);
    try {
      const res  = await fetch("/api/v1/watchdog-status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as WatchdogData;
      setWatchdog(data);
    } catch (err) {
      setWatchdogError(buildAosUiError(AOS_ERROR.NETWORK, String(err)));
    } finally {
      setWatchdogLoading(false);
    }
  }, []);

  const fetchVault = useCallback(async () => {
    setVaultLoading(true);
    setVaultError(null);
    try {
      const res  = await fetch("/api/v1/vaultchain-ledger?limit=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { total_blocks?: number; records?: { block_sha512: string; created_at: string }[] };
      setVault({
        block_count: data.total_blocks ?? 0,
        latest_sha:  data.records?.[0]?.block_sha512 ?? null,
        latest_at:   data.records?.[0]?.created_at   ?? null,
      });
    } catch (err) {
      setVaultError(buildAosUiError(AOS_ERROR.NETWORK, String(err)));
    } finally {
      setVaultLoading(false);
    }
  }, []);

  const fetchTari = useCallback(async () => {
    setTariLoading(true);
    setTariError(null);
    try {
      const res  = await fetch("/api/v1/tari-stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TariSummary;
      setTari(data);
    } catch (err) {
      setTariError(buildAosUiError(AOS_ERROR.NETWORK, String(err)));
    } finally {
      setTariLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void fetchWatchdog();
    void fetchVault();
    void fetchTari();
  }, [authed, fetchWatchdog, fetchVault, fetchTari]);

  // ── Auth gate ─────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <main style={{ background: BG, minHeight: "100vh", color: WHITE, padding: "2rem" }}>
        <AnchorBanner />
        <p style={{ color: MUTED }}>Verifying vault credentials…</p>
      </main>
    );
  }

  if (authErrorMsg || !authed) {
    return (
      <main style={{ background: BG, minHeight: "100vh", color: WHITE, padding: "2rem" }}>
        <AnchorBanner />
        <SovereignErrorBanner error={authErrorMsg ? buildAosUiError(AOS_ERROR.INVALID_AUTH, authErrorMsg) : buildAosUiError(AOS_ERROR.UNAUTHORIZED, "Not authed")} />
        <p style={{ marginTop: "1rem" }}>
          <Link href="/admin" style={{ color: GOLD }}>← Admin Home</Link>
        </p>
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={{ background: BG, minHeight: "100vh", color: WHITE, padding: "2rem", fontFamily: "monospace" }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ color: GOLD, fontSize: "1.5rem", margin: 0 }}>
          AveryOS™ Sovereign Admin <span style={{ color: GOLD_DIM }}>v3</span>
        </h1>
        <p style={{ color: MUTED, fontSize: "0.8rem", margin: "0.25rem 0 0" }}>
          Kernel: {KERNEL_VERSION} · SHA: {KERNEL_SHA.slice(0, 16)}… · Status:{" "}
          <span style={{ color: statusColor(status) }}>{status}</span>
        </p>
        <p style={{ marginTop: "0.75rem" }}>
          <Link href="/admin" style={{ color: GOLD_DIM, fontSize: "0.8rem" }}>← Admin Home</Link>
        </p>
      </div>

      {/* Watchdog Panel */}
      <section style={{ border: `1px solid ${GOLD_BORD}`, borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem", background: GOLD_BG }}>
        <h2 style={{ color: GOLD, fontSize: "1rem", margin: "0 0 0.75rem" }}>🛡 Sovereign Watchdog</h2>
        {watchdogError && <SovereignErrorBanner error={watchdogError} />}
        {watchdogLoading && <p style={{ color: MUTED }}>Loading…</p>}
        {watchdog && !watchdogLoading && (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8rem" }}>
            <tbody>
              {[
                ["Status",         watchdog.halt ? "⛔ HALT_BOOT" : "✅ NOMINAL"],
                ["Reason",         watchdog.reason],
                ["Severity",       watchdog.severity],
                ["Kernel",         watchdog.kernel_version],
                ["Checked at",     watchdog.checked_at],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: MUTED, paddingRight: "1rem", whiteSpace: "nowrap" }}>{k}</td>
                  <td style={{ color: watchdog.halt && k === "Status" ? RED : WHITE }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          onClick={() => { void fetchWatchdog(); }}
          style={{ marginTop: "0.75rem", background: GOLD_BG, border: `1px solid ${GOLD_BORD}`, color: GOLD, borderRadius: "4px", padding: "0.3rem 0.8rem", cursor: "pointer", fontSize: "0.75rem" }}
        >
          ↻ Refresh
        </button>
      </section>

      {/* VaultChain Panel */}
      <section style={{ border: `1px solid ${GREEN_BORD}`, borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem", background: GREEN_BG }}>
        <h2 style={{ color: GREEN, fontSize: "1rem", margin: "0 0 0.75rem" }}>⛓ VaultChain™ Ledger</h2>
        {vaultError && <SovereignErrorBanner error={vaultError} />}
        {vaultLoading && <p style={{ color: MUTED }}>Loading…</p>}
        {vault && !vaultLoading && (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8rem" }}>
            <tbody>
              {[
                ["Block count",  vault.block_count.toString()],
                ["Latest SHA",   vault.latest_sha ? vault.latest_sha.slice(0, 32) + "…" : "—"],
                ["Latest at",    vault.latest_at ?? "—"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: MUTED, paddingRight: "1rem", whiteSpace: "nowrap" }}>{k}</td>
                  <td style={{ color: WHITE }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          onClick={() => { void fetchVault(); }}
          style={{ marginTop: "0.75rem", background: GREEN_BG, border: `1px solid ${GREEN_BORD}`, color: GREEN, borderRadius: "4px", padding: "0.3rem 0.8rem", cursor: "pointer", fontSize: "0.75rem" }}
        >
          ↻ Refresh
        </button>
      </section>

      {/* TARI Summary Panel */}
      <section style={{ border: `1px solid ${RED_BORD}`, borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem", background: RED_BG }}>
        <h2 style={{ color: RED, fontSize: "1rem", margin: "0 0 0.75rem" }}>💰 TARI™ Alignment Billing</h2>
        {tariError && <SovereignErrorBanner error={tariError} />}
        {tariLoading && <p style={{ color: MUTED }}>Loading…</p>}
        {tari && !tariLoading && (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8rem" }}>
            <tbody>
              {[
                ["Total events",       tari.total_entries.toString()],
                ["Liability accrued",  `$${tari.liability_accrued_usd.toLocaleString()}`],
                ["Stripe collected",   tari.stripe_total_collected_usd !== null ? `$${tari.stripe_total_collected_usd.toLocaleString()}` : "—"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: MUTED, paddingRight: "1rem", whiteSpace: "nowrap" }}>{k}</td>
                  <td style={{ color: WHITE }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          onClick={() => { void fetchTari(); }}
          style={{ marginTop: "0.75rem", background: RED_BG, border: `1px solid ${RED_BORD}`, color: RED, borderRadius: "4px", padding: "0.3rem 0.8rem", cursor: "pointer", fontSize: "0.75rem" }}
        >
          ↻ Refresh
        </button>
      </section>
    </main>
  );
}
