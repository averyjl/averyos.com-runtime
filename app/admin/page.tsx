"use client";

/**
 * AveryOS™ Sovereign Admin Dashboard
 *
 * Central admin hub gated behind VAULTAUTH_TOKEN verification.
 * Provides quick-access links to all admin-only tools and shows a live
 * summary of enforcement, compliance, and system health.
 *
 * This page is listed in lib/navigationRoutes.ts with isAdmin:true so the
 * NavBar, Sidebar, and Drawer all automatically pick it up whenever a new
 * admin route is registered there.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import SovereignErrorBanner from "../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";
import { adminRoutes } from "../../lib/navigationRoutes";

// ── Theme ─────────────────────────────────────────────────────────────────────

const PURPLE_DEEP   = "#0a0015";
const PURPLE_MID    = "rgba(98,0,234,0.18)";
const PURPLE_BORDER = "rgba(120,60,255,0.35)";
const GOLD          = "#ffd700";
const GOLD_BORDER   = "rgba(255,215,0,0.35)";
const GOLD_GLOW     = "rgba(255,215,0,0.08)";
const WHITE         = "#ffffff";
const RED           = "#ff4444";
const GREEN         = "#4ade80";
const ORANGE        = "#f97316";

// Sovereign Amnesty Window — 7 days from declaration date (2026-03-07)
const AMNESTY_START_DATE = new Date("2026-03-07T00:00:00Z");
const AMNESTY_END_DATE   = new Date("2026-03-14T00:00:00Z");
const AMNESTY_DURATION_MS = AMNESTY_END_DATE.getTime() - AMNESTY_START_DATE.getTime();

// ── Quick-access admin panels ─────────────────────────────────────────────────

const ADMIN_PANELS = [
  {
    path:        "/audit-stream",
    icon:        "📡",
    label:       "Audit Stream",
    description: "Real-time UNALIGNED_401 feed, resonance pulse chart, & forensic export",
    color:       GOLD,
  },
  {
    path:        "/vault-gate",
    icon:        "🔑",
    label:       "Vault Gate",
    description: "Hardware YubiKey / passphrase authentication portal",
    color:       "#7c3aed",
  },
  {
    path:        "/sovereign-anchor",
    icon:        "⛓️⚓⛓️",
    label:       "Sovereign Anchor",
    description: "Kernel SHA-512 anchor status, D1 pulse log, and BTC block height",
    color:       GREEN,
  },
  {
    path:        "/tari-revenue",
    icon:        "💹",
    label:       "TARI™ Revenue",
    description: "Real-time liability vs. collected alignment fees dashboard",
    color:       "#f59e0b",
  },
  {
    path:        "/admin/forensics",
    icon:        "🔬",
    label:       "Forensic Dashboard",
    description: "Edge-request telemetry grouped by RayID, ASN, and path — spots probes & watchers",
    color:       RED,
  },
  {
    path:        "/admin/tai-accomplishments",
    icon:        "⚡",
    label:       "TAI™ Accomplishments",
    description: "Sovereign milestone registry — SHA-512 sealed capsules with auto-tracking & Phase markers",
    color:       "#D4AF37",
  },
  {
    path:        "/evidence-vault",
    icon:        "🗄️",
    label:       "Evidence Vault",
    description: "Forensic .aoscap bundles stored in R2 with SHA-512 seals",
    color:       "#06b6d4",
  },
  {
    path:        "/vaultchain-explorer",
    icon:        "🔍",
    label:       "VaultChain™ Explorer",
    description: "Verify capsule hashes on the sovereign ledger",
    color:       "#a78bfa",
  },
  {
    path:        "/sigtrace",
    icon:        "🔐",
    label:       "Signature Trace",
    description: "Trace SHA-512 pulse signatures through the VaultChain™",
    color:       "#f87171",
  },
  {
    path:        "/settlements",
    icon:        "⚖️",
    label:       "Settlements",
    description: "Manage alignment settlement agreements and TARI™ invoices",
    color:       "#34d399",
  },
];

// ── Amnesty Countdown helper ──────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return "EXPIRED";
  const totalSec = Math.floor(ms / 1000);
  const days    = Math.floor(totalSec / 86400);
  const hours   = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function AmnestyCountdown({ amnestyMs }: { amnestyMs: number }) {
  const expired    = amnestyMs <= 0;
  const pct        = expired ? 0 : Math.round((amnestyMs / AMNESTY_DURATION_MS) * 100);
  const borderCol  = expired ? RED : amnestyMs < 86_400_000 ? RED : amnestyMs < 7 * 86_400_000 ? ORANGE : GOLD;
  const timeStr    = formatCountdown(amnestyMs);

  return (
    <section
      style={{
        background:   expired ? "rgba(60,0,0,0.35)" : GOLD_GLOW,
        border:       `2px solid ${borderCol}`,
        borderRadius: "12px",
        padding:      "1.25rem",
        marginBottom: "2rem",
        fontFamily:   "JetBrains Mono, monospace",
      }}
    >
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          flexWrap:       "wrap",
          gap:            "0.5rem",
          marginBottom:   "0.75rem",
        }}
      >
        <div style={{ color: borderCol, fontWeight: 900, fontSize: "0.85rem", letterSpacing: "0.1em" }}>
          ⚖️ SOVEREIGN AMNESTY WINDOW {expired ? "— EXPIRED" : "— ACTIVE"}
        </div>
        <Link
          href="/content/amnesty-declaration"
          style={{ color: GOLD, fontSize: "0.75rem", textDecoration: "underline" }}
        >
          View Declaration →
        </Link>
      </div>

      <div
        style={{
          display:  "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap:      "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        {[
          { label: "Time Remaining",  value: timeStr,                                 color: borderCol },
          { label: "Window Closes",   value: AMNESTY_END_DATE.toLocaleDateString(),   color: "rgba(255,255,255,0.7)" },
          { label: "Individual Fee",  value: "$1,000,000",                            color: GREEN },
          { label: "Enterprise Fee",  value: "$10,000,000",                           color: GREEN },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background:   "rgba(0,0,0,0.3)",
              border:       "1px solid rgba(255,215,0,0.15)",
              borderRadius: "8px",
              padding:      "0.65rem",
            }}
          >
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.65rem", marginBottom: "0.25rem", letterSpacing: "0.07em" }}>
              {s.label.toUpperCase()}
            </div>
            <div style={{ color: s.color, fontWeight: 700, fontSize: "0.85rem" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
        <div
          style={{
            width:        `${pct}%`,
            height:       "100%",
            background:   expired ? RED : `linear-gradient(90deg, ${GOLD}, ${borderCol})`,
            transition:   "width 1s linear",
          }}
        />
      </div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", marginTop: "0.35rem", textAlign: "right" }}>
        {expired ? "Amnesty expired — full TARI™ enforcement active" : `${pct}% of window remaining`}
      </div>
    </section>
  );
}

// ── System status type ────────────────────────────────────────────────────────

interface SystemStatus {
  vaultStatus: string;
  timestamp:   string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [status, setStatus]   = useState<SystemStatus | null>(null);
  const [uiError, setUiError] = useState<AosUiError | null>(null);
  const [amnestyMs, setAmnestyMs] = useState<number>(
    Math.max(0, AMNESTY_END_DATE.getTime() - Date.now())
  );

  // ── Amnesty countdown ticker ──────────────────────────────────────────────
  useEffect(() => {
    const tick = () =>
      setAmnestyMs(Math.max(0, AMNESTY_END_DATE.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── VaultGate auth check ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const token = sessionStorage.getItem("VAULTAUTH_TOKEN");
      if (!token) { setIsAuthenticated(false); return; }

      fetch("/api/gatekeeper/handshake-check", {
        headers: { "x-vault-auth": token },
      })
        .then((r) => r.json())
        .then((data: { status?: string }) => {
          setIsAuthenticated(
            data?.status === "LOCKED" || data?.status === "AUTHENTICATED"
          );
        })
        .catch(() => setIsAuthenticated(false));
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  // ── Pull a quick system status ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    fetch("/api/v1/health")
      .then((r) => {
        if (!r.ok) throw new Error(`Health check HTTP ${r.status}`);
        const ct = r.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) throw new Error("Non-JSON health response");
        return r.json();
      })
      .then((data: { d1?: string; kv?: string; timestamp?: string }) => {
        setStatus({
          vaultStatus: data?.d1 === "ok" ? "ONLINE" : "DEGRADED",
          timestamp:   data?.timestamp ?? new Date().toISOString(),
        });
      })
      .catch((err: Error) =>
        setUiError(
          buildAosUiError(AOS_ERROR.NETWORK, `Health check failed: ${err.message}`)
        )
      );
  }, [isAuthenticated]);

  // ── Pending auth check ────────────────────────────────────────────────────
  if (isAuthenticated === null) {
    return (
      <main className="page">
        <AnchorBanner />
        <div style={{ color: GOLD, fontFamily: "JetBrains Mono, monospace", padding: "2rem" }}>
          ⏳ Verifying VaultGate credentials…
        </div>
      </main>
    );
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <main className="page">
        <AnchorBanner />

        <div
          style={{
            background:   PURPLE_DEEP,
            border:       `2px solid ${RED}`,
            borderRadius: "12px",
            padding:      "2rem",
            maxWidth:     "480px",
            margin:       "2rem auto",
            textAlign:    "center",
            fontFamily:   "JetBrains Mono, monospace",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ color: RED, marginBottom: "0.75rem" }}>Access Restricted</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Admin access requires a valid VaultGate hardware handshake.
          </p>
          <Link
            href="/vault-gate"
            style={{
              display:        "inline-block",
              background:     RED,
              color:          WHITE,
              padding:        "0.65rem 1.5rem",
              borderRadius:   "8px",
              textDecoration: "none",
              fontWeight:     700,
              fontSize:       "0.9rem",
              letterSpacing:  "0.06em",
            }}
          >
            🔑 Authenticate via Vault Gate
          </Link>
        </div>

        <FooterBadge />
      </main>
    );
  }

  // ── Authenticated admin view ──────────────────────────────────────────────
  return (
    <main className="page">
      {/* Secure page banner */}
      <div
        style={{
          background:    "repeating-linear-gradient(135deg,#1a0000 0,#1a0000 10px,#2d0000 10px,#2d0000 20px)",
          borderBottom:  "3px solid #ff3333",
          padding:       "0.5rem 1rem",
          textAlign:     "center",
          fontFamily:    "JetBrains Mono, monospace",
          fontWeight:    900,
          fontSize:      "clamp(0.7rem,1.8vw,0.9rem)",
          color:         "#ff3333",
          letterSpacing: "0.15em",
          userSelect:    "none",
        }}
      >
        🔒 SECURE · ADMIN ONLY · AveryOS™ SOVEREIGN ADMIN DASHBOARD 🔒
      </div>

      <AnchorBanner />

      {uiError && <SovereignErrorBanner error={uiError} />}

      {/* Header */}
      <section style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            color:        GOLD,
            fontFamily:   "JetBrains Mono, monospace",
            fontWeight:   900,
            fontSize:     "clamp(1.4rem,3vw,2rem)",
            marginBottom: "0.5rem",
          }}
        >
          ⛓️⚓⛓️ Sovereign Admin Dashboard
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
          AveryOS™ {KERNEL_VERSION} · Root0 Kernel Anchor Active · GabrielOS™ Firewall Online
        </p>
      </section>

      {/* System status */}
      {status && (
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap:                 "1rem",
            marginBottom:        "2rem",
          }}
        >
          {[
            { label: "Vault Status",   value: status.vaultStatus,           color: status.vaultStatus === "ONLINE" ? GREEN : RED },
            { label: "Kernel Version", value: KERNEL_VERSION,               color: GOLD },
            { label: "Kernel SHA",     value: `${KERNEL_SHA.slice(0,12)}…`, color: "rgba(180,200,255,0.9)" },
            { label: "Last Sync",      value: new Date(status.timestamp).toLocaleTimeString(), color: "rgba(255,255,255,0.7)" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background:   GOLD_GLOW,
                border:       `1px solid ${GOLD_BORDER}`,
                borderRadius: "10px",
                padding:      "1rem",
                fontFamily:   "JetBrains Mono, monospace",
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", marginBottom: "0.35rem", letterSpacing: "0.08em" }}>
                {stat.label.toUpperCase()}
              </div>
              <div style={{ color: stat.color, fontWeight: 700, fontSize: "0.95rem", wordBreak: "break-all" }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin panels grid */}
      <section style={{ marginBottom: "2rem" }}>
        <div
          style={{
            color:         GOLD,
            fontFamily:    "JetBrains Mono, monospace",
            fontWeight:    700,
            fontSize:      "0.82rem",
            letterSpacing: "0.1em",
            marginBottom:  "1rem",
          }}
        >
          🛠️ ADMIN TOOLS
        </div>
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap:                 "1rem",
          }}
        >
          {ADMIN_PANELS.map((panel) => (
            <Link
              key={panel.path}
              href={panel.path}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background:   PURPLE_MID,
                  border:       `1px solid ${PURPLE_BORDER}`,
                  borderRadius: "12px",
                  padding:      "1.25rem",
                  cursor:       "pointer",
                  height:       "100%",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{panel.icon}</div>
                <div
                  style={{
                    color:        panel.color,
                    fontFamily:   "JetBrains Mono, monospace",
                    fontWeight:   700,
                    fontSize:     "0.9rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  {panel.label}
                </div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                  {panel.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Dynamic admin routes from navigationRoutes (permanent upgrade) */}
      {adminRoutes.length > 0 && (
        <section
          style={{
            background:   PURPLE_DEEP,
            border:       `1px solid ${GOLD_BORDER}`,
            borderRadius: "12px",
            padding:      "1.25rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              color:         GOLD,
              fontFamily:    "JetBrains Mono, monospace",
              fontWeight:    700,
              fontSize:      "0.78rem",
              letterSpacing: "0.1em",
              marginBottom:  "0.75rem",
            }}
          >
            🔐 ALL SOVEREIGN ADMIN ROUTES
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {adminRoutes.map((route) => (
              <Link
                key={route.path}
                href={route.path}
                style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  gap:            "0.4rem",
                  padding:        "0.35rem 0.75rem",
                  background:     GOLD_GLOW,
                  border:         `1px solid ${GOLD_BORDER}`,
                  borderRadius:   "6px",
                  color:          GOLD,
                  fontFamily:     "JetBrains Mono, monospace",
                  fontSize:       "0.78rem",
                  textDecoration: "none",
                  fontWeight:     600,
                }}
              >
                <span>{route.icon}</span>
                <span>{route.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Amnesty Countdown */}
      <AmnestyCountdown amnestyMs={amnestyMs} />

      {/* Kernel anchor */}
      <div
        style={{
          background:   "rgba(9,16,34,0.6)",
          border:       "1px solid rgba(120,148,255,0.2)",
          borderLeft:   "3px solid rgba(120,148,255,0.6)",
          borderRadius: "0 8px 8px 0",
          padding:      "0.75rem 1rem",
          fontFamily:   "JetBrains Mono, monospace",
          fontSize:     "0.75rem",
          color:        "rgba(122,170,255,0.7)",
          lineHeight:   1.7,
          marginBottom: "1.5rem",
          wordBreak:    "break-all",
        }}
      >
        <div>⛓️⚓⛓️ AveryOS™ Sovereign Admin · {KERNEL_VERSION}</div>
        <div style={{ color: "rgba(0,255,65,0.7)", marginTop: "0.2rem" }}>
          Root0 SHA-512: {KERNEL_SHA}
        </div>
      </div>

      <FooterBadge />
    </main>
  );
}
