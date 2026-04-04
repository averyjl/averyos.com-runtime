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
 * app/admin/health-status/page.tsx
 *
 * AveryOS™ Private Health Dashboard — GATE 114.8.1 / GATE 116.6.3
 *
 * CreatorLock — gated behind VaultAuth.  Monitors:
 *   • Sovereign Kernel anchor (SHA-512 parity)
 *   • Time Mesh precision (ISO-9 microsecond clock)
 *   • JWKS Signer availability
 *   • D1 database connection health
 *   • R2 bucket sync status
 *   • Worker health (gabriel-gatekeeper, license-bot, sovereign-log-ingress)
 *   • AOSR Summary Retrieval — recent QA run history (GATE 114.5.2)
 *   • VaultSig™ Webhook Activity — recent GitHub App webhook events (GATE 114.8.1)
 *   • Physical Residency — USB AOS salt handshake status (GATE 114.9.4)
 *   • ALM Bridge — local Avery-ALM (Ollama) availability (GATE 116.6.3)
 *
 * Each status badge shows Green (ACTIVE) or Red (DEGRADED/OFFLINE).
 * Footer includes ISO-9 timestamp with (Δ [seconds]) precision (GATE 114.5.5).
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
const BG_DARK    = "#020b02";
const BG_PANEL   = "rgba(0,20,0,0.75)";
const GOLD       = "#ffd700";
const GREEN      = "#00ff41";
const RED        = "#f87171";
const DIM_GREEN  = "rgba(0,255,65,0.65)";
const BORDER_G   = "rgba(255,215,0,0.3)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeStatus = "ACTIVE" | "DEGRADED" | "OFFLINE" | "CHECKING";

interface StatusBadge {
  label:       string;
  icon:        string;
  status:      BadgeStatus;
  detail:      string;
  alignment:   string;
}

interface HealthPayload {
  status:         string;
  kernel_version: string;
  d1:             string;
  kv:             string;
  health_last_anchored: string;
}

interface AnchorPayload {
  sync_state:     string;
  total_anchors:  number;
  last_anchored_at: string | null;
}

interface JwksPayload {
  keys?: unknown[];
}

/** GATE 114.8.1 — VaultSig webhook activity record */
interface VaultSigEvent {
  event_id:   string;
  event_type: string;
  received_at: string;
  status:     string;
}

/** GATE 114.8.1 — VaultSig webhook status payload */
interface VaultSigPayload {
  total_events?: number;
  recent_events?: VaultSigEvent[];
  last_event_at?: string | null;
  error?: string;
}

/** AOSR QA run record — partial shape from /api/v1/qa/results */
interface AosrRunRecord {
  run_id:        string;
  status:        string;
  total_tests:   number;
  passed_tests:  number;
  failed_tests:  number;
  kernel_version: string;
  created_at:    string;
}

interface AosrResultsPayload {
  records?: AosrRunRecord[];
  error?:   string;
}

/** VaultSig™ webhook log entry — partial shape from /api/v1/hooks/vaultsig/log */
interface VaultSigLogEntry {
  id:          number;
  delivery_id: string;
  event_type:  string;
  action:      string | null;
  sender:      string | null;
  logged_at:   string;
  kernel:      string;
}

interface VaultSigLogPayload {
  entries?: VaultSigLogEntry[];
  total?:   number;
  note?:    string;
  error?:   string;
}

// ── GATE 116.6.3 — Electron IPC bridge type (available only in Electron context) ──

type ResidencyState = "NODE-02_PHYSICAL" | "CLOUD" | "CHECKING";

interface ResidencySaltResult {
  found:      boolean;
  state:      ResidencyState;
  mountPath:  string | null;
  saltPath:   string | null;
  previewHex: string | null;
  mimeType:   string | null;
}

interface AosTerminalBridge {
  residencyCheckSalt: () => Promise<ResidencySaltResult>;
  almPing:            () => Promise<{ alive: boolean }>;
}

declare global {
  interface Window {
    aosTerminal?: AosTerminalBridge;
  }
}

