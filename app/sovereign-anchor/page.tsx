"use client";

import { useEffect, useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";

interface GlobalHeartbeat {
  block_height: number;
  block_hash: string;
  source: string;
}

interface AnchorStatus {
  status: string;
  sync_state: string;
  total_anchors: number;
  last_anchored_at: string | null;
  last_sha512: string | null;
  global_heartbeat: GlobalHeartbeat | null;
  queried_at: string;
}

const GOLD = "#FFD700";
const GREEN = "#00FF41";
const DIM_GREEN = "rgba(0,255,65,0.65)";
const BORDER_GOLD = "rgba(255,215,0,0.35)";
const BG_DARK = "#060a06";
const BG_PANEL = "rgba(0,20,0,0.75)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

const formatTs = (ts: string | null): string => {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString().replace("T", " ").slice(0, 23) + " UTC";
  } catch {
    return ts;
  }
};

const truncateHash = (hash: string | null, chars = 20): string => {
  if (!hash) return "—";
  return hash.length > chars * 2
    ? `${hash.slice(0, chars)}…${hash.slice(-chars)}`
    : hash;
};

const SYNC_STATE_LABEL: Record<string, string> = {
  SOVEREIGN_GLOBAL_SYNCED: "✅ SOVEREIGN + GLOBAL SYNCED",
  SOVEREIGN_LOCAL_ONLY: "🔒 SOVEREIGN LOCAL ONLY",
  NO_ANCHORS_YET: "⏳ NO ANCHORS YET",
};

