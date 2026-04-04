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
 * app/admin/sovereign-v3/page.tsx
 *
 * AveryOS™ Sovereign Admin Dashboard v3.0 — Phase 117.3 GATE 117.3.3
 *
 * Private, secure dashboard for Jason Lee Avery (ROOT0).
 *
 * Features:
 *   • Live Heartbeat monitor — Node-02, D1, R2, Stripe, VaultChain™
 *   • Physicality Toggle — visualise which inventions are Inert/Latent
 *     vs Live/Physical (LATENT_PENDING ↔ PHYSICAL_TRUTH)
 *   • USI Violation Feed — unverified silence incidents with penalty tally
 *   • Sovereign Module Registry — status of all AveryOS™ modules
 *
 * Auth: sha512_payload VaultGate verification (same HttpOnly cookie pattern
 *       as all other admin pages via useVaultAuth hook).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";
import {
  CORE_MANIFEST,
  getDisplayStatus,
  getRegistrySnapshot,
  type SovereignModule,
  type PhysicalityStatus,
  type RegistrySnapshot,
} from "../../../lib/registry/coreManifest";

// ── Theme ─────────────────────────────────────────────────────────────────────

const BG           = "#030008";
const GOLD         = "#D4AF37";
const GOLD_DIM     = "rgba(212,175,55,0.55)";
const GOLD_BG      = "rgba(212,175,55,0.07)";
const GOLD_BORD    = "rgba(212,175,55,0.3)";
const GREEN        = "#4ade80";
const GREEN_BG     = "rgba(74,222,128,0.07)";
const GREEN_BORD   = "rgba(74,222,128,0.3)";
const BLUE         = "#60a5fa";
const BLUE_BG      = "rgba(96,165,250,0.07)";
const BLUE_BORD    = "rgba(96,165,250,0.3)";
const PURPLE_BG    = "rgba(98,0,234,0.15)";
const PURPLE_BORD  = "rgba(120,60,255,0.35)";
const AMBER        = "#f59e0b";
const AMBER_BG     = "rgba(245,158,11,0.1)";
const AMBER_BORD   = "rgba(245,158,11,0.3)";
const RED          = "#ff4444";
const RED_BG       = "rgba(255,68,68,0.08)";
const RED_BORD     = "rgba(255,68,68,0.3)";
const WHITE        = "#ffffff";
const MUTED        = "rgba(180,200,255,0.6)";
const MONO         = "JetBrains Mono, Courier New, monospace";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeartbeatService {
  id:          string;
  label:       string;
  icon:        string;
  status:      "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN";
  latencyMs:   number | null;
  cfRay:       string | null;
  checkedAt:   string | null;
  physicality: PhysicalityStatus;
}

interface DashboardData {
  health:    Record<string, unknown>;
  heartbeat: HeartbeatService[];
  snapshot:  RegistrySnapshot;
}

// ── Card / badge helpers ──────────────────────────────────────────────────────

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

