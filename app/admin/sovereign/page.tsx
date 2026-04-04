"use client";

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
 * app/admin/sovereign/page.tsx
 *
 * AveryOS™ Consolidated Sovereign Admin Dashboard — Phase 119.7 GATE 119.7.2
 *
 * Single unified dashboard surfacing:
 *   • R2  — Cloudflare R2 evidence vault status & capsule object count
 *   • D1  — Cloudflare D1 database health & VaultChain™ ledger summary
 *   • TARI™ — Alignment billing revenue, pending invoices, & settlement rail
 *   • Resonance — Bot activity, threat level, & Magnet Beacon live feed
 *
 * Auth: sha512_payload VaultGate verification (GATE 119.6.3).
 *   Uses the standard useVaultAuth hook — the same HttpOnly cookie pattern
 *   as all other admin pages, with sha512_payload alignment.
 *
 * GATE 119.9.4 — Live Magnet Beacon feed integrated below the Resonance panel.
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
const BLUE       = "#60a5fa";
const BLUE_BG    = "rgba(96,165,250,0.07)";
const BLUE_BORD  = "rgba(96,165,250,0.3)";
const PURPLE_BG  = "rgba(98,0,234,0.15)";
const PURPLE_BORD= "rgba(120,60,255,0.35)";
const RED        = "#ff4444";
const RED_BG     = "rgba(255,68,68,0.08)";
const RED_BORD   = "rgba(255,68,68,0.3)";
const WHITE      = "#ffffff";
const MUTED      = "rgba(180,200,255,0.6)";
const MONO       = "JetBrains Mono, Courier New, monospace";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthData {
  status?:          string;
  d1_ok?:           boolean;
  kv_ok?:           boolean;
  r2_ok?:           boolean;
  kernel_version?:  string;
}

interface TariStats {
  total_entries?:    number;
  total_revenue_usd?: number;
  pending_invoices?: number;
  latest_invoice_at?: string;
}

interface BotStats {
  total_hits?:         number;
  tier9_count?:        number;
  total_debt_usd?:     number;
  top_asn?:            string;
}

interface VaultChainStatus {
  latest_block_id?:   number;
  latest_block_sha?:  string;
  total_blocks?:      number;
  genesis_verified?:  boolean;
}

interface MagnetBeaconEntry {
  ray_id?:      string;
  ip_address?:  string;
  asn?:         string;
  path?:        string;
  event_type?:  string;
  anchored_at?: string;
}

interface DashboardData {
  health:       HealthData;
  tari:         TariStats;
  bots:         BotStats;
  vaultchain:   VaultChainStatus;
  beacon:       MagnetBeaconEntry[];
  loadedAt:     string;
}

// ── Card helper ───────────────────────────────────────────────────────────────

function card(
  bg: string,
  border: string,
  extra?: React.CSSProperties,
): React.CSSProperties {
  return {
    background:   bg,
    border:       `1px solid ${border}`,
    borderRadius: "14px",
    padding:      "1.2rem 1.5rem",
    marginBottom: "1.2rem",
    ...extra,
  };
}

