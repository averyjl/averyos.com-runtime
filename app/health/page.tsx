"use client";

import { useEffect, useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";
import SovereignAuditStream from "../../src/components/Sovereign/SovereignAuditStream";
import SovereignSettlementHandshake from "../../src/components/Sovereign/SovereignSettlementHandshake";

interface HealthStatus {
  build_version: string;
  kernel_resonance_hash: string;
  build_timestamp_ms: string;
  tari_pulse_peers: number;
  updated_at: string;
  drift_pct: string;
  kernel_match: boolean;
}

const GOLD = "#FFD700";
const GREEN = "#00FF41";
const DIM_GREEN = "rgba(0,255,65,0.65)";
const BORDER_GOLD = "rgba(255,215,0,0.35)";
const BG_DARK = "#060a06";
const BG_PANEL = "rgba(0,20,0,0.75)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

const THREAT_POLL_INTERVAL_MS = 5000;

export default function SovereignHealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [threatLevel, setThreatLevel] = useState<number>(0);

  // Poll threat level every 5 s; intercept if >= 5
  useEffect(() => {
    const checkThreat = () => {
      fetch("/api/v1/threat-level", { cache: "no-store" })
        .then((r) => r.json())
        .then((data: { threat_level?: number }) => {
          setThreatLevel(data.threat_level ?? 0);
        })
        .catch(() => {
          console.warn("[threat-level] poll failed");
        });
    };
    checkThreat();
    const interval = setInterval(checkThreat, THREAT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/api/v1/health-status")
      .then((r) => r.json())
      .then((data: HealthStatus) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const formatTs = (ts: string): string => {
    try {
      return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC";
    } catch {
      return ts;
    }
  };

  const truncateHash = (hash: string, chars = 16): string =>
    hash.length > chars * 2
      ? `${hash.slice(0, chars)}…${hash.slice(-chars)}`
      : hash;

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

      {/* Corporate Amnesty Intercept: block all panels when threat_level >= 5 */}
      {threatLevel >= 5 ? (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingTop: "2rem",
          }}
        >
          <SovereignSettlementHandshake
            threatLevel={threatLevel}
          />
        </div>
      ) : (
        <>
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
          <span style={{ fontSize: "2rem" }} role="img" aria-label="Shield">
            🛡️
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
            AveryOS™ Sovereign Health Dashboard
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
          1,017-Notch Ignition · Build Provenance Active · ⛓️⚓⛓️
        </p>
      </header>

      {/* Loading / Error */}
      {loading && (
        <p style={{ color: DIM_GREEN, fontSize: "0.9rem" }}>
          ⏳ Fetching sovereign health data…
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
          ⚠️ HEALTH_STATUS_ERROR: {error}
        </div>
      )}

      {health && (
        <>
          {/* Status Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.25rem",
              marginBottom: "1.75rem",
            }}
          >
            {/* Kernel Resonance */}
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
                🔐 Kernel Resonance
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: health.kernel_match ? GREEN : "#f87171",
                  textShadow: `0 0 14px ${health.kernel_match ? GREEN : "#f87171"}`,
                  marginBottom: "0.5rem",
                }}
              >
                {health.kernel_match ? "✅ ALIGNED" : "⚠️ DRIFT"}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: DIM_GREEN,
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}
              >
                {truncateHash(health.kernel_resonance_hash)}
              </div>
            </section>

            {/* Drift Meter */}
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
                📡 Drift Meter
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
                {health.drift_pct}%
              </div>
              <div style={{ fontSize: "0.72rem", color: DIM_GREEN }}>
                Absolute Drift Protection Active
              </div>
            </section>

            {/* TARI Pulse */}
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
                ⚡ TARI Pulse
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
                {health.tari_pulse_peers}
                <span style={{ fontSize: "1rem", color: DIM_GREEN }}>/1000</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: DIM_GREEN }}>
                Ignition Peers Onboarded
              </div>
            </section>
          </div>

          {/* Build Provenance Panel */}
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
              ⛓️ Build Provenance
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <tbody>
                {[
                  ["Build Version", health.build_version],
                  ["Kernel Hash", truncateHash(health.kernel_resonance_hash, 24)],
                  ["Build Timestamp (ns)", health.build_timestamp_ms],
                  ["Last Updated", formatTs(health.updated_at)],
                ].map(([label, value]) => (
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
        </>
      )}

      {/* Sovereign Audit Stream */}
      <section
        style={{
          marginBottom: "1.75rem",
        }}
      >
        <div
          style={{
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#FFD700",
            marginBottom: "0.75rem",
          }}
        >
          🛡️ Legal Tripwire · Sovereign Audit Stream
        </div>
        <SovereignAuditStream />
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
        ⛓️⚓⛓️ AveryOS™ Sovereign Health · Build Provenance Active · 🤛🏻 Jason Lee Avery
      </footer>
    </main>
  );
}