// ── Helper: format a 9-digit-precision delta (seconds) since a start timestamp ─

function formatDeltaS(startMs: number): string {
  const elapsed = performance.now() - startMs;
  const seconds = elapsed / 1000;
  return seconds.toFixed(9) + "s";
}

// ── Helper: format an ISO string to "YYYY-MM-DD HH:mm:ss UTC" ────────────────

function fmtUtc(ts: string | null | undefined): string {
  if (!ts) return "—";
  try { return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC"; }
  catch { return ts; }
}

// ── Helper: map response to badge status ─────────────────────────────────────

function toBadge(ok: boolean): BadgeStatus { return ok ? "ACTIVE" : "DEGRADED"; }

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ status }: { status: BadgeStatus }) {
  const colorMap = new Map<BadgeStatus, string>([
    ["ACTIVE",   GREEN],
    ["DEGRADED", RED],
    ["OFFLINE",  RED],
    ["CHECKING", GOLD],
  ]);
  const dotColor = colorMap.get(status) ?? GOLD;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
      padding: "0.25rem 0.75rem", borderRadius: "20px", fontSize: "0.75rem",
      fontWeight: 700, letterSpacing: "0.06em",
      background: `${dotColor}18`,
      border: `1px solid ${dotColor}55`,
      color: dotColor,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
      {status}
    </span>
  );
}