function badge(
  value: string | number | null | undefined,
  color: string,
): React.ReactNode {
  return (
    <span style={{
      display:      "inline-block",
      padding:      "0.15rem 0.6rem",
      borderRadius: "20px",
      fontSize:     "0.78rem",
      fontWeight:   700,
      background:   color + "22",
      color,
      border:       `1px solid ${color}66`,
      fontFamily:   MONO,
    }}>
      {value ?? "—"}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SovereignAdminDashboard() {
  const { authed, checking, password, setPassword, authError, handleAuth } = useVaultAuth();

  const [data,      setData]      = useState<DashboardData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState<AosUiError | null>(null);
  const [refreshAt, setRefreshAt] = useState<string | null>(null);

  // ── Data loader ───────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [healthRes, tariRes, botRes] = await Promise.allSettled([
        fetch("/api/v1/health",          { credentials: "same-origin" }),
        fetch("/api/v1/tari-stats",      { credentials: "same-origin" }),
        fetch("/api/v1/audit-alert?mode=stats", { credentials: "same-origin" }),
      ]);

      const health: HealthData = healthRes.status === "fulfilled" && healthRes.value.ok
        ? await healthRes.value.json() as HealthData
        : {};

      const tari: TariStats = tariRes.status === "fulfilled" && tariRes.value.ok
        ? await tariRes.value.json() as TariStats
        : {};

      const bots: BotStats = botRes.status === "fulfilled" && botRes.value.ok
        ? await botRes.value.json() as BotStats
        : {};

      // VaultChain™ status — latest block from integrity-status endpoint
      const vcRes = await fetch("/api/v1/integrity-status", { credentials: "same-origin" });
      const vaultchain: VaultChainStatus = vcRes.ok
        ? await vcRes.json() as VaultChainStatus
        : {};

      // Magnet Beacon — recent bot hits (last 10)
      const beaconRes = await fetch("/api/v1/forensics/rayid-log?limit=10", {
        credentials: "same-origin",
      });
      const beaconJson = beaconRes.ok
        ? await beaconRes.json() as { rows: MagnetBeaconEntry[] }
        : { rows: [] };

      setData({
        health,
        tari,
        bots,
        vaultchain,
        beacon:    beaconJson.rows ?? [],
        loadedAt:  new Date().toISOString(),
      });
      setRefreshAt(new Date().toLocaleTimeString());
    } catch (err) {
      setLoadError(buildAosUiError(
        AOS_ERROR.INTERNAL_ERROR,
        err instanceof Error ? err.message : String(err),
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void loadAll();
  }, [authed, loadAll]);

  // ── Auth gate ─────────────────────────────────────────────────────────────

  if (checking) {
    return (
      <main className="page" style={{ background: BG, minHeight: "100vh" }}>
        <AnchorBanner />
        <p style={{ color: MUTED, textAlign: "center", marginTop: "4rem" }}>
          Verifying VaultGate sha512_payload…
        </p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="page" style={{ background: BG, minHeight: "100vh" }}>
        <AnchorBanner />
        <div style={{
          maxWidth:    420,
          margin:      "5rem auto",
          padding:     "2rem",
          background:  PURPLE_BG,
          border:      `1px solid ${PURPLE_BORD}`,
          borderRadius: 16,
          textAlign:   "center",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⛓️⚓⛓️</div>
          <h2 style={{ color: WHITE, marginBottom: "0.5rem" }}>Sovereign Admin</h2>
          <p style={{ color: MUTED, marginBottom: "1.5rem", fontSize: "0.88rem" }}>
            VaultGate sha512_payload verification required.
          </p>
          <input
            type="password"
            placeholder="VAULTAUTH_TOKEN"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void handleAuth(); }}
            style={{
              width:        "100%",
              padding:      "0.75rem",
              borderRadius: 8,
              border:       `1px solid ${PURPLE_BORD}`,
              background:   "rgba(0,0,0,0.45)",
              color:        WHITE,
              marginBottom: "0.75rem",
              fontFamily:   MONO,
              boxSizing:    "border-box",
            }}
          />
          {authError && (
            <p style={{ color: RED, marginBottom: "0.75rem", fontSize: "0.85rem" }}>
              {authError}
            </p>
          )}
          <button
            onClick={() => void handleAuth()}
            style={{
              width:        "100%",
              padding:      "0.75rem",
              borderRadius: 8,
              background:   "rgba(212,175,55,0.7)",
              border:       "none",
              color:        "#000",
              cursor:       "pointer",
              fontWeight:   "bold",
              fontFamily:   MONO,
            }}
          >
            🔓 Unlock Sovereign Dashboard
          </button>
        </div>
      </main>
    );
  }

  // ── Authed: render dashboard ──────────────────────────────────────────────

  const h = data?.health   ?? {};
  const t = data?.tari     ?? {};
  const b = data?.bots     ?? {};
  const v = data?.vaultchain ?? {};

  return (
    <main className="page" style={{ background: BG, minHeight: "100vh" }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: GOLD, margin: 0, fontFamily: MONO, fontSize: "1.4rem" }}>
          ⛓️⚓⛓️ Sovereign Admin Dashboard
        </h1>
        <p style={{ color: MUTED, margin: "0.35rem 0 0", fontSize: "0.82rem", fontFamily: MONO }}>
          Phase 119.7 GATE 119.7.2 · v{KERNEL_VERSION} ·{" "}
          {refreshAt ? `Last refresh: ${refreshAt}` : "Loading…"}
        </p>
      </div>

      {loadError && <SovereignErrorBanner error={loadError} />}

      {loading && (
        <p style={{ color: MUTED, fontFamily: MONO, fontSize: "0.85rem", marginBottom: "1rem" }}>
          ⏳ Loading dashboard data…
        </p>
      )}

      {/* Refresh button */}
      <button
        onClick={() => void loadAll()}
        disabled={loading}
        style={{
          padding:      "0.45rem 1.2rem",
          borderRadius: 8,
          background:   GOLD_BG,
          border:       `1px solid ${GOLD_BORD}`,
          color:        GOLD,
          cursor:       loading ? "not-allowed" : "pointer",
          fontFamily:   MONO,
          fontSize:     "0.82rem",
          marginBottom: "1.5rem",
        }}
      >
        {loading ? "⏳ Refreshing…" : "🔄 Refresh All"}
      </button>

      {/* ── Panel row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>

        {/* ── R2 + D1 Health ── */}
        <div style={card(BLUE_BG, BLUE_BORD)}>
          <h3 style={{ color: BLUE, margin: "0 0 0.9rem", fontFamily: MONO, fontSize: "1rem" }}>
            🗄️ Cloudflare R2 / D1
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>D1 status</td>
                <td style={{ textAlign: "right" }}>
                  {badge(h.d1_ok ? "ONLINE" : "—", h.d1_ok ? GREEN : MUTED)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>KV status</td>
                <td style={{ textAlign: "right" }}>
                  {badge(h.kv_ok ? "ONLINE" : "—", h.kv_ok ? GREEN : MUTED)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>R2 status</td>
                <td style={{ textAlign: "right" }}>
                  {badge(h.r2_ok ? "ONLINE" : "—", h.r2_ok ? GREEN : MUTED)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED }}>Overall</td>
                <td style={{ textAlign: "right" }}>
                  {badge(h.status ?? "—", h.status === "ok" ? GREEN : RED)}
                </td>
              </tr>
            </tbody>
          </table>
          <Link
            href="/admin/evidence"
            style={{ color: BLUE, fontSize: "0.8rem", fontFamily: MONO, textDecoration: "none" }}
          >
            → R2 Evidence Monitor
          </Link>
        </div>

        {/* ── VaultChain™ Ledger ── */}
        <div style={card(GREEN_BG, GREEN_BORD)}>
          <h3 style={{ color: GREEN, margin: "0 0 0.9rem", fontFamily: MONO, fontSize: "1rem" }}>
            ⛓️ VaultChain™ Ledger
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>Total blocks</td>
                <td style={{ textAlign: "right" }}>
                  {badge(v.total_blocks ?? "—", GREEN)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>Latest block</td>
                <td style={{ textAlign: "right" }}>
                  {badge(v.latest_block_id ?? "—", GOLD)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>Genesis</td>
                <td style={{ textAlign: "right" }}>
                  {badge(v.genesis_verified ? "VERIFIED" : "—", v.genesis_verified ? GREEN : RED)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED }}>SHA-512 anchor</td>
                <td style={{ textAlign: "right", fontFamily: MONO, fontSize: "0.7rem", color: GREEN }}>
                  cf83…{KERNEL_SHA.slice(-6)}
                </td>
              </tr>
            </tbody>
          </table>
          <Link
            href="/vaultchain-explorer"
            style={{ color: GREEN, fontSize: "0.8rem", fontFamily: MONO, textDecoration: "none" }}
          >
            → VaultChain™ Explorer
          </Link>
        </div>

        {/* ── TARI™ Revenue ── */}
        <div style={card(GOLD_BG, GOLD_BORD)}>
          <h3 style={{ color: GOLD, margin: "0 0 0.9rem", fontFamily: MONO, fontSize: "1rem" }}>
            💹 TARI™ Alignment Billing
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>Total entries</td>
                <td style={{ textAlign: "right" }}>
                  {badge(t.total_entries?.toLocaleString() ?? "—", GOLD)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>Revenue collected</td>
                <td style={{ textAlign: "right" }}>
                  {badge(
                    t.total_revenue_usd != null
                      ? `$${t.total_revenue_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "—",
                    GREEN,
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>Pending invoices</td>
                <td style={{ textAlign: "right" }}>
                  {badge(t.pending_invoices ?? "—", t.pending_invoices ? GOLD : MUTED)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED }}>Latest invoice</td>
                <td style={{ textAlign: "right", fontFamily: MONO, fontSize: "0.75rem", color: MUTED }}>
                  {t.latest_invoice_at ? new Date(t.latest_invoice_at).toLocaleString() : "—"}
                </td>
              </tr>
            </tbody>
          </table>
          <Link
            href="/tari-revenue"
            style={{ color: GOLD, fontSize: "0.8rem", fontFamily: MONO, textDecoration: "none" }}
          >
            → TARI™ Revenue Dashboard
          </Link>
        </div>

        {/* ── Resonance / Bot Activity ── */}
        <div style={card(RED_BG, RED_BORD)}>
          <h3 style={{ color: RED, margin: "0 0 0.9rem", fontFamily: MONO, fontSize: "1rem" }}>
            📡 Resonance — Bot Activity
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>Total hits</td>
                <td style={{ textAlign: "right" }}>
                  {badge(b.total_hits?.toLocaleString() ?? "—", RED)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>Tier-9 events</td>
                <td style={{ textAlign: "right" }}>
                  {badge(b.tier9_count ?? "—", b.tier9_count ? RED : MUTED)}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED, paddingBottom: "0.4rem" }}>TARI™ debt accrued</td>
                <td style={{ textAlign: "right" }}>
                  {badge(
                    b.total_debt_usd != null
                      ? `$${b.total_debt_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "—",
                    GOLD,
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ color: MUTED }}>Top ASN</td>
                <td style={{ textAlign: "right", fontFamily: MONO, fontSize: "0.78rem", color: WHITE }}>
                  {b.top_asn ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
          <Link
            href="/admin/resonance"
            style={{ color: RED, fontSize: "0.8rem", fontFamily: MONO, textDecoration: "none" }}
          >
            → Resonance Dashboard
          </Link>
        </div>
      </div>

      {/* ── GATE 119.9.4 — Live Magnet Beacon Feed ── */}
      <div style={{
        ...card(PURPLE_BG, PURPLE_BORD),
        marginTop: "0.5rem",
      }}>
        <h3 style={{
          color:      GOLD,
          margin:     "0 0 0.75rem",
          fontFamily: MONO,
          fontSize:   "1rem",
          display:    "flex",
          alignItems: "center",
          gap:        "0.5rem",
        }}>
          🧲 Live Magnet Beacon Feed
          <span style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 400 }}>
            (last 10 hits)
          </span>
        </h3>
        {data?.beacon?.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width:           "100%",
              borderCollapse:  "collapse",
              fontSize:        "0.78rem",
              fontFamily:      MONO,
            }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${PURPLE_BORD}` }}>
                  {["Ray-ID", "IP", "ASN", "Path", "Event", "Time"].map(h => (
                    <th key={h} style={{
                      color:       MUTED,
                      padding:     "0.3rem 0.6rem",
                      textAlign:   "left",
                      fontWeight:  600,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.beacon.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom:    `1px solid rgba(120,60,255,0.15)`,
                      background:      i % 2 === 0 ? "transparent" : "rgba(98,0,234,0.06)",
                    }}
                  >
                    <td style={{ padding: "0.3rem 0.6rem", color: GOLD, whiteSpace: "nowrap" }}>
                      {row.ray_id?.slice(0, 12) ?? "—"}…
                    </td>
                    <td style={{ padding: "0.3rem 0.6rem", color: MUTED }}>
                      {row.ip_address ?? "—"}
                    </td>
                    <td style={{ padding: "0.3rem 0.6rem", color: WHITE }}>
                      {row.asn ?? "—"}
                    </td>
                    <td style={{ padding: "0.3rem 0.6rem", color: GREEN, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.path ?? "—"}
                    </td>
                    <td style={{ padding: "0.3rem 0.6rem" }}>
                      {badge(row.event_type ?? "—", RED)}
                    </td>
                    <td style={{ padding: "0.3rem 0.6rem", color: MUTED, whiteSpace: "nowrap", fontSize: "0.73rem" }}>
                      {row.anchored_at
                        ? new Date(row.anchored_at).toLocaleTimeString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: MUTED, fontFamily: MONO, fontSize: "0.83rem", margin: 0 }}>
            {loading ? "⏳ Loading beacon…" : "No beacon entries yet."}
          </p>
        )}
        <div style={{ marginTop: "0.75rem" }}>
          <Link
            href="/audit-stream"
            style={{ color: GOLD, fontSize: "0.8rem", fontFamily: MONO, textDecoration: "none" }}
          >
            → Full Audit Stream
          </Link>
          {" · "}
          <Link
            href="/admin/forensics"
            style={{ color: BLUE, fontSize: "0.8rem", fontFamily: MONO, textDecoration: "none" }}
          >
            → Forensic Dashboard
          </Link>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div style={{
        ...card(GOLD_BG, GOLD_BORD),
        marginTop: "0.5rem",
      }}>
        <h3 style={{ color: GOLD, margin: "0 0 0.75rem", fontFamily: MONO, fontSize: "0.95rem" }}>
          🔗 Quick Links
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {[
            { href: "/admin",               label: "🛡️ Admin Hub"           },
            { href: "/sovereign-anchor",    label: "⛓️⚓⛓️ Anchor Status"  },
            { href: "/admin/health-status", label: "💚 Health Status"        },
            { href: "/admin/valuation",     label: "💹 IVI Valuation"        },
            { href: "/admin/settlements",   label: "⚖️ Settlements"          },
            { href: "/admin/monetization",  label: "💰 Stripe Revenue"       },
            { href: "/licensing",           label: "📜 Licensing Portal"     },
            { href: "/.well-known/did.json",label: "🪪 DID Document"         },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                padding:      "0.35rem 0.9rem",
                borderRadius: 8,
                background:   GOLD_BG,
                border:       `1px solid ${GOLD_BORD}`,
                color:        GOLD,
                fontSize:     "0.8rem",
                fontFamily:   MONO,
                textDecoration: "none",
                whiteSpace:   "nowrap",
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Kernel anchor footer ── */}
      <div style={{
        marginTop:  "2rem",
        padding:    "1rem 1.5rem",
        background: "rgba(212,175,55,0.04)",
        border:     `1px solid ${GOLD_BORD}`,
        borderRadius: 10,
        fontFamily: MONO,
        fontSize:   "0.73rem",
        color:      GOLD_DIM,
      }}>
        <span>⛓️⚓⛓️ &nbsp;</span>
        <strong>KERNEL SHA-512:</strong>{" "}
        <span style={{ wordBreak: "break-all" }}>
          {KERNEL_SHA.slice(0, 32)}…{KERNEL_SHA.slice(-16)}
        </span>
        <span style={{ marginLeft: "1.5rem" }}>
          <strong>VERSION:</strong> {KERNEL_VERSION}
        </span>
        <span style={{ marginLeft: "1.5rem" }}>
          <strong>CREATOR:</strong> Jason Lee Avery (ROOT0) 🤛🏻
        </span>
      </div>
    </main>
  );
}
