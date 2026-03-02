"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnchorBanner from "../../components/AnchorBanner";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  stored_btc_block_height: number | null;
  kv_genesis_state: string | null;
  kernel_anchor_verified: boolean;
  queried_at: string;
}

interface SovereignBuild {
  id: number;
  repo_name: string;
  commit_sha: string;
  artifact_hash: string;
  sealed: boolean;
  btc_anchor_height: number | null;
  registered_at: string;
  sealed_at: string | null;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const GOLD       = "#FFD700";
const GREEN      = "#00FF41";
const RED        = "#f87171";
const DIM_GREEN  = "rgba(0,255,65,0.65)";
const BG_DARK    = "#060a06";
const BG_PANEL   = "rgba(0,20,0,0.75)";
const BORDER_GOLD = "rgba(255,215,0,0.35)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtTs = (ts: string | null): string => {
  if (!ts) return "—";
  try { return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC"; }
  catch { return ts; }
};

const truncate = (hash: string | null, chars = 16): string => {
  if (!hash) return "—";
  return hash.length > chars * 2 ? `${hash.slice(0, chars)}…${hash.slice(-chars)}` : hash;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SovereignHealthPage() {
  const [anchor, setAnchor]       = useState<AnchorStatus | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityStatus | null>(null);
  const [builds, setBuilds]       = useState<SovereignBuild[]>([]);
  const [dnsOk, setDnsOk]         = useState<boolean | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/anchor-status",    { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/integrity-status", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/sovereign-builds", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([a, i, b]) => {
        setAnchor(a as AnchorStatus);
        setIntegrity(i as IntegrityStatus);
        setBuilds((b as { builds?: SovereignBuild[] }).builds ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });

    // DNS check: try to reach anchor.averyos.com
    fetch("https://anchor.averyos.com/api/v1/anchor-status", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
      .then((r) => setDnsOk(r.ok))
      .catch(() => setDnsOk(false));
  }, []);

  const lockOk     = integrity?.creator_lock === "ACTIVE";
  const liveHeight = anchor?.global_heartbeat?.block_height;
  const syncOk     = anchor?.sync_state === "SOVEREIGN_GLOBAL_SYNCED";

