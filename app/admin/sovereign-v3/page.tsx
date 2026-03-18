"use client";

/**
 * app/admin/sovereign-v3/page.tsx
 *
 * AveryOS™ Sovereign Admin Dashboard V3 — Phase 117.4 GATE 117.4.3
 *
 * Private dashboard for Jason Lee Avery (ROOT0 / Creator).
 *
 * Displays the Physicality Status (PHYSICAL vs LATENT) for all core
 * AveryOS system modules:
 *
 *   PHYSICAL — module is anchored to a hardware or network event (Stripe,
 *              Cloudflare, Node-02 hrtime) and has passed RTV + Cert Pinning.
 *   LATENT   — module is operating without a physical certificate or Ray-ID
 *              anchor; cannot authenticate as Sovereign Truth until activated.
 *
 * Auth: Bearer / HttpOnly cookie `aos-vault-auth` validated by /api/v1/vault/auth.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_VERSION, KERNEL_SHA } from "../../../lib/sovereignConstants";
import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK_BG    = "#060010";
const GOLD       = "#ffd700";
const GREEN      = "#4ade80";
const ORANGE     = "#f97316";
const MUTED      = "rgba(180,200,255,0.65)";
const WHITE      = "#ffffff";
const PURPLE_LOW = "rgba(98,0,234,0.12)";
const BORDER     = "rgba(120,148,255,0.18)";

// ── Module descriptor ─────────────────────────────────────────────────────────

type PhysicalityStatus = "PHYSICAL" | "LATENT" | "CHECKING";

interface ModuleStatus {
  id:          string;
  name:        string;
  description: string;
  status:      PhysicalityStatus;
  anchor:      string | null;
  lastChecked: string | null;
  notes:       string;
}

// ── Health response types ─────────────────────────────────────────────────────

interface HealthPayload {
  status?:      string;
  d1?:          string;
  kv?:          string;
  vaultChain?:  string;
  stripe?:      string;
  cloudflare?:  string;
  timeMesh?:    string;
  clock?:       string;
  handshake?:   string;
  kernel_sha?:  string;
  ts?:          string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(s: PhysicalityStatus) {
  const colors: Record<PhysicalityStatus, string> = {
    PHYSICAL: GREEN,
    LATENT:   ORANGE,
    CHECKING: MUTED,
  };
  const icons: Record<PhysicalityStatus, string> = {
    PHYSICAL: "✔",
    LATENT:   "◌",
    CHECKING: "⏳",
  };
  // Safe: `s` is typed as PhysicalityStatus ("PHYSICAL"|"LATENT"|"CHECKING") — keys are a closed, type-checked union.
  // eslint-disable-next-line security/detect-object-injection
  return { color: colors[s], icon: icons[s] };
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Default module registry ───────────────────────────────────────────────────

function buildDefaultModules(): ModuleStatus[] {
  return [
    {
      id:          "stripe",
      name:        "Stripe™ Billing Rail",
      description: "Live Stripe API connection — TARI™ invoicing and checkout sessions.",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "Requires STRIPE_SECRET_KEY. RTV + Cert Pinning via api.stripe.com.",
    },
    {
      id:          "cloudflare",
      name:        "Cloudflare™ Edge Runtime",
      description: "D1, KV, R2, and Cloudflare Worker bindings.",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "Binding presence confirms PHYSICAL status. Edge Worker = Physical Anchor.",
    },
    {
      id:          "d1",
      name:        "D1 Sovereign Ledger",
      description: "Cloudflare D1 database — sovereign_audit_logs, vaultchain_ledger, etc.",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "A successful D1 SELECT confirms PHYSICAL status.",
    },
    {
      id:          "kv",
      name:        "KV State Store",
      description: "Cloudflare KV — session state, rate-limit counters, sovereign telemetry.",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "A successful KV GET confirms PHYSICAL status.",
    },
    {
      id:          "timeMesh",
      name:        "AveryOS™ Time Mesh (NTP 12/100)",
      description: "NTP Swarm consensus — Active-12 polled every 30m, Audit-100 every 12h.",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "Outlier pruning threshold: 50µs. Clock source must be hardware-pulsed.",
    },
    {
      id:          "hardwareClock",
      name:        "Hardware Clock (Node-02)",
      description: "process.hrtime.bigint() — Physical Delta bypass of platform Date.now().",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "PHYSICAL = hrtime available. LATENT = performance.now() fallback.",
    },
    {
      id:          "vaultChain",
      name:        "VaultChain™ Ledger",
      description: "SHA-512 block chain persisted to D1 + R2. Every handshake is logged here.",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "Requires D1 vaultchain_ledger table and R2 VAULT binding.",
    },
    {
      id:          "handshake",
      name:        "Universal Handshake (RTV v3)",
      description: "Round-Trip Verification + Cert Pinning for Stripe, Cloudflare, Node-02.",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "PHYSICAL when last RTV passed with 2xx/3xx. LATENT when no recent verify.",
    },
    {
      id:          "gabrielos",
      name:        "GabrielOS™ Watchdog",
      description: "HALT_BOOT detection, Tier-9 Audit Alerts, Auto-Heal bubble loop.",
      status:      "CHECKING",
      anchor:      null,
      lastChecked: null,
      notes:       "PHYSICAL when watchdog pulse is healthy (no HALT_BOOT in this cycle).",
    },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SovereignDashboardV3() {
  const { authed, checking: authChecking, password, setPassword, authError, handleAuth } = useVaultAuth();
  const [modules,     setModules]    = useState<ModuleStatus[]>(buildDefaultModules);
  const [loading,     setLoading]    = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [error,       setError]      = useState<AosUiError | null>(null);

  // ── Fetch physicality status from health API ────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/v1/health", { credentials: "include" });
      const json = await res.json() as HealthPayload;
      const ts   = nowIso();

      setModules((prev) =>
        prev.map((m) => {
          let status: PhysicalityStatus;
          let anchor: string | null;

          switch (m.id) {
            case "stripe":
              status = json.stripe === "ok" ? "PHYSICAL" : "LATENT";
              anchor = json.stripe === "ok" ? "api.stripe.com" : null;
              break;
            case "cloudflare":
              status = res.ok ? "PHYSICAL" : "LATENT";
              anchor = res.ok ? "Cloudflare Worker" : null;
              break;
            case "d1":
              status = json.d1 === "ok" ? "PHYSICAL" : "LATENT";
              anchor = json.d1 === "ok" ? "D1:averyos_kernel_db" : null;
              break;
            case "kv":
              status = json.kv === "ok" ? "PHYSICAL" : "LATENT";
              anchor = json.kv === "ok" ? "KV:KV_LOGS" : null;
              break;
            case "timeMesh":
              status = json.timeMesh === "ok" ? "PHYSICAL" : "LATENT";
              anchor = json.timeMesh === "ok" ? "NTP-12/100" : null;
              break;
            case "hardwareClock":
              status = json.clock === "PHYSICAL" ? "PHYSICAL" : "LATENT";
              anchor = json.clock === "PHYSICAL" ? "process.hrtime.bigint()" : "Date.now()";
              break;
            case "vaultChain":
              status = json.vaultChain === "ok" ? "PHYSICAL" : "LATENT";
              anchor = json.vaultChain === "ok" ? "VaultChain:D1+R2" : null;
              break;
            case "handshake":
              status = json.handshake === "ok" ? "PHYSICAL" : "LATENT";
              anchor = json.handshake === "ok" ? "RTV-v3:PHYSICAL" : null;
              break;
            case "gabrielos":
              // Watchdog is PHYSICAL if the health endpoint itself responded
              status = res.ok ? "PHYSICAL" : "LATENT";
              anchor = res.ok ? "GabrielOS:pulse-ok" : null;
              break;
            default:
              status = "LATENT";
              anchor = null;
          }

          return { ...m, status, anchor, lastChecked: ts };
        }),
      );
      setLastRefresh(ts);
    } catch (_err) {
      setError(buildAosUiError(AOS_ERROR.DB_UNAVAILABLE, "Health status fetch failed."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh on auth
  useEffect(() => {
    if (authed) fetchStatus();
  }, [authed, fetchStatus]);

  // ── Auth gate ───────────────────────────────────────────────────────────────

  if (authChecking) {
    return (
      <main style={{ background: DARK_BG, minHeight: "100vh", color: WHITE, padding: "2rem" }}>
        <AnchorBanner />
        <p style={{ color: MUTED, marginTop: "2rem" }}>⏳ Verifying vault credentials…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main style={{ background: DARK_BG, minHeight: "100vh", color: WHITE, padding: "2rem" }}>
        <AnchorBanner />
        <div style={{
          maxWidth: 420,
          margin: "4rem auto",
          padding: "2rem",
          background: PURPLE_LOW,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
        }}>
          <h1 style={{ color: GOLD, fontSize: "1.2rem", marginBottom: "1.5rem" }}>
            🔐 Sovereign Admin V3 — Creator Auth Required
          </h1>
          {authError && (
            <p style={{ color: ORANGE, fontSize: "0.85rem", marginBottom: "1rem" }}>
              ⚠️ {authError}
            </p>
          )}
          <input
            type="password"
            placeholder="Vault passphrase"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAuth(); }}
            style={{
              width: "100%",
              padding: "0.6rem 0.8rem",
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: WHITE,
              fontSize: "0.9rem",
              marginBottom: "1rem",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => handleAuth()}
            style={{
              width: "100%",
              padding: "0.65rem",
              background: "rgba(98,0,234,0.7)",
              border: "none",
              borderRadius: 6,
              color: WHITE,
              fontSize: "0.95rem",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Unlock Dashboard
          </button>
        </div>
      </main>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  const physicalCount = modules.filter((m) => m.status === "PHYSICAL").length;
  const latentCount   = modules.filter((m) => m.status === "LATENT").length;

  return (
    <main style={{ background: DARK_BG, minHeight: "100vh", color: WHITE, padding: "1.5rem" }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: "1rem" }}>
        <h1 style={{ color: GOLD, fontSize: "1.4rem", marginBottom: "0.25rem" }}>
          ⛓️⚓⛓️ Sovereign Admin Dashboard V3
        </h1>
        <p style={{ color: MUTED, fontSize: "0.8rem", marginBottom: "1.5rem" }}>
          Kernel {KERNEL_VERSION} · {KERNEL_SHA.slice(0, 20)}…{KERNEL_SHA.slice(-8)} · cf83..∅™
        </p>

        {error && <SovereignErrorBanner error={error} />}

        {/* Summary stats */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {[
            { label: "PHYSICAL Modules",  value: physicalCount, color: GREEN  },
            { label: "LATENT Modules",    value: latentCount,   color: ORANGE },
            { label: "Total Modules",     value: modules.length, color: GOLD  },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: "1 1 140px",
                padding: "0.75rem 1rem",
                background: "rgba(9,16,34,0.8)",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
              }}
            >
              <div style={{ color: s.color, fontSize: "1.6rem", fontWeight: "bold" }}>
                {s.value}
              </div>
              <div style={{ color: MUTED, fontSize: "0.75rem" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Refresh button */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.5rem" }}>
          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              padding: "0.5rem 1.25rem",
              background: loading ? "rgba(98,0,234,0.3)" : "rgba(98,0,234,0.7)",
              border: "none",
              borderRadius: 6,
              color: WHITE,
              fontSize: "0.85rem",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "⏳ Refreshing…" : "🔄 Refresh Status"}
          </button>
          {lastRefresh && (
            <span style={{ color: MUTED, fontSize: "0.75rem" }}>
              Last refreshed: {lastRefresh.replace("T", " ").slice(0, 23)}Z
            </span>
          )}
        </div>

        {/* Module grid */}
        <section>
          <h2 style={{ color: GOLD, fontSize: "1rem", marginBottom: "0.75rem" }}>
            🏛️ Module Physicality Matrix
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {modules.map((m) => {
              const badge = statusBadge(m.status);
              return (
                <div
                  key={m.id}
                  style={{
                    padding: "0.75rem 1rem",
                    background: "rgba(9,16,34,0.75)",
                    border: `1px solid ${m.status === "PHYSICAL" ? "rgba(74,222,128,0.25)" : m.status === "LATENT" ? "rgba(249,115,22,0.25)" : BORDER}`,
                    borderRadius: 8,
                    display: "grid",
                    gridTemplateColumns: "140px 1fr auto",
                    gap: "0 1rem",
                    alignItems: "center",
                  }}
                >
                  {/* Status badge */}
                  <span
                    style={{
                      color: badge.color,
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {badge.icon} {m.status}
                  </span>

                  {/* Module info */}
                  <div>
                    <div style={{ color: WHITE, fontSize: "0.9rem", fontWeight: 500 }}>
                      {m.name}
                    </div>
                    <div style={{ color: MUTED, fontSize: "0.75rem" }}>{m.description}</div>
                    {m.anchor && (
                      <div style={{ color: badge.color, fontSize: "0.7rem", marginTop: "0.2rem" }}>
                        Anchor: {m.anchor}
                      </div>
                    )}
                  </div>

                  {/* Last checked */}
                  <div style={{ color: MUTED, fontSize: "0.7rem", textAlign: "right" }}>
                    {m.lastChecked
                      ? m.lastChecked.replace("T", " ").slice(0, 19) + "Z"
                      : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Constitution anchor */}
        <footer style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: `1px solid ${BORDER}` }}>
          <p style={{ color: MUTED, fontSize: "0.72rem" }}>
            AveryOS™ Sovereign Admin V3 · Phase 117.4 GATE 117.4.3 ·{" "}
            Universal Handshake Enforcement v1.0 · cf83..∅™ Root0 Kernel ·{" "}
            Constitution v1.17 · CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
          </p>
        </footer>
      </div>
    </main>
  );
}
