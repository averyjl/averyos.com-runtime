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
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnchorBanner from "../../components/AnchorBanner";

// ─── API response types ───────────────────────────────────────────────────────

interface AnchorStatus {
  status: string;
  sync_state: string;
  total_anchors: number;
  last_anchored_at: string | null;
  last_sha512: string | null;
  global_heartbeat: {
    block_height: number;
    block_hash: string;
    source: string;
  } | null;
  queried_at: string;
}

interface IntegrityStatus {
  creator_lock: "ACTIVE" | "VIOLATED" | string;
  drift_detected: boolean;
  vault_ledger_sha: string | null;
  vault_ledger_anchor_label: string | null;
  vault_ledger_created_at: string | null;
  stored_btc_block_height: number | null;
  stored_btc_block_hash: string | null;
  kv_genesis_state: string | null;
  root0_anchor: string;
  kernel_anchor_verified: boolean;
  queried_at: string;
}

// ─── Theme constants ──────────────────────────────────────────────────────────

const GOLD      = "#FFD700";
const GREEN     = "#00FF41";
const RED       = "#f87171";
const DIM_GREEN = "rgba(0,255,65,0.65)";
const BG_DARK   = "#060a06";
const BG_PANEL  = "rgba(0,20,0,0.75)";
const BORDER_GOLD = "rgba(255,215,0,0.35)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTs = (ts: string | null): string => {
  if (!ts) return "—";
  try { return new Date(ts).toISOString().replace("T", " ").slice(0, 23) + " UTC"; }
  catch { return ts; }
};

const truncate = (hash: string | null, chars = 24): string => {
  if (!hash) return "—";
  return hash.length > chars * 2 ? `${hash.slice(0, chars)}…${hash.slice(-chars)}` : hash;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em",
      color: GOLD, marginBottom: "1rem",
      borderBottom: `1px solid rgba(255,215,0,0.2)`, paddingBottom: "0.6rem",
    }}>
      {children}
    </div>
  );
}