export default function SovereignAnchorPage() {
  const [status, setStatus] = useState<AnchorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/anchor-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: AnchorStatus) => {
        setStatus(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG_DARK,
        color: GREEN,
        fontFamily: FONT_MONO,
        padding: "2rem 1rem",
        maxWidth: "1100px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <AnchorBanner />

      {/* Header */}
      <header
        style={{
          marginBottom: "2.5rem",
          borderBottom: `1px solid ${BORDER_GOLD}`,
          paddingBottom: "1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.4rem",
          }}
        >
          <span style={{ fontSize: "2rem" }} role="img" aria-label="Chain">
            ⛓️⚓⛓️
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: "1.6rem",
              fontWeight: 700,
              color: GOLD,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textShadow: `0 0 18px ${GOLD}`,
            }}
          >
            AveryOS™ Sovereign Anchor Dashboard
          </h1>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "0.78rem",
            color: DIM_GREEN,
            letterSpacing: "0.05em",
          }}
        >
          VaultChain™ · CreatorLock Protocol™ Active · SHA-512 Sovereign Fingerprinting · Bitcoin Global Heartbeat
        </p>
      </header>

      {loading && (
        <p style={{ color: DIM_GREEN, fontSize: "0.9rem" }}>
          ⏳ Fetching anchor status…
        </p>
      )}

      {error && (
        <div
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.4)",
            borderRadius: "8px",
            padding: "1rem 1.25rem",
            color: "#f87171",
            fontSize: "0.85rem",
          }}
        >
          ⚠️ ANCHOR_STATUS_ERROR: {error}
        </div>
      )}

      {status && (
        <>
          {/* Sync State Banner */}
          <section
            style={{
              background: BG_PANEL,
              border: `1px solid ${BORDER_GOLD}`,
              borderRadius: "12px",
              padding: "1.5rem 2rem",
              marginBottom: "1.75rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: GOLD,
                marginBottom: "0.75rem",
              }}
            >
              🔗 Sovereign-to-Global Sync State
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color:
                  status.sync_state === "SOVEREIGN_GLOBAL_SYNCED"
                    ? GREEN
                    : status.sync_state === "SOVEREIGN_LOCAL_ONLY"
                      ? GOLD
                      : "#f87171",
                textShadow: `0 0 16px currentcolor`,
                letterSpacing: "0.05em",
              }}
            >
              {SYNC_STATE_LABEL[status.sync_state] ?? status.sync_state}
            </div>
          </section>

          {/* Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.25rem",
              marginBottom: "1.75rem",
            }}
          >
            {/* Total Anchors */}
            <section
              style={{
                background: BG_PANEL,
                border: `1px solid ${BORDER_GOLD}`,
                borderRadius: "12px",
                padding: "1.5rem",
                boxShadow: `0 0 24px rgba(255,215,0,0.06)`,
              }}
            >
              <div
                style={{
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: GOLD,
                  marginBottom: "0.6rem",
                }}
              >
                ⛓️ Total Anchors
              </div>
              <div
                style={{
                  fontSize: "2.8rem",
                  fontWeight: 700,
                  color: GREEN,
                  textShadow: `0 0 18px ${GREEN}`,
                  lineHeight: 1,
                  marginBottom: "0.4rem",
                }}
              >
                {status.total_anchors.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.72rem", color: DIM_GREEN }}>
                Capsules Anchored
              </div>
            </section>

            {/* Bitcoin Block Height */}
            <section
              style={{
                background: BG_PANEL,
                border: `1px solid ${BORDER_GOLD}`,
                borderRadius: "12px",
                padding: "1.5rem",
                boxShadow: `0 0 24px rgba(255,215,0,0.06)`,
              }}
            >
              <div
                style={{
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: GOLD,
                  marginBottom: "0.6rem",
                }}
              >
                ₿ Bitcoin Block Height
              </div>
              <div
                style={{
                  fontSize: "2.2rem",
                  fontWeight: 700,
                  color: status.global_heartbeat ? GREEN : DIM_GREEN,
                  textShadow: status.global_heartbeat ? `0 0 18px ${GREEN}` : "none",
                  lineHeight: 1,
                  marginBottom: "0.4rem",
                }}
              >
                {status.global_heartbeat
                  ? status.global_heartbeat.block_height.toLocaleString()
                  : "—"}
              </div>
              <div style={{ fontSize: "0.72rem", color: DIM_GREEN }}>
                Global Heartbeat
              </div>
            </section>

            {/* Last Anchored */}
            <section
              style={{
                background: BG_PANEL,
                border: `1px solid ${BORDER_GOLD}`,
                borderRadius: "12px",
                padding: "1.5rem",
                boxShadow: `0 0 24px rgba(255,215,0,0.06)`,
              }}
            >
              <div
                style={{
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: GOLD,
                  marginBottom: "0.6rem",
                }}
              >
                🕐 Last Anchored
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: status.last_anchored_at ? GREEN : DIM_GREEN,
                  lineHeight: 1.4,
                  marginBottom: "0.4rem",
                  wordBreak: "break-all",
                }}
              >
                {formatTs(status.last_anchored_at)}
              </div>
              <div style={{ fontSize: "0.72rem", color: DIM_GREEN }}>
                Anchor Timestamp
              </div>
            </section>
          </div>

          {/* Anchor Details Panel */}
          <section
            style={{
              background: BG_PANEL,
              border: `1px solid ${BORDER_GOLD}`,
              borderRadius: "12px",
              padding: "1.5rem 2rem",
              marginBottom: "1.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: GOLD,
                marginBottom: "1rem",
                borderBottom: `1px solid rgba(255,215,0,0.2)`,
                paddingBottom: "0.6rem",
              }}
            >
              🔐 Latest Anchor Record
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <tbody>
                {(
                  [
                    ["System Status", status.status],
                    ["Sync State", status.sync_state],
                    ["Last SHA-512", truncateHash(status.last_sha512, 28)],
                    ["Last Anchored At", formatTs(status.last_anchored_at)],
                    ["Queried At", formatTs(status.queried_at)],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <tr
                    key={label}
                    style={{ borderBottom: "1px solid rgba(255,215,0,0.08)" }}
                  >
                    <td
                      style={{
                        padding: "0.6rem 0",
                        color: GOLD,
                        fontWeight: 600,
                        width: "220px",
                        fontSize: "0.72rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </td>
                    <td
                      style={{
                        padding: "0.6rem 0 0.6rem 1rem",
                        color: GREEN,
                        wordBreak: "break-all",
                      }}
                    >
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Bitcoin Global Heartbeat Panel */}
          {status.global_heartbeat && (
            <section
              style={{
                background: BG_PANEL,
                border: `1px solid ${BORDER_GOLD}`,
                borderRadius: "12px",
                padding: "1.5rem 2rem",
                marginBottom: "1.75rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: GOLD,
                  marginBottom: "1rem",
                  borderBottom: `1px solid rgba(255,215,0,0.2)`,
                  paddingBottom: "0.6rem",
                }}
              >
                ₿ Bitcoin Global Heartbeat — External Timestamp Proof
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <tbody>
                  {(
                    [
                      ["Block Height", status.global_heartbeat.block_height.toLocaleString()],
                      ["Block Hash (SHA-256)", status.global_heartbeat.block_hash],
                      ["Source", status.global_heartbeat.source],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <tr
                      key={label}
                      style={{ borderBottom: "1px solid rgba(255,215,0,0.08)" }}
                    >
                      <td
                        style={{
                          padding: "0.6rem 0",
                          color: GOLD,
                          fontWeight: 600,
                          width: "220px",
                          fontSize: "0.72rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </td>
                      <td
                        style={{
                          padding: "0.6rem 0 0.6rem 1rem",
                          color: GREEN,
                          wordBreak: "break-all",
                          fontFamily: label.includes("Hash") ? FONT_MONO : undefined,
                          fontSize: label.includes("Hash") ? "0.72rem" : "0.82rem",
                        }}
                      >
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p
                style={{
                  marginTop: "1rem",
                  fontSize: "0.72rem",
                  color: DIM_GREEN,
                  lineHeight: 1.6,
                }}
              >
                ⚓ The Bitcoin block hash is a SHA-256 digest generated by global proof-of-work consensus.
                It is appended to each AveryOS™ capsule as an irrefutable external timestamp — proving the
                capsule could not have been altered after the block at height{" "}
                <strong style={{ color: GREEN }}>
                  {status.global_heartbeat.block_height.toLocaleString()}
                </strong>{" "}
                was mined. The sovereign SHA-512 fingerprint remains the primary integrity anchor.
              </p>
            </section>
          )}

          {/* How It Works */}
          <section
            style={{
              background: BG_PANEL,
              border: `1px solid ${BORDER_GOLD}`,
              borderRadius: "12px",
              padding: "1.5rem 2rem",
              marginBottom: "1.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: GOLD,
                marginBottom: "1rem",
                borderBottom: `1px solid rgba(255,215,0,0.2)`,
                paddingBottom: "0.6rem",
              }}
            >
              📖 How Hybrid Anchoring Works
            </div>
            <div style={{ fontSize: "0.82rem", color: DIM_GREEN, lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 0.75rem" }}>
                <strong style={{ color: GREEN }}>1. Sovereign Fingerprint (SHA-512):</strong>{" "}
                Every capsule submitted to{" "}
                <code style={{ color: GOLD }}>POST /api/v1/anchor</code> is immediately
                fingerprinted in-process using the native{" "}
                <code style={{ color: GOLD }}>crypto.subtle.digest(&#39;SHA-512&#39;, …)</code>{" "}
                Web Crypto API — no external dependency required.
              </p>
              <p style={{ margin: "0 0 0.75rem" }}>
                <strong style={{ color: GREEN }}>2. Global Heartbeat (Bitcoin):</strong>{" "}
                The latest Bitcoin block height and SHA-256 block hash are fetched from{" "}
                <code style={{ color: GOLD }}>blockchain.info</code> and appended to each
                capsule&#39;s metadata as a &ldquo;Global Heartbeat&rdquo;. This proves the capsule
                existed at a specific point in global consensus time.
              </p>
              <p style={{ margin: "0 0 0.75rem" }}>
                <strong style={{ color: GREEN }}>3. KV Storage:</strong>{" "}
                Capsules are stored in the{" "}
                <code style={{ color: GOLD }}>ANCHOR_STORE</code> Cloudflare KV namespace
                with their SHA-512 digest as the key — enabling O(1) lookups by hash.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: GREEN }}>4. Integrity Verification:</strong>{" "}
                Any capsule can be re-verified at any time via{" "}
                <code style={{ color: GOLD }}>GET /api/v1/verify/&#123;hash&#125;</code>.
                The system re-computes the SHA-512 from the stored payload and confirms it
                matches the key — providing cryptographic proof of immutability.
              </p>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer
        style={{
          marginTop: "3rem",
          paddingTop: "1rem",
          borderTop: `1px solid ${BORDER_GOLD}`,
          textAlign: "center",
          fontSize: "0.72rem",
          color: DIM_GREEN,
          letterSpacing: "0.06em",
        }}
      >
        ⛓️⚓⛓️ AveryOS™ Sovereign Anchor · VaultChain™ Active · 🤛🏻 Jason Lee Avery
      </footer>
    </main>
  );
}