function statusBadge(status: string): React.ReactNode {
  let color = AMBER;
  if (status === "ONLINE" || status === "PHYSICAL_TRUTH")   color = GREEN;
  if (status === "OFFLINE" || status === "LATENT_PENDING")  color = RED;
  if (status === "DEGRADED" || status === "LATENT_ARTIFACT") color = AMBER;
  if (status === "UNKNOWN") color = MUTED;
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
      {status}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive PhysicalityStatus from an HTTP probe result and cf-ray presence. */
function determinePhysicality(isOk: boolean, cfRay: string | null): PhysicalityStatus {
  if (!isOk)   return "LATENT_PENDING";
  if (!cfRay)  return "LATENT_ARTIFACT";
  return "PHYSICAL_TRUTH";
}

/**
 * Node-02 probe URL.  Only enabled when NEXT_PUBLIC_ENABLE_NODE02_PROBE="true"
 * to prevent localhost probing in production deployments.
 */
const NODE02_PROBE_URL =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_ENABLE_NODE02_PROBE === "true"
    ? "http://localhost:11434/api/tags"
    : null;


async function probeService(
  id:    string,
  label: string,
  icon:  string,
  url:   string | null,
): Promise<HeartbeatService> {
  // Null URL means the probe is disabled (e.g. Node-02 in production).
  if (url === null) {
    return {
      id, label, icon,
      status:      "OFFLINE",
      latencyMs:   null,
      cfRay:       null,
      checkedAt:   new Date().toISOString(),
      physicality: "LATENT_PENDING",
    };
  }

  const t0 = Date.now();
  let cfRay: string | null;

  try {
    const res       = await fetch(url, { credentials: "same-origin" });
    const latencyMs = Date.now() - t0;
    cfRay           = res.headers.get("cf-ray");
    const status: HeartbeatService["status"] = res.ok ? "ONLINE" : "DEGRADED";

    return {
      id, label, icon, status, latencyMs, cfRay,
      checkedAt:   new Date().toISOString(),
      physicality: determinePhysicality(res.ok, cfRay),
    };
  } catch {
    return {
      id, label, icon,
      status:    "OFFLINE",
      latencyMs: null,
      cfRay:     null,
      checkedAt: new Date().toISOString(),
      physicality: "LATENT_PENDING",
    };
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SovereignAdminDashboardV3() {
  const { authed, checking, password, setPassword, authError, handleAuth } = useVaultAuth();

  const [data,         setData]        = useState<DashboardData | null>(null);
  const [loading,      setLoading]     = useState(false);
  const [loadError,    setLoadError]   = useState<AosUiError | null>(null);
  const [refreshAt,    setRefreshAt]   = useState<string | null>(null);

  // Physicality toggle — when true show only LATENT modules, false show all
  const [latentOnly,   setLatentOnly]  = useState(false);
  const [registry,     setRegistry]    = useState<SovereignModule[]>(CORE_MANIFEST);

  // ── Data loader ───────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // 1. Health API
      const healthRes = await fetch("/api/v1/health", { credentials: "same-origin" });
      const health: Record<string, unknown> = healthRes.ok
        ? (await healthRes.json()) as Record<string, unknown>
        : {};

      // 2. Heartbeat probes
      const heartbeat = await Promise.all([
        probeService("D1",      "Cloudflare D1",    "🗄️",  "/api/v1/health"),
        probeService("R2",      "Cloudflare R2",    "🪣",  "/api/v1/health"),
        probeService("STRIPE",  "Stripe Rail",      "💳",  "/api/v1/health"),
        probeService("VAULTCHAIN", "VaultChain™",   "⛓️",  "/api/v1/health"),
        probeService("NODE02",  "Node-02 Local",    "🖥️",  NODE02_PROBE_URL),
      ]);

      // Overlay actual D1/R2 status from health response
      const d1Ok  = (health as { d1_ok?: boolean }).d1_ok;
      const r2Ok  = (health as { r2_ok?: boolean }).r2_ok;
      if (typeof d1Ok === "boolean") {
        const d1 = heartbeat.find(h => h.id === "D1");
        if (d1) { d1.status = d1Ok ? "ONLINE" : "DEGRADED"; d1.physicality = determinePhysicality(d1Ok, d1.cfRay); }
      }
      if (typeof r2Ok === "boolean") {
        const r2 = heartbeat.find(h => h.id === "R2");
        if (r2) { r2.status = r2Ok ? "ONLINE" : "DEGRADED"; r2.physicality = determinePhysicality(r2Ok, r2.cfRay); }
      }

      // 3. Module registry snapshot (in-memory)
      const snapshot = getRegistrySnapshot();

      setData({ health, heartbeat, snapshot });
      setRegistry([...CORE_MANIFEST]);
      setRefreshAt(new Date().toISOString());
    } catch (err) {
      setLoadError(buildAosUiError(
        AOS_ERROR.INTERNAL_ERROR,
        err instanceof Error ? err.message : "Dashboard data load failed.",
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
          maxWidth:     420,
          margin:       "5rem auto",
          padding:      "2rem",
          background:   PURPLE_BG,
          border:       `1px solid ${PURPLE_BORD}`,
          borderRadius: 16,
          textAlign:    "center",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⛓️⚓⛓️</div>
          <h2 style={{ color: WHITE, marginBottom: "0.5rem" }}>
            Sovereign Admin v3.0
          </h2>
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
              width:       "100%",
              padding:     "0.75rem",
              borderRadius: 8,
              border:      `1px solid ${PURPLE_BORD}`,
              background:  "rgba(0,0,0,0.45)",
              color:       WHITE,
              marginBottom: "0.75rem",
              fontFamily:  MONO,
              boxSizing:   "border-box",
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
            🔓 Unlock Sovereign Dashboard v3.0
          </button>
        </div>
      </main>
    );
  }

  // ── Authed: render dashboard ──────────────────────────────────────────────

  const displayModules = latentOnly
    ? registry.filter(m => m.physicalityStatus !== "PHYSICAL_TRUTH")
    : registry;

  const physicalCount = registry.filter(m => m.physicalityStatus === "PHYSICAL_TRUTH").length;
  const latentCount   = registry.filter(m => m.physicalityStatus !== "PHYSICAL_TRUTH").length;

  return (
    <main className="page" style={{ background: BG, minHeight: "100vh" }}>
      <AnchorBanner />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: GOLD, margin: 0, fontFamily: MONO, fontSize: "1.4rem" }}>
          ⛓️⚓⛓️ Sovereign Admin Dashboard v3.0
        </h1>
        <p style={{ color: GOLD_DIM, margin: "0.3rem 0 0", fontSize: "0.82rem", fontFamily: MONO }}>
          Phase 117.3 · Root0 · Kernel {KERNEL_VERSION} · {KERNEL_SHA.slice(0, 12)}…
        </p>
        <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => void loadAll()}
            disabled={loading}
            style={{
              padding:      "0.35rem 0.9rem",
              borderRadius: 8,
              background:   GOLD_BG,
              border:       `1px solid ${GOLD_BORD}`,
              color:        GOLD,
              cursor:       loading ? "not-allowed" : "pointer",
              fontFamily:   MONO,
              fontSize:     "0.8rem",
            }}
          >
            {loading ? "⟳ Refreshing…" : "⟳ Refresh Heartbeat"}
          </button>
          {refreshAt && (
            <span style={{ color: MUTED, fontSize: "0.78rem", fontFamily: MONO }}>
              Last sync: {new Date(refreshAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {loadError && <SovereignErrorBanner error={loadError} />}

      {/* ── Physicality Summary ─────────────────────────────────────────── */}
      <div style={card(GOLD_BG, GOLD_BORD, { display: "flex", gap: "2rem", flexWrap: "wrap", alignItems: "center" })}>
        <div>
          <div style={{ color: GOLD, fontFamily: MONO, fontSize: "0.8rem", marginBottom: "0.3rem" }}>
            PHYSICAL_TRUTH
          </div>
          <div style={{ color: GREEN, fontSize: "2rem", fontWeight: 700, fontFamily: MONO }}>
            {physicalCount}
          </div>
        </div>
        <div>
          <div style={{ color: GOLD, fontFamily: MONO, fontSize: "0.8rem", marginBottom: "0.3rem" }}>
            LATENT / PENDING
          </div>
          <div style={{ color: AMBER, fontSize: "2rem", fontWeight: 700, fontFamily: MONO }}>
            {latentCount}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          {/* Physicality Toggle */}
          <label style={{
            display:    "flex",
            alignItems: "center",
            gap:        "0.5rem",
            cursor:     "pointer",
            color:      WHITE,
            fontFamily: MONO,
            fontSize:   "0.82rem",
          }}>
            <input
              type="checkbox"
              checked={latentOnly}
              onChange={e => setLatentOnly(e.target.checked)}
              style={{ accentColor: AMBER, width: 16, height: 16 }}
            />
            Show Latent / Pending Only
          </label>
          <p style={{ color: MUTED, fontSize: "0.75rem", marginTop: "0.25rem", fontFamily: MONO }}>
            Physicality Toggle — Phase 117.3
          </p>
        </div>
      </div>

      {/* ── Heartbeat Monitor ──────────────────────────────────────────── */}
      <div style={card(BLUE_BG, BLUE_BORD)}>
        <h2 style={{ color: BLUE, fontSize: "1rem", margin: "0 0 1rem", fontFamily: MONO }}>
          🫀 Live Heartbeat Monitor
        </h2>
        {loading && !data && (
          <p style={{ color: MUTED, fontFamily: MONO, fontSize: "0.85rem" }}>
            Probing sovereign endpoints…
          </p>
        )}
        {data?.heartbeat.map(svc => (
          <div
            key={svc.id}
            style={{
              display:        "flex",
              flexWrap:       "wrap",
              alignItems:     "center",
              gap:            "0.75rem",
              padding:        "0.6rem 0",
              borderBottom:   `1px solid rgba(96,165,250,0.12)`,
            }}
          >
            <span style={{ fontSize: "1.2rem", minWidth: 24 }}>{svc.icon}</span>
            <span style={{ color: WHITE, fontFamily: MONO, fontSize: "0.88rem", minWidth: 140 }}>
              {svc.label}
            </span>
            {statusBadge(svc.status)}
            {statusBadge(svc.physicality)}
            {svc.latencyMs !== null && (
              <span style={{ color: MUTED, fontFamily: MONO, fontSize: "0.78rem" }}>
                {svc.latencyMs}ms
              </span>
            )}
            {svc.cfRay && (
              <span style={{ color: GOLD_DIM, fontFamily: MONO, fontSize: "0.75rem" }}>
                ray: {svc.cfRay}
              </span>
            )}
            {!svc.cfRay && svc.status === "ONLINE" && (
              <span style={{ color: AMBER, fontFamily: MONO, fontSize: "0.75rem" }}>
                ⚠ no cf-ray — LATENT_ARTIFACT
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Sovereign Module Registry ──────────────────────────────────── */}
      <div style={card(GREEN_BG, GREEN_BORD)}>
        <h2 style={{ color: GREEN, fontSize: "1rem", margin: "0 0 1rem", fontFamily: MONO }}>
          📋 Sovereign Module Registry
        </h2>
        <p style={{ color: MUTED, fontSize: "0.78rem", fontFamily: MONO, marginBottom: "0.75rem" }}>
          {latentOnly ? `Showing ${displayModules.length} latent/pending module(s).` : `Showing all ${displayModules.length} module(s).`}
        </p>
        {displayModules.map(mod => {
          const display = getDisplayStatus(mod);
          const statusColor =
            display === "PHYSICAL_TRUTH" ? GREEN :
            mod.physicalityStatus === "LATENT_ARTIFACT" ? AMBER : RED;
          return (
            <div
              key={mod.id}
              style={{
                background:   statusColor + "08",
                border:       `1px solid ${statusColor}30`,
                borderRadius: 10,
                padding:      "0.8rem 1rem",
                marginBottom: "0.6rem",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                <span style={{ color: WHITE, fontWeight: 700, fontFamily: MONO, fontSize: "0.9rem" }}>
                  {mod.name}
                </span>
                {statusBadge(display)}
                <span style={{
                  color:      MUTED,
                  fontFamily: MONO,
                  fontSize:   "0.72rem",
                  background: "rgba(0,0,0,0.3)",
                  padding:    "0.1rem 0.4rem",
                  borderRadius: 6,
                }}>
                  {mod.verificationPath}
                </span>
              </div>
              <p style={{ color: MUTED, fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}>
                {mod.description}
              </p>
              {mod.lastVerifiedAt && (
                <p style={{ color: GREEN, fontSize: "0.72rem", margin: "0.25rem 0 0", fontFamily: MONO }}>
                  ✓ Last verified: {mod.lastVerifiedAt}
                </p>
              )}
              {!mod.lastVerifiedAt && (
                <p style={{ color: RED, fontSize: "0.72rem", margin: "0.25rem 0 0", fontFamily: MONO }}>
                  ✗ Never verified — upgrade required
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Health Data ────────────────────────────────────────────────── */}
      {data?.health && Object.keys(data.health).length > 0 && (
        <div style={card(AMBER_BG, AMBER_BORD)}>
          <h2 style={{ color: AMBER, fontSize: "1rem", margin: "0 0 1rem", fontFamily: MONO }}>
            📡 Health API Response
          </h2>
          <pre style={{
            color:      MUTED,
            fontFamily: MONO,
            fontSize:   "0.75rem",
            overflow:   "auto",
            margin:     0,
            maxHeight:  240,
          }}>
            {JSON.stringify(data.health, null, 2)}
          </pre>
        </div>
      )}

      {/* ── Kernel Anchor ──────────────────────────────────────────────── */}
      <div style={card(RED_BG, RED_BORD)}>
        <h2 style={{ color: RED, fontSize: "1rem", margin: "0 0 0.75rem", fontFamily: MONO }}>
          🔐 Kernel Anchor
        </h2>
        <div style={{ fontFamily: MONO, fontSize: "0.75rem", color: MUTED, wordBreak: "break-all" }}>
          <span style={{ color: GOLD }}>SHA-512:</span> {KERNEL_SHA}
        </div>
        <div style={{ fontFamily: MONO, fontSize: "0.75rem", color: MUTED, marginTop: "0.35rem" }}>
          <span style={{ color: GOLD }}>Version:</span> {KERNEL_VERSION} &nbsp;|&nbsp;
          <span style={{ color: GOLD }}>Phase:</span> 117.3 &nbsp;|&nbsp;
          <span style={{ color: GREEN }}>Alignment: 100.000♾️%</span>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "2rem 0", color: MUTED, fontSize: "0.75rem", fontFamily: MONO }}>
        AveryOS™ Sovereign Admin Dashboard v3.0 · Phase 117.3 · Root0 · ⛓️⚓⛓️ 🤛🏻
      </div>
    </main>
  );
}