  return (
    <main style={{
      minHeight: "100vh", background: BG_DARK, color: GREEN,
      fontFamily: FONT_MONO, padding: "2rem 1rem",
      maxWidth: "1200px", margin: "0 auto", boxSizing: "border-box",
    }}>
      <AnchorBanner />

      {/* ── Header ── */}
      <header style={{
        marginBottom: "2.5rem",
        borderBottom: `1px solid ${BORDER_GOLD}`,
        paddingBottom: "1.25rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }} role="img" aria-label="Shield">🛡️</span>
          <h1 style={{
            margin: 0, fontSize: "1.6rem", fontWeight: 700, color: GOLD,
            letterSpacing: "0.06em", textTransform: "uppercase",
            textShadow: `0 0 18px ${GOLD}`,
          }}>
            AveryOS™ Sovereign Health Dashboard
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.78rem", color: DIM_GREEN, letterSpacing: "0.05em" }}>
          VaultChain™ · CreatorLock™ · Build Provenance Active · ⛓️⚓⛓️
        </p>
      </header>

      {loading && (
        <p style={{ color: DIM_GREEN, fontSize: "0.9rem" }}>⏳ Fetching sovereign health data…</p>
      )}

      {error && (
        <div style={{
          background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)",
          borderRadius: "8px", padding: "1rem 1.25rem", color: RED,
          fontSize: "0.85rem", marginBottom: "1.75rem",
        }}>
          ⚠️ HEALTH_STATUS_ERROR: {error}
        </div>
      )}

      {/* ── CreatorLock Trust Seal ── */}
      {integrity && (
        <Panel style={{
          border: `2px solid ${lockOk ? "rgba(0,255,65,0.45)" : "rgba(248,113,113,0.55)"}`,
          background: lockOk ? "rgba(0,255,65,0.04)" : "rgba(248,113,113,0.06)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
            {lockOk ? "🤛🏻" : "🚨"}
          </div>
          <div style={{
            fontSize: "1.6rem", fontWeight: 700, letterSpacing: "0.1em",
            color: lockOk ? GREEN : RED, textShadow: "0 0 20px currentcolor",
          }}>
            CreatorLock™: {integrity.creator_lock}
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: DIM_GREEN }}>
            {lockOk
              ? "KV genesis state matches vault_ledger — sovereign integrity confirmed"
              : "⚠️ KV genesis state mismatch — drift detected"}
          </div>
        </Panel>
      )}

      {/* ── Key Stats Grid ── */}
      {(anchor || integrity) && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem", marginBottom: "1.75rem",
        }}>
          {[
            {
              icon: "🔗", label: "Sync State",
              value: syncOk ? "GLOBAL SYNCED" : (anchor?.sync_state?.replace(/_/g, " ") ?? "—"),
              ok: syncOk,
            },
            {
              icon: "₿", label: "Live BTC Height",
              value: liveHeight != null ? liveHeight.toLocaleString() : "—",
              ok: liveHeight != null,
            },
            {
              icon: "⚓", label: "Genesis BTC Block",
              value: (integrity?.stored_btc_block_height ?? 938909).toLocaleString(),
              ok: true,
            },
            {
              icon: "📦", label: "Capsules Anchored",
              value: anchor?.total_anchors != null ? anchor.total_anchors.toLocaleString() : "—",
              ok: (anchor?.total_anchors ?? 0) > 0,
            },
          ].map(({ icon, label, value, ok }) => (
            <section key={label} style={{
              background: BG_PANEL, border: `1px solid ${BORDER_GOLD}`,
              borderRadius: "12px", padding: "1.5rem",
            }}>
              <div style={{
                fontSize: "0.68rem", textTransform: "uppercase",
                letterSpacing: "0.12em", color: GOLD, marginBottom: "0.6rem",
              }}>
                {icon} {label}
              </div>
              <div style={{
                fontSize: "1.4rem", fontWeight: 700, lineHeight: 1.2,
                color: ok ? GREEN : DIM_GREEN,
                textShadow: ok ? `0 0 14px ${GREEN}` : "none",
                wordBreak: "break-all",
              }}>
                {value}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Live Feed: Latest Anchored Builds ── */}
      <Panel>
        <SectionLabel>⛓️ Live Feed · Latest Sovereign Builds (VaultChain™ Supply Chain)</SectionLabel>
        {builds.length === 0 ? (
          <div style={{ color: DIM_GREEN, fontSize: "0.82rem" }}>
            No builds registered yet. Add{" "}
            <code style={{ color: GOLD }}>.github/workflows/sovereign-provenance.yml</code>
            {" "}to your repositories to start recording builds.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid rgba(255,215,0,0.3)` }}>
                  {["Repository", "Commit", "Artifact Hash", "BTC Block", "Sealed", "Registered"].map((h) => (
                    <th key={h} style={{
                      padding: "0.5rem 0.75rem", textAlign: "left",
                      color: GOLD, fontWeight: 700, fontSize: "0.65rem",
                      textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {builds.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid rgba(255,215,0,0.08)" }}>
                    <td style={{ padding: "0.55rem 0.75rem", color: GOLD, fontWeight: 600 }}>
                      {b.repo_name}
                    </td>
                    <td style={{ padding: "0.55rem 0.75rem", color: GREEN, fontFamily: FONT_MONO, fontSize: "0.72rem" }}>
                      {b.commit_sha.slice(0, 10)}
                    </td>
                    <td style={{ padding: "0.55rem 0.75rem", color: DIM_GREEN, fontFamily: FONT_MONO, fontSize: "0.69rem" }}>
                      {truncate(b.artifact_hash)}
                    </td>
                    <td style={{ padding: "0.55rem 0.75rem", color: DIM_GREEN }}>
                      {b.btc_anchor_height?.toLocaleString() ?? "—"}
                    </td>
                    <td style={{ padding: "0.55rem 0.75rem" }}>
                      <span style={{
                        padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem",
                        background: b.sealed ? "rgba(0,255,65,0.12)" : "rgba(255,215,0,0.08)",
                        border: `1px solid ${b.sealed ? "rgba(0,255,65,0.4)" : "rgba(255,215,0,0.3)"}`,
                        color: b.sealed ? GREEN : GOLD,
                      }}>
                        {b.sealed ? "✅ CreatorLock™" : "⏳ Pending Seal"}
                      </span>
                    </td>
                    <td style={{ padding: "0.55rem 0.75rem", color: DIM_GREEN, fontSize: "0.72rem" }}>
                      {fmtTs(b.registered_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Ollama Pulse ── */}
      <Panel>
        <SectionLabel>🧠 Ollama Pulse · Local Intelligence Bridge</SectionLabel>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}>
          <div>
            <div style={{ fontSize: "0.72rem", color: GOLD, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Last Thought Anchored
            </div>
            <div style={{ color: DIM_GREEN, fontSize: "0.85rem" }}>
              Start <code style={{ color: GOLD }}>uplink/sovereign-terminal.ts</code> locally to begin anchoring Ollama thoughts.
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", color: GOLD, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Uplink Status
            </div>
            <div style={{ color: DIM_GREEN, fontSize: "0.85rem" }}>
              🔌 Offline — Local uplink not connected
            </div>
          </div>
        </div>
        <p style={{ marginTop: "1rem", fontSize: "0.72rem", color: DIM_GREEN, lineHeight: 1.7 }}>
          ⛓️ The Sovereign Terminal bridges your local Ollama instance (port 11434) to the VaultChain™ anchor.
          Run <code style={{ color: GOLD }}>npx ts-node uplink/sovereign-terminal.ts</code> to activate.
        </p>
      </Panel>

      {/* ── System Integrity: Genesis Anchor 938,909 ── */}
      {integrity && (
        <Panel>
          <SectionLabel>⚓ System Integrity · Genesis Anchor Block 938,909</SectionLabel>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <tbody>
              {([
                ["CreatorLock™ Status", <span key="cl" style={{ color: lockOk ? GREEN : RED, fontWeight: 700 }}>{integrity.creator_lock}</span>],
                ["Kernel Anchor Verified", <span key="kav" style={{ color: integrity.kernel_anchor_verified ? GREEN : RED }}>{integrity.kernel_anchor_verified ? "✅ YES" : "⚠️ NO"}</span>],
                ["Drift Detected", <span key="dd" style={{ color: integrity.drift_detected ? RED : GREEN }}>{integrity.drift_detected ? "⚠️ YES" : "✅ NO"}</span>],
                ["Genesis BTC Block Height", (integrity.stored_btc_block_height ?? 938909).toLocaleString()],
                ["Live BTC Block Height", liveHeight?.toLocaleString() ?? "—"],
                ["KV Genesis State", truncate(integrity.kv_genesis_state, 20)],
                ["Queried At", fmtTs(integrity.queried_at)],
              ] as [string, React.ReactNode][]).map(([label, value]) => (
                <tr key={String(label)} style={{ borderBottom: "1px solid rgba(255,215,0,0.08)" }}>
                  <td style={{
                    padding: "0.6rem 0", color: GOLD, fontWeight: 600, width: "240px",
                    fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}>
                    {label}
                  </td>
                  <td style={{ padding: "0.6rem 0 0.6rem 1rem", color: GREEN, wordBreak: "break-all" }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {/* ── DNS Status ── */}
      <Panel>
        <SectionLabel>🌐 DNS · anchor.averyos.com</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{
            padding: "0.4rem 1rem", borderRadius: "20px", fontSize: "0.82rem", fontWeight: 700,
            background: dnsOk === null
              ? "rgba(255,215,0,0.08)"
              : dnsOk
                ? "rgba(0,255,65,0.12)"
                : "rgba(248,113,113,0.12)",
            border: `1px solid ${dnsOk === null
              ? "rgba(255,215,0,0.3)"
              : dnsOk ? "rgba(0,255,65,0.4)" : "rgba(248,113,113,0.4)"}`,
            color: dnsOk === null ? GOLD : dnsOk ? GREEN : RED,
          }}>
            {dnsOk === null ? "⏳ Checking…" : dnsOk ? "✅ ONLINE" : "⚠️ UNREACHABLE"}
          </div>
          <div style={{ color: DIM_GREEN, fontSize: "0.8rem" }}>
            <code style={{ color: GOLD }}>anchor.averyos.com</code> — Sovereign API subdomain
          </div>
        </div>
        <p style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: DIM_GREEN, lineHeight: 1.7 }}>
          Configure in Cloudflare Dashboard → Workers → Your Integrity Worker → Triggers → Custom Domain.
        </p>
      </Panel>

      {/* ── Footer ── */}
      <footer style={{
        marginTop: "3rem", paddingTop: "1rem",
        borderTop: `1px solid ${BORDER_GOLD}`,
        textAlign: "center", fontSize: "0.72rem",
        color: DIM_GREEN, letterSpacing: "0.06em",
      }}>
        ⛓️⚓⛓️ AveryOS™ Sovereign Health Dashboard · VaultChain™ Active · 🤛🏻 Jason Lee Avery
      </footer>
    </main>
  );
}