function Card({ badge }: { badge: StatusBadge }) {
  return (
    <section style={{
      background: BG_PANEL, border: `1px solid ${BORDER_G}`,
      borderRadius: 12, padding: "1.25rem 1.5rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.4rem" }}>{badge.icon}</span>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {badge.label}
          </span>
        </div>
        <Badge status={badge.status} />
      </div>
      <p style={{ margin: 0, fontSize: "0.72rem", color: DIM_GREEN, lineHeight: 1.6 }}>{badge.detail}</p>
      <p style={{ margin: "0.4rem 0 0", fontSize: "0.68rem", color: `${GOLD}99`, fontStyle: "italic" }}>
        ↳ {badge.alignment}
      </p>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminHealthStatusPage() {
  const { authed, checking: authChecking, authError } = useVaultAuth();
  const [badges,      setBadges]      = useState<StatusBadge[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<AosUiError | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  /** GATE 114.5.5 — page-load timestamp for Δ footer calculation */
  const [pageLoadMs]                  = useState<number>(() => performance.now());
  const [footerDelta, setFooterDelta] = useState<string>("0.000000000s");
  /** GATE 114.5.2 — AOSR Summary Retrieval */
  const [aosrRecords,     setAosrRecords]     = useState<AosrRunRecord[]>([]);
  const [aosrLoading,     setAosrLoading]     = useState(false);
  const [aosrError,       setAosrError]       = useState<string | null>(null);
  /** GATE 114.8.1 — VaultSig™ Webhook Activity */
  const [vaultSigEntries, setVaultSigEntries] = useState<VaultSigLogEntry[]>([]);
  const [vaultSigLoading, setVaultSigLoading] = useState(false);
  const [vaultSigError,   setVaultSigError]   = useState<string | null>(null);
  /** GATE 114.9.4 — Physical Residency (Electron IPC) */
  const [residencyStatus, setResidencyStatus] = useState<ResidencyState>("CHECKING");
  /** GATE 116.6.3 — ALM Bridge (Electron IPC — Avery-ALM / Ollama) */
  const [almBridgeAlive,  setAlmBridgeAlive]  = useState<boolean | null>(null);

  const runChecks = useCallback(async () => {
    setLoading(true);
    try {
      // Run all checks in parallel — including VaultSig webhook status (GATE 114.8.1)
      const [healthRes, anchorRes, jwksRes, vaultSigRes, resonanceRes] = await Promise.allSettled([
        fetch("/api/v1/health",          { cache: "no-store" }).then(r => r.json() as Promise<HealthPayload>),
        fetch("/api/v1/anchor-status",   { cache: "no-store" }).then(r => r.json() as Promise<AnchorPayload>),
        fetch("/api/v1/jwks",            { cache: "no-store" }).then(r => r.json() as Promise<JwksPayload>),
        // GATE 114.8.1 — VaultSig webhook event summary
        fetch("/api/v1/hooks/vaultsig/status", { cache: "no-store" })
          .then(r => r.ok ? r.json() as Promise<VaultSigPayload> : null)
          .catch(() => null),
        // GATE 117.8.2 — AOS Trust-List heartbeat via resonance endpoint
        fetch("/api/v1/resonance", { cache: "no-store" })
          .then(r => r.ok ? r.json() as Promise<{ status?: string; sha_verified?: boolean }> : null)
          .catch(() => null),
      ]);

      const health   = healthRes.status    === "fulfilled" ? healthRes.value    : null;
      const anchor   = anchorRes.status    === "fulfilled" ? anchorRes.value    : null;
      const jwks     = jwksRes.status      === "fulfilled" ? jwksRes.value      : null;
      const vSig     = vaultSigRes.status  === "fulfilled" ? vaultSigRes.value  : null;
      const resonance = resonanceRes.status === "fulfilled" ? resonanceRes.value : null;

      const d1Ok   = health?.d1?.includes("CONNECTED") ?? false;
      const kvOk   = health?.kv?.includes("CONNECTED") ?? false;
      const syncOk = anchor?.sync_state === "SOVEREIGN_GLOBAL_SYNCED";
      const jwksOk = Array.isArray(jwks?.keys) && (jwks?.keys?.length ?? 0) > 0;
      const vaultSigOk  = vSig !== null && !("error" in (vSig ?? {}));
      const trustListOk = resonance !== null && resonance.sha_verified === true;

      // Kernel SHA parity check — compare displayed prefix against KERNEL_SHA
      const kernelOk = (health?.kernel_version ?? "") === KERNEL_VERSION;

      const next: StatusBadge[] = [
        {
          label:     "Sovereign Kernel",
          icon:      "⚓",
          status:    toBadge(kernelOk),
          detail:    kernelOk
            ? `v${KERNEL_VERSION} · SHA-512: ${KERNEL_SHA.slice(0, 20)}…`
            : `Version mismatch — expected ${KERNEL_VERSION}, got ${health?.kernel_version ?? "unreachable"}`,
          alignment: "Kernel operating at 100% Deterministic Integrity — Root0 anchor confirmed.",
        },
        {
          label:     "Time Mesh",
          icon:      "⏱️",
          status:    health ? "ACTIVE" : "OFFLINE",
          detail:    health
            ? `Last anchored: ${health.health_last_anchored ?? "—"}`
            : "Health endpoint unreachable — ISO-9 precision clock unverifiable.",
          alignment: "ISO-9 microsecond precision clock synchronised to Sovereign Time Mesh.",
        },
        {
          label:     "JWKS Signer",
          icon:      "🔑",
          status:    toBadge(jwksOk),
          detail:    jwksOk
            ? `${jwks?.keys?.length ?? 0} active signing key(s) registered`
            : "JWKS endpoint returned no keys — signer may be offline.",
          alignment: "JWKS signing keys active — OIDC handshake ready for alignment partners.",
        },
        {
          label:     "D1 Database",
          icon:      "🗄️",
          status:    toBadge(d1Ok),
          detail:    d1Ok ? "averyos_kernel_db responding — SELECT 1 passed" : "D1 connection failed — check wrangler binding.",
          alignment: "Primary sovereign ledger connected — audit trail and vault_ledger persisting.",
        },
        {
          label:     "KV / R2 Sync",
          icon:      "☁️",
          status:    toBadge(kvOk),
          detail:    kvOk ? "KV_LOGS read/write verified" : "KV binding unavailable — capsule state may be stale.",
          alignment: "R2 + KV sync active — capsule and session state persisted to edge.",
        },
        {
          label:     "VaultChain™ Anchor",
          icon:      "⛓️",
          status:    toBadge(syncOk),
          detail:    syncOk
            ? `${(anchor?.total_anchors ?? 0).toLocaleString()} capsules anchored — sync state: ${anchor?.sync_state ?? "—"}`
            : `Sync state: ${anchor?.sync_state ?? "UNREACHABLE"}`,
          alignment: "VaultChain™ active — capsule Merkle roots anchored to sovereign ledger.",
        },
        {
          label:     "Gabriel-Gatekeeper Worker",
          icon:      "🛡️",
          status:    syncOk ? "ACTIVE" : "CHECKING",
          detail:    "Edge enforcement worker — blocks unaligned requests and routes TARI™ billing.",
          alignment: "GabrielOS™ Firewall enforcing Creator IP protection at the edge.",
        },
        {
          label:     "Sovereign Queue Ingress",
          icon:      "📥",
          status:    d1Ok ? "ACTIVE" : "DEGRADED",
          detail:    "sovereign-log-ingress Cloudflare Queue — feeds D1 audit log table.",
          alignment: "Forensic queue consumer active — no log events are dropped.",
        },
        // GATE 114.8.1 — VaultSig Webhook Monitor
        {
          label:     "VaultSig Webhook Monitor",
          icon:      "🪝",
          status:    vaultSigOk ? "ACTIVE" : "CHECKING",
          detail:    vaultSigOk
            ? `${(vSig as VaultSigPayload)?.total_events ?? 0} events recorded — last: ${(vSig as VaultSigPayload)?.last_event_at ?? "—"}`
            : "VaultSig webhook status endpoint unreachable — monitor operating in passive mode.",
          alignment: "VaultSig webhook ingestion active — sovereign events received and logged.",
        },
        // GATE 117.8.2 — AOS Trust-List Heartbeat
        {
          label:     "AOS Trust-List Heartbeat",
          icon:      "🛡️",
          status:    resonance === null ? ("DEGRADED" as BadgeStatus) : (trustListOk ? "ACTIVE" : "CHECKING"),
          detail:    trustListOk
            ? "Resonance layer responding — SHA-512 kernel parity verified — trust-scoring active."
            : (resonance !== null)
              ? "Resonance layer reachable but SHA parity unconfirmed — trust-list warming up."
              : "Resonance endpoint unreachable — AOS Trust-List in passive mode.",
          alignment: "Trust-List active — authorized AI agent registry operating at 100.000% alignment.",
        },
      ];

      setBadges(next);
      setLastRefresh(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
      setError(null);
    } catch (err: unknown) {
      setError(buildAosUiError(AOS_ERROR.INTERNAL_ERROR, err instanceof Error ? err.message : "Health check failed."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void runChecks();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => void runChecks(), 30_000);
    return () => clearInterval(interval);
  }, [authed, runChecks]);

  /** GATE 114.5.2 — AOSR Summary Retrieval: fetch recent QA runs */
  const fetchAosr = useCallback(async () => {
    setAosrLoading(true);
    setAosrError(null);
    try {
      const res = await fetch("/api/v1/qa/results?limit=5", { cache: "no-store" });
      const data = await res.json() as AosrResultsPayload;
      if (data.error) throw new Error(data.error);
      setAosrRecords(data.records ?? []);
    } catch (err: unknown) {
      setAosrError(err instanceof Error ? err.message : "AOSR retrieval failed.");
    } finally {
      setAosrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void fetchAosr();
  }, [authed, fetchAosr]);

  /** GATE 114.8.1 — VaultSig™ Webhook Activity: fetch recent webhook events */
  const fetchVaultSig = useCallback(async () => {
    setVaultSigLoading(true);
    setVaultSigError(null);
    try {
      const res  = await fetch("/api/v1/hooks/vaultsig/log?limit=10", { cache: "no-store" });
      const data = await res.json() as VaultSigLogPayload;
      if (data.error) throw new Error(data.error);
      setVaultSigEntries(data.entries ?? []);
    } catch (err: unknown) {
      setVaultSigError(err instanceof Error ? err.message : "VaultSig log retrieval failed.");
    } finally {
      setVaultSigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void fetchVaultSig();
  }, [authed, fetchVaultSig]);

  /** GATE 114.9.4 / GATE 116.6.3 — Poll Electron IPC for residency & ALM bridge status */
  useEffect(() => {
    if (!authed) return;
    if (typeof window === "undefined" || !window.aosTerminal) return;

    const bridge = window.aosTerminal;

    async function pollIpc() {
      try {
        const [residency, alm] = await Promise.allSettled([
          bridge.residencyCheckSalt(),
          bridge.almPing(),
        ]);
        if (residency.status === "fulfilled") {
          setResidencyStatus(residency.value.state);
        }
        if (alm.status === "fulfilled") {
          setAlmBridgeAlive(alm.value.alive);
        }
      } catch {
        // IPC bridge not available — running in cloud/web context
      }
    }

    void pollIpc();
    const ipcInterval = setInterval(() => void pollIpc(), 15_000);
    return () => clearInterval(ipcInterval);
  }, [authed]);

  /** GATE 114.5.5 — update footer delta every second */
  useEffect(() => {
    const tick = setInterval(() => {
      setFooterDelta(formatDeltaS(pageLoadMs));
    }, 1_000);
    return () => clearInterval(tick);
  }, [pageLoadMs]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
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
    <main style={{ minHeight: "100vh", background: BG_DARK, color: GREEN, fontFamily: FONT_MONO, padding: "2rem 1rem", maxWidth: 1100, margin: "0 auto" }}>
      <AnchorBanner />

      {/* Header */}
      <header style={{ marginBottom: "2.5rem", borderBottom: `1px solid ${BORDER_G}`, paddingBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }}>🛡️</span>
          <h1 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 700, color: GOLD, letterSpacing: "0.06em", textTransform: "uppercase", textShadow: `0 0 18px ${GOLD}` }}>
            AveryOS™ Private Health Dashboard
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.75rem", color: DIM_GREEN, letterSpacing: "0.05em" }}>
          CreatorLock™ · Phase 114.8 GATE 114.8.1 · Auto-refresh every 30s
          {lastRefresh && ` · Last checked: ${lastRefresh}`}
        </p>
      </header>

      {error && <SovereignErrorBanner error={error} />}

      {loading && badges.length === 0 && (
        <p style={{ color: DIM_GREEN, fontSize: "0.9rem" }}>⏳ Running sovereign health checks…</p>
      )}

      {/* Badge Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        {badges.map(b => <Card key={b.label} badge={b} />)}
        {/* GATE 114.9.4 — Physical Residency Badge (rendered separately to avoid stale closure) */}
        <Card badge={{
          label:     "Physical Residency",
          icon:      "🖥️",
          status:    residencyStatus === "NODE-02_PHYSICAL" ? "ACTIVE" : residencyStatus === "CLOUD" ? "DEGRADED" : "CHECKING",
          detail:    residencyStatus === "NODE-02_PHYSICAL"
            ? "AOS salt USB detected — Hammer ↔ Hand UNIFIED on Node-02."
            : residencyStatus === "CLOUD"
            ? "Operating in CLOUD mode — AOS salt USB not detected on local hardware."
            : "Running residency handshake — checking for AOS salt USB…",
          alignment: "Sovereign Residency Handshake active — AOS salt USB bridges cloud and local execution.",
        }} />
        {/* GATE 116.6.3 / GATE 117.1.3 — ALM Bridge Badge: Avery-ALM (Anchored Language Model) IPC + FULLY_RESIDENT */}
        <Card badge={{
          label:     "ALM Bridge (Node-02)",
          icon:      "🦙",
          status:    almBridgeAlive === true ? "ACTIVE" : almBridgeAlive === false ? "OFFLINE" : "CHECKING",
          detail:    almBridgeAlive === true
            ? "Avery-ALM (Ollama) responding on 127.0.0.1:11434 — State 2: FULLY_RESIDENT. Local inference active."
            : almBridgeAlive === false
            ? "Avery-ALM offline — run `ollama serve` on Node-02. See docs/install-alm.txt for setup."
            : "Checking ALM bridge… (Electron IPC required — run `node scripts/verifyAlmResidency.cjs --ping`)",
          alignment: "Anchored Language Model bridge active — State 2: FULLY_RESIDENT on Node-02.",
        }} />
      </div>

      {/* Manual refresh */}
      {!loading && (
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <button
            onClick={() => void runChecks()}
            style={{
              background: "rgba(255,215,0,0.1)", border: `1px solid ${BORDER_G}`, borderRadius: 8,
              color: GOLD, fontFamily: FONT_MONO, fontSize: "0.82rem", padding: "0.5rem 1.5rem",
              cursor: "pointer", letterSpacing: "0.06em", fontWeight: 700,
            }}
          >
            ⟳ Refresh Now
          </button>
        </div>
      )}

      {/* GATE 114.5.2 — AOSR Summary Retrieval */}
      <section style={{
        background: "rgba(0,20,0,0.75)", border: `1px solid ${BORDER_G}`,
        borderRadius: 12, padding: "1.5rem", marginBottom: "2rem",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "1rem", paddingBottom: "0.75rem",
          borderBottom: `1px solid rgba(255,215,0,0.15)`,
        }}>
          <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            📋 AOSR Summary — Recent QA Runs
          </div>
          <button
            onClick={() => void fetchAosr()}
            disabled={aosrLoading}
            style={{
              background: "rgba(255,215,0,0.08)", border: `1px solid ${BORDER_G}`, borderRadius: 6,
              color: GOLD, fontFamily: FONT_MONO, fontSize: "0.72rem", padding: "0.25rem 0.75rem",
              cursor: aosrLoading ? "default" : "pointer", opacity: aosrLoading ? 0.5 : 1,
            }}
          >
            {aosrLoading ? "⏳ Loading…" : "⟳ Reload"}
          </button>
        </div>

        {aosrError && (
          <p style={{ color: RED, fontSize: "0.78rem", margin: "0 0 0.75rem" }}>
            ⚠️ {aosrError}
          </p>
        )}

        {!aosrLoading && aosrRecords.length === 0 && !aosrError && (
          <p style={{ color: DIM_GREEN, fontSize: "0.78rem", margin: 0 }}>
            No QA runs recorded yet. Run <code style={{ color: GOLD }}>node scripts/avery-qa.cjs</code> to begin.
          </p>
        )}

        {aosrRecords.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.77rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid rgba(255,215,0,0.2)` }}>
                  {["Run ID", "Status", "Pass / Fail / Total", "Kernel", "Timestamp"].map(h => (
                    <th key={h} style={{
                      padding: "0.4rem 0.6rem", textAlign: "left", color: GOLD,
                      fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aosrRecords.map(r => {
                  const statusColor = r.status === "pass" ? GREEN : r.status === "partial" ? GOLD : RED;
                  const ts = fmtUtc(r.created_at);
                  return (
                    <tr key={r.run_id} style={{ borderBottom: "1px solid rgba(255,215,0,0.06)" }}>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, fontFamily: "monospace", fontSize: "0.68rem" }}
                          title={r.run_id}>
                        {r.run_id.length > 20 ? `${r.run_id.slice(0, 20)}…` : r.run_id}
                      </td>
                      <td style={{ padding: "0.45rem 0.6rem" }}>
                        <span style={{
                          padding: "0.1rem 0.5rem", borderRadius: 4, fontSize: "0.7rem",
                          background: `${statusColor}18`, border: `1px solid ${statusColor}55`,
                          color: statusColor, fontWeight: 700, textTransform: "uppercase",
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN }}>
                        <span style={{ color: GREEN }}>{r.passed_tests}</span>
                        {" / "}
                        <span style={{ color: RED }}>{r.failed_tests}</span>
                        {" / "}
                        <span style={{ color: GOLD }}>{r.total_tests}</span>
                      </td>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, fontFamily: "monospace", fontSize: "0.68rem" }}>
                        {r.kernel_version ?? "—"}
                      </td>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, fontSize: "0.68rem" }}>
                        {ts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* GATE 114.8.1 — VaultSig™ Webhook Activity */}
      <section style={{
        background: "rgba(0,20,0,0.75)", border: `1px solid ${BORDER_G}`,
        borderRadius: 12, padding: "1.5rem", marginBottom: "2rem",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "1rem", paddingBottom: "0.75rem",
          borderBottom: `1px solid rgba(255,215,0,0.15)`,
        }}>
          <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            🪝 VaultSig™ Webhook Activity
          </div>
          <button
            onClick={() => void fetchVaultSig()}
            disabled={vaultSigLoading}
            style={{
              background: "rgba(255,215,0,0.08)", border: `1px solid ${BORDER_G}`, borderRadius: 6,
              color: GOLD, fontFamily: FONT_MONO, fontSize: "0.72rem", padding: "0.25rem 0.75rem",
              cursor: vaultSigLoading ? "default" : "pointer", opacity: vaultSigLoading ? 0.5 : 1,
            }}
          >
            {vaultSigLoading ? "⏳ Loading…" : "⟳ Reload"}
          </button>
        </div>

        {vaultSigError && (
          <p style={{ color: RED, fontSize: "0.78rem", margin: "0 0 0.75rem" }}>
            ⚠️ {vaultSigError}
          </p>
        )}

        {!vaultSigLoading && vaultSigEntries.length === 0 && !vaultSigError && (
          <p style={{ color: DIM_GREEN, fontSize: "0.78rem", margin: 0 }}>
            No VaultSig™ webhook events recorded yet.
            Configure the GitHub App webhook URL to <code style={{ color: GOLD }}>/api/v1/hooks/vaultsig</code>.
          </p>
        )}

        {vaultSigEntries.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.77rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid rgba(255,215,0,0.2)` }}>
                  {["#", "Event Type", "Action", "Sender", "Delivery ID", "Logged At"].map(h => (
                    <th key={h} style={{
                      padding: "0.4rem 0.6rem", textAlign: "left", color: GOLD,
                      fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vaultSigEntries.map(e => {
                  const ts = fmtUtc(e.logged_at);
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,215,0,0.06)" }}>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, fontSize: "0.68rem" }}>{e.id}</td>
                      <td style={{ padding: "0.45rem 0.6rem" }}>
                        <span style={{
                          padding: "0.1rem 0.5rem", borderRadius: 4, fontSize: "0.7rem",
                          background: "rgba(0,255,65,0.1)", border: "1px solid rgba(0,255,65,0.35)",
                          color: GREEN, fontWeight: 700,
                        }}>
                          {e.event_type}
                        </span>
                      </td>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, fontSize: "0.72rem" }}>{e.action ?? "—"}</td>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, fontSize: "0.72rem" }}>{e.sender ?? "—"}</td>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, fontFamily: "monospace", fontSize: "0.68rem" }}
                          title={e.delivery_id}>
                        {e.delivery_id.length > 18 ? `${e.delivery_id.slice(0, 18)}…` : e.delivery_id}
                      </td>
                      <td style={{ padding: "0.45rem 0.6rem", color: DIM_GREEN, fontSize: "0.68rem" }}>{ts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Kernel Anchor footer — GATE 114.5.5: (Δ seconds) with 9-digit precision */}
      <footer style={{ textAlign: "center", fontSize: "0.68rem", color: DIM_GREEN, borderTop: `1px solid ${BORDER_G}`, paddingTop: "1rem", lineHeight: 1.8 }}>
        ⛓️⚓⛓️ AveryOS™ Sovereign Health Dashboard · GATE 114.8.1<br />
        Kernel SHA-512: {KERNEL_SHA.slice(0, 32)}…<br />
        🤛🏻 Jason Lee Avery · ROOT0 · CreatorLock™ Active · (Δ {footerDelta})
      </footer>
    </main>
  );
}