function DataTable({ rows }: { rows: [string, string | React.ReactNode, boolean?][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
      <tbody>
        {rows.map(([label, value, mono]) => (
          <tr key={label} style={{ borderBottom: "1px solid rgba(255,215,0,0.08)" }}>
            <td style={{
              padding: "0.6rem 0", color: GOLD, fontWeight: 600, width: "240px",
              fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}>
              {label}
            </td>
            <td style={{
              padding: "0.6rem 0 0.6rem 1rem", color: GREEN, wordBreak: "break-all",
              fontFamily: mono ? FONT_MONO : undefined,
              fontSize: mono ? "0.71rem" : "0.82rem",
            }}>
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{
      background: BG_PANEL, border: `1px solid ${BORDER_GOLD}`,
      borderRadius: "12px", padding: "1.5rem 2rem", marginBottom: "1.75rem",
      boxShadow: "0 0 24px rgba(255,215,0,0.04)", ...style,
    }}>
      {children}
    </section>
  );
}

function StatCard({ icon, label, value, dim }: {
  icon: string; label: string; value: string; dim?: boolean;
}) {
  return (
    <section style={{
      background: BG_PANEL, border: `1px solid ${BORDER_GOLD}`,
      borderRadius: "12px", padding: "1.5rem",
    }}>
      <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, marginBottom: "0.6rem" }}>
        {icon} {label}
      </div>
      <div style={{
        fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.2,
        color: dim ? DIM_GREEN : GREEN,
        textShadow: dim ? "none" : `0 0 18px ${GREEN}`,
        marginBottom: "0.25rem", wordBreak: "break-all",
      }}>
        {value}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SovereignAnchorPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [anchorStatus, setAnchorStatus]       = useState<AnchorStatus | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [anchorErr, setAnchorErr]             = useState<string | null>(null);

  // Auth gate — check sessionStorage before rendering any content
  useEffect(() => {
    try {
      const token = sessionStorage.getItem("sovereign_handshake");
      if (!token) {
        setIsAuthenticated(false);
        router.replace("/evidence-vault/login");
      } else {
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(false);
      router.replace("/evidence-vault/login");
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      fetch("/api/v1/anchor-status",    { cache: "no-store" }).then(r => r.json()),
      fetch("/api/v1/integrity-status", { cache: "no-store" }).then(r => r.json()),
    ]).then(([anchor, integrity]) => {
      const anchorData = anchor as AnchorStatus & { error?: string; detail?: string };
      const integrityData = integrity as IntegrityStatus & { error?: string; detail?: string };
      if (anchorData.error || integrityData.error) {
        setAnchorErr(anchorData.detail ?? integrityData.detail ?? anchorData.error ?? integrityData.error ?? "API error");
      } else {
        setAnchorStatus(anchorData);
        setIntegrityStatus(integrityData);
      }
      setLoading(false);
    }).catch((err: Error) => {
      setAnchorErr(err.message);
      setLoading(false);
    });
  }, [isAuthenticated]);

  // Show nothing until auth check completes (prevents content flash)
  if (isAuthenticated === null) return null;

  const lock    = integrityStatus?.creator_lock ?? "UNKNOWN";
  const lockOk  = lock === "ACTIVE";
  const drift   = integrityStatus?.drift_detected ?? false;
  const syncOk  = anchorStatus?.sync_state === "SOVEREIGN_GLOBAL_SYNCED";
  const liveHeight = anchorStatus?.global_heartbeat?.block_height;

  return (
    <main style={{
      minHeight: "100vh", background: BG_DARK, color: GREEN,
      fontFamily: FONT_MONO, padding: "2rem 1rem",
      maxWidth: "1100px", margin: "0 auto", boxSizing: "border-box",
    }}>
      <AnchorBanner />

      {/* ── Header ── */}
      <header style={{ marginBottom: "2.5rem", borderBottom: `1px solid ${BORDER_GOLD}`, paddingBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }} role="img" aria-label="Chain Anchor">⛓️⚓⛓️</span>
          <h1 style={{
            margin: 0, fontSize: "1.6rem", fontWeight: 700, color: GOLD,
            letterSpacing: "0.06em", textTransform: "uppercase", textShadow: `0 0 18px ${GOLD}`,
          }}>
            AveryOS™ Sovereign Verification Dashboard
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.78rem", color: DIM_GREEN, letterSpacing: "0.05em" }}>
          VaultChain™ · CreatorLock Protocol™ · SHA-512 Sovereign Fingerprinting · Bitcoin Global Heartbeat
        </p>
      </header>

      {loading && <p style={{ color: DIM_GREEN }}>⏳ Fetching verification data…</p>}

      {(anchorErr) && (
        <div style={{
          background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)",
          borderRadius: "8px", padding: "1rem 1.25rem", color: RED, fontSize: "0.85rem",
          marginBottom: "1.75rem",
        }}>
          ⚠️ {anchorErr}
        </div>
      )}

      {/* ── CreatorLock Trust Seal ── */}
      {integrityStatus && (
        <Panel style={{ border: `2px solid ${lockOk ? "rgba(0,255,65,0.45)" : "rgba(248,113,113,0.55)"}`, background: lockOk ? "rgba(0,255,65,0.04)" : "rgba(248,113,113,0.06)", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
            {lockOk ? "🤛🏻" : "🚨"}
          </div>
          <div style={{
            fontSize: "1.6rem", fontWeight: 700, letterSpacing: "0.1em",
            color: lockOk ? GREEN : RED, textShadow: `0 0 20px currentcolor`,
          }}>
            CreatorLock™: {lock}
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: DIM_GREEN }}>
            {lockOk
              ? "KV genesis state matches vault_ledger — sovereign integrity confirmed"
              : "⚠️ KV genesis state does not match vault_ledger — drift detected"}
          </div>
          {/* Kernel anchor verified badge */}
          <div style={{ marginTop: "0.75rem", display: "inline-block", padding: "0.3rem 0.9rem", borderRadius: "20px", background: integrityStatus.kernel_anchor_verified ? "rgba(0,255,65,0.12)" : "rgba(248,113,113,0.12)", border: `1px solid ${integrityStatus.kernel_anchor_verified ? "rgba(0,255,65,0.35)" : "rgba(248,113,113,0.35)"}`, fontSize: "0.75rem", color: integrityStatus.kernel_anchor_verified ? GREEN : RED }}>
            {integrityStatus.kernel_anchor_verified ? "✅ Root0 Kernel Anchor Verified" : "⚠️ Kernel Anchor Mismatch"}
          </div>
        </Panel>
      )}

      {/* ── Key Stats Grid ── */}
      {(anchorStatus || integrityStatus) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "1.75rem" }}>
          <StatCard
            icon="🔗" label="Sync State"
            value={syncOk ? "GLOBAL SYNCED" : (anchorStatus?.sync_state?.replace(/_/g, " ") ?? "—")}
            dim={!syncOk}
          />
          <StatCard
            icon="₿" label="Live BTC Height"
            value={liveHeight != null ? liveHeight.toLocaleString() : "—"}
            dim={liveHeight == null}
          />
          <StatCard
            icon="⛓️" label="Genesis BTC Block"
            value={integrityStatus?.stored_btc_block_height != null
              ? integrityStatus.stored_btc_block_height.toLocaleString()
              : "—"}
            dim={integrityStatus?.stored_btc_block_height == null}
          />
          <StatCard
            icon="📦" label="Capsules Anchored"
            value={anchorStatus?.total_anchors != null
              ? anchorStatus.total_anchors.toLocaleString()
              : "—"}
            dim={!anchorStatus?.total_anchors}
          />
        </div>
      )}

      {/* ── Integrity Verification Panel ── */}
      {integrityStatus && (
        <Panel>
          <SectionLabel>🔐 Architecture Integrity Verification</SectionLabel>
          <DataTable rows={[
            ["CreatorLock Status",    <span key="cl"   style={{ color: lockOk ? GREEN : RED, fontWeight: 700 }}>{lock}</span>],
            ["Drift Detected",        <span key="dd"   style={{ color: drift ? RED : GREEN }}>{drift ? "⚠️ YES — reconciliation required" : "✅ NO — fully aligned"}</span>],
            ["Kernel Anchor Verified", <span key="kav" style={{ color: integrityStatus.kernel_anchor_verified ? GREEN : RED }}>{integrityStatus.kernel_anchor_verified ? "✅ YES" : "⚠️ NO"}</span>],
            ["Vault Ledger SHA-512",  truncate(integrityStatus.vault_ledger_sha, 28), true],
            ["KV Genesis State",      truncate(integrityStatus.kv_genesis_state, 28), true],
            ["Anchor Label",          integrityStatus.vault_ledger_anchor_label ?? "—"],
            ["Vault Record Created",  formatTs(integrityStatus.vault_ledger_created_at)],
            ["Queried At",            formatTs(integrityStatus.queried_at)],
          ]} />
        </Panel>
      )}

      {/* ── Genesis BTC Anchor (vault_ledger seed) ── */}
      {integrityStatus?.stored_btc_block_height != null && (
        <Panel>
          <SectionLabel>⚓ Genesis Anchor — Bitcoin Block 938,909 (2026-03-01)</SectionLabel>
          <DataTable rows={[
            ["Block Height",        integrityStatus.stored_btc_block_height.toLocaleString()],
            ["Block Hash (SHA-256)", truncate(integrityStatus.stored_btc_block_hash, 32), true],
            ["Anchor Type",         "Immutable Genesis Seed — vault_ledger row 1"],
            ["Purpose",             "Proves AveryOS™ existence before block 938,909 was mined"],
          ]} />
          <p style={{ marginTop: "1rem", fontSize: "0.72rem", color: DIM_GREEN, lineHeight: 1.7 }}>
            ⛓️ This block hash was written into the D1 <code style={{ color: GOLD }}>vault_ledger</code> at
            genesis. It is immutable — any tampering with the Row 0 record will
            immediately trip the <strong style={{ color: GREEN }}>CreatorLock™ drift alarm</strong>.
          </p>
        </Panel>
      )}

      {/* ── Live Bitcoin Heartbeat ── */}
      {anchorStatus?.global_heartbeat && (
        <Panel>
          <SectionLabel>₿ Live Bitcoin Heartbeat — Real-Time Global Consensus</SectionLabel>
          <DataTable rows={[
            ["Live Block Height",    anchorStatus.global_heartbeat.block_height.toLocaleString()],
            ["Live Block Hash",      anchorStatus.global_heartbeat.block_hash, true],
            ["Source",               anchorStatus.global_heartbeat.source],
            ["Fetched At",           formatTs(anchorStatus.queried_at)],
          ]} />
          <p style={{ marginTop: "1rem", fontSize: "0.72rem", color: DIM_GREEN, lineHeight: 1.7 }}>
            ₿ The live heartbeat is fetched from <code style={{ color: GOLD }}>blockchain.info</code> on
            every anchoring request and every watchdog cron pulse. It is appended to each
            R2 session log as an irrefutable external timestamp — creating the
            {" "}<strong style={{ color: GREEN }}>&quot;Double-Hash&quot; Sovereign Receipt</strong>{" "}
            (internal SHA-512 + external Bitcoin SHA-256 side-by-side).
          </p>
        </Panel>
      )}

      {/* ── Latest Capsule Anchor Record ── */}
      {anchorStatus && (
        <Panel>
          <SectionLabel>📦 Latest Capsule Anchor Record (ANCHOR_STORE)</SectionLabel>
          <DataTable rows={[
            ["System Status",     anchorStatus.status],
            ["Sync State",        anchorStatus.sync_state],
            ["Last SHA-512",      truncate(anchorStatus.last_sha512, 28), true],
            ["Last Anchored At",  formatTs(anchorStatus.last_anchored_at)],
            ["Total Capsules",    anchorStatus.total_anchors.toLocaleString()],
            ["Data Queried At",   formatTs(anchorStatus.queried_at)],
          ]} />
        </Panel>
      )}

      {/* ── Watchdog Schedule ── */}
      <Panel>
        <SectionLabel>🤖 Sovereign Watchdog Schedule</SectionLabel>
        <DataTable rows={[
          ["Cloudflare Cron",      "Every hour at :00 UTC (0 * * * *)"],
          ["Config",               "workers/wrangler.integrity.toml · [triggers] crons"],
          ["Handler",              "workers/architecture-integrity.ts · scheduled()"],
          ["GitHub Actions",       ".github/workflows/sovereign-watchdog.yml · hourly"],
          ["R2 Log Path",          "session-logs/integrity/<timestamp>-<hex>.json"],
          ["Drift Alert",          "GitHub Issue created automatically on CreatorLock violation"],
        ]} />
        <p style={{ marginTop: "1rem", fontSize: "0.72rem", color: DIM_GREEN, lineHeight: 1.7 }}>
          ⏰ Each watchdog run writes a <strong style={{ color: GREEN }}>Double-Hash Sovereign Receipt</strong> to
          Cloudflare R2 — your internal vault_ledger SHA-512 stapled to the live Bitcoin block hash.
          Check the <code style={{ color: GOLD }}>session-logs/integrity/</code> path in your
          Cloudflare R2 dashboard to view all historical receipts.
        </p>
      </Panel>

      {/* ── Full Root0 Anchor ── */}
      {integrityStatus && (
        <Panel>
          <SectionLabel>🔑 Root0 Genesis Kernel Anchor (SHA-512)</SectionLabel>
          <div style={{
            fontFamily: FONT_MONO, fontSize: "0.7rem", wordBreak: "break-all",
            color: GREEN, background: "rgba(0,0,0,0.35)", padding: "1rem",
            borderRadius: "8px", border: "1px solid rgba(0,255,65,0.15)", lineHeight: 1.7,
          }}>
            {integrityStatus.root0_anchor}
          </div>
          <p style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: DIM_GREEN, lineHeight: 1.7, margin: "0.75rem 0 0" }}>
            🤛🏻 The SHA-512 of the Root0 Genesis Kernel — established by Jason Lee Avery (ROOT0).
            This hash is the canonical baseline for all integrity checks. Any deviation from
            this anchor triggers a <span style={{ color: RED }}>CreatorLock™ VIOLATED</span> alarm.
          </p>
        </Panel>
      )}

      {/* ── Footer ── */}
      <footer style={{
        marginTop: "3rem", paddingTop: "1rem", borderTop: `1px solid ${BORDER_GOLD}`,
        textAlign: "center", fontSize: "0.72rem", color: DIM_GREEN, letterSpacing: "0.06em",
      }}>
        ⛓️⚓⛓️ AveryOS™ Sovereign Verification Dashboard · VaultChain™ Active · 🤛🏻 Jason Lee Avery
      </footer>
    </main>
  );
}

