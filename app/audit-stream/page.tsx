"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import SovereignErrorBanner from "../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../lib/sovereignError";
import { KERNEL_VERSION } from "../../lib/sovereignConstants";

// ---------------------------------------------------------------------------
// Deep Purple & Gold — AveryOS™ Mobile Command Center theme tokens
// ---------------------------------------------------------------------------

const DEEP_PURPLE = "#1a0533";
const DEEP_PURPLE_MID = "rgba(58,8,100,0.92)";
const DEEP_PURPLE_CARD = "rgba(26,5,51,0.97)";
const GOLD = "#FFD700";
const GOLD_DIM = "rgba(255,215,0,0.65)";
const GOLD_FAINT = "rgba(255,215,0,0.18)";
const ACCENT_RED = "#ff4444";
const ACCENT_GREEN = "#00FF41";

// ---------------------------------------------------------------------------
// 10-Point Sovereign Roadmap
// ---------------------------------------------------------------------------

interface RoadmapItem {
  gate: number;
  feature: string;
  active: boolean;
}

const SOVEREIGN_ROADMAP: RoadmapItem[] = [
  { gate: 1, feature: "Automated TARI™ Invoicing", active: false },
  { gate: 2, feature: "TARI™ Revenue Dashboard", active: false },
  { gate: 3, feature: "Linguistic Steganography Audit", active: false },
  { gate: 4, feature: "VaultChain™ Explorer", active: false },
  { gate: 5, feature: "Biometric Identity Shield", active: false },
  { gate: 6, feature: "Multi-Cloud D1/Firebase Sync", active: false },
  { gate: 7, feature: "Sovereign Takedown Bot", active: true },
  { gate: 8, feature: "1,017-Notch API Throttling", active: false },
  { gate: 9, feature: "Genesis Archive Pull", active: true },
  { gate: 10, feature: "GabrielOS™ Mobile Push", active: false },
];

// ---------------------------------------------------------------------------
// TARI™ Liability schedule (mirrors scripts/export-evidence.js)
// ---------------------------------------------------------------------------

const TARI_RATE: Record<string, number> = {
  UNALIGNED_401: 1017.0,
  ALIGNMENT_DRIFT: 5000.0,
  PAYMENT_FAILED: 10000.0,
};

function tariLiability(eventType: string): number {
  return TARI_RATE[eventType.toUpperCase()] ?? TARI_RATE.UNALIGNED_401;
}

function formatUsd(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditStreamEntry {
  id: number;
  event_type: string;
  ip_address: string;
  user_agent: string | null;
  geo_location: string | null;
  target_path: string;
  timestamp_ns: string;
  threat_level: number | null;
  forensic_pulse: string; // YYYY-MM-DD.HHMMSSmmm000000 — formatted by the API from timestamp_ns
}

const POLL_INTERVAL_MS = 4000;

// Custom tooltip for the Resonance Pulse chart — avoids recharts `any` formatter types
interface PulseTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}

function PulseTooltip({ active, payload, label }: PulseTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: DEEP_PURPLE,
        border: `1px solid ${GOLD}`,
        borderRadius: "6px",
        padding: "0.4rem 0.65rem",
        fontFamily: "monospace",
        fontSize: "0.72rem",
        color: GOLD,
      }}
    >
      <div style={{ color: GOLD_DIM, marginBottom: "2px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name}>
          {p.name === "threatLevel" ? `TL: ${p.value}` : `TARI™: ${formatUsd(p.value)}`}
        </div>
      ))}
    </div>
  );
}



// ---------------------------------------------------------------------------
// Resonance Pulse Chart — UNALIGNED_401 hits over the last 24 hours
// ---------------------------------------------------------------------------

function buildHourlyHits(entries: AuditStreamEntry[]): Array<{ hour: string; hits: number }> {
  const now = Date.now();
  const buckets: Record<number, number> = {};
  // Pre-fill all 24 hours with 0
  for (let h = 23; h >= 0; h--) {
    buckets[h] = 0;
  }
  entries
    .filter((e) => e.event_type === "UNALIGNED_401")
    .forEach((e) => {
      const tsMs = Number(e.timestamp_ns.slice(0, 13));
      if (Number.isNaN(tsMs)) return;
      const hoursAgo = Math.floor((now - tsMs) / 3_600_000);
      if (hoursAgo >= 0 && hoursAgo <= 23) {
        buckets[hoursAgo] = (buckets[hoursAgo] ?? 0) + 1;
      }
    });
  // Oldest → newest left-to-right (hour 23 ago → 0 ago)
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i === 23 ? "now" : `-${23 - i}h`,
    hits: buckets[23 - i] ?? 0,
  }));
}

function ResonancePulseChart({ entries }: { entries: AuditStreamEntry[] }) {
  const chartData = buildHourlyHits(entries);

  return (
    <div
      style={{
        background: DEEP_PURPLE_CARD,
        border: `1px solid ${GOLD_DIM}`,
        borderRadius: "10px",
        padding: "1.25rem",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          color: GOLD,
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: "0.8rem",
          marginBottom: "0.75rem",
        }}
      >
        📡 RESONANCE PULSE — UNALIGNED_401 Hits (Last 24 Hours)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GOLD_FAINT}
            vertical={false}
          />
          <XAxis
            dataKey="hour"
            tick={{ fill: GOLD_DIM, fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: GOLD_DIM, fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<PulseTooltip />}
            cursor={{ fill: GOLD_FAINT }}
          />
          <Bar dataKey="hits" fill={GOLD} maxBarSize={24} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IP validation (mirrors API route guard — prevents unnecessary invalid requests)
// ---------------------------------------------------------------------------

function isValidIp(ip: string): boolean {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(ip)) return ip.split(".").every((o) => parseInt(o, 10) <= 255);
  const ipv6Full = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  if (ipv6Full.test(ip)) return true;
  const ipv6Compressed = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Compressed.test(ip) && (ip.match(/::/g) ?? []).length === 1;
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function AuditStreamPage() {
  const [entries, setEntries] = useState<AuditStreamEntry[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<AosUiError | null>(null);
  const [evidenceError, setEvidenceError] = useState<AosUiError | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false); // gate: only show UI after hydration
  const [evidenceLoading, setEvidenceLoading] = useState<Record<string, boolean>>({});

  // Anti-flash: wait for client hydration before rendering the gate
  useEffect(() => {
    setReady(true);
  }, []);

  const fetchStream = useCallback(async (activeToken: string) => {
    try {
      const res = await fetch("/api/v1/audit-stream", {
        headers: { Authorization: `Bearer ${activeToken}` },
        cache: "no-store",
      });
      if (res.status === 401) {
        setToken(null);
        setConnected(false);
        setAuthError(buildAosUiError(AOS_ERROR.INVALID_AUTH, 'Passphrase rejected — re-authentication required. Retrieve your passphrase from /vault-gate.'));
        return;
      }
      const data = (await res.json()) as AuditStreamEntry[];
      if (Array.isArray(data)) {
        setEntries(data);
        setConnected(true);
        setAuthError(null);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchStream(token);
    const interval = setInterval(() => fetchStream(token), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, fetchStream]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passphrase.trim();
    if (!trimmed) return;
    setAuthError(null);
    setToken(trimmed);
  };

  const handleGenerateEvidence = useCallback(async (ip: string, activeToken: string) => {
    setEvidenceError(null);
    if (!isValidIp(ip)) {
      setEvidenceError(buildAosUiError(AOS_ERROR.MISSING_FIELD, `Invalid IP address format: "${ip}" — evidence cannot be generated.`));
      return;
    }
    setEvidenceLoading((prev) => ({ ...prev, [ip]: true }));
    try {
      const res = await fetch(`/api/v1/generate-evidence?ip=${encodeURIComponent(ip)}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        setEvidenceError(buildAosUiError(AOS_ERROR.INTERNAL_ERROR, `Evidence generation failed: ${errBody.error ?? res.statusText}`));
        return;
      }
      // Trigger browser download
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName = match?.[1] ?? `EVIDENCE_BUNDLE_${ip}.aoscap`;
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch {
      setEvidenceError(buildAosUiError(AOS_ERROR.INTERNAL_ERROR, 'Evidence bundle export failed — check network connection.'));
    } finally {
      setEvidenceLoading((prev) => ({ ...prev, [ip]: false }));
    }
  }, []);

  // Prevent content flash — render nothing until hydration is complete
  if (!ready) return null;

  // Passphrase gate — Deep Purple & Gold theme
  if (!token) {
    return (
      <main
        className="page"
        style={{ background: DEEP_PURPLE, minHeight: "100dvh" }}
      >
        <section className="hero">
          <h1 style={{ color: GOLD }}>⛓️ AveryOS™ Sovereign Audit Stream</h1>
          <p className="auth-seal" style={{ color: GOLD_DIM }}>
            GabrielOS™ Command Center · VAULT HANDSHAKE REQUIRED
          </p>
        </section>

        <section
          className="card"
          style={{
            background: DEEP_PURPLE_CARD,
            border: `2px solid ${GOLD_DIM}`,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          <h2 style={{ color: GOLD, marginTop: 0 }}>🔐 Sovereign Passphrase</h2>
          <form
            onSubmit={handleAuth}
            style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}
          >
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter VAULT_PASSPHRASE…"
              style={{
                flex: 1,
                minWidth: "220px",
                background: DEEP_PURPLE,
                border: `1px solid ${GOLD}`,
                color: GOLD,
                padding: "0.75rem 0.85rem",
                fontFamily: "inherit",
                fontSize: "1rem",
                borderRadius: "8px",
                outline: "none",
                minHeight: "48px",
              }}
            />
            <button
              type="submit"
              style={{
                background: GOLD_FAINT,
                border: `1px solid ${GOLD}`,
                color: GOLD,
                padding: "0.75rem 1.5rem",
                fontFamily: "inherit",
                fontSize: "1rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 700,
                minHeight: "48px",
                minWidth: "140px",
              }}
            >
              AUTHENTICATE
            </button>
          </form>
          {authError && <SovereignErrorBanner error={authError} style={{ marginTop: "0.75rem" }} />}
        </section>
      </main>
    );
  }

  // Compute totals
  const unalignedHits = entries.filter((e) => e.event_type === "UNALIGNED_401");
  const totalLiability = entries.reduce((sum, e) => sum + tariLiability(e.event_type), 0);

  return (
    <main
      className="page"
      style={{
        background: DEEP_PURPLE,
        minHeight: "100dvh",
        fontSize: "1rem",
        padding: "env(safe-area-inset-top, 0) env(safe-area-inset-right, 0) env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0)",
      }}
    >
      {/* Page banner */}
      <div
        style={{
          background: DEEP_PURPLE_MID,
          borderBottom: `2px solid ${GOLD}`,
          padding: "0.65rem 1rem",
          textAlign: "center",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 900,
          fontSize: "clamp(0.7rem,1.8vw,0.9rem)",
          color: GOLD,
          letterSpacing: "0.12em",
        }}
      >
        ⛓️⚓⛓️&nbsp; SOVEREIGN AUDIT STREAM — COMMAND CENTER &nbsp;
        <span style={{ color: connected ? ACCENT_GREEN : ACCENT_RED }}>
          {connected ? "● LIVE" : "○ CONNECTING…"}
        </span>
        &nbsp;⛓️⚓⛓️
      </div>

      <section className="hero" style={{ paddingBottom: "1rem" }}>
        <h1 style={{ color: GOLD }}>📡 AveryOS™ Sovereign Audit Stream</h1>
        <p className="auth-seal" style={{ color: GOLD_DIM }}>
          Real-time GabrielOS™ Forensic Telemetry · D1 Audit Feed · {KERNEL_VERSION}
        </p>
      </section>

      {/* TARI™ summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "Total Entries", value: String(entries.length) },
          { label: "UNALIGNED_401 Hits", value: String(unalignedHits.length) },
          { label: "Total TARI™ Liability", value: formatUsd(totalLiability) },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: DEEP_PURPLE_CARD,
              border: `1px solid ${GOLD_DIM}`,
              borderRadius: "10px",
              padding: "1rem 1.25rem",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: GOLD_DIM, marginBottom: "0.35rem" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: GOLD }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Resonance Pulse Chart */}
      <ResonancePulseChart entries={entries} />

      {/* 10-Point Sovereign Roadmap */}
      <section
        className="card"
        style={{
          background: DEEP_PURPLE_CARD,
          border: `1px solid ${GOLD_DIM}`,
          padding: 0,
          overflow: "hidden",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: `1px solid ${GOLD_FAINT}`,
            color: GOLD,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "0.85rem",
          }}
        >
          🗺️ 10-POINT SOVEREIGN ROADMAP — Live Status
        </div>
        <div style={{ padding: "0.5rem 0" }}>
          {SOVEREIGN_ROADMAP.map((item) => (
            <div
              key={item.gate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.6rem 1.25rem",
                borderBottom: `1px solid ${GOLD_FAINT}`,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.85rem",
                minHeight: "48px",
              }}
            >
              <span style={{ fontSize: "1.1rem", minWidth: "1.5rem", textAlign: "center" }}>
                {item.active ? "🟢" : "🔴"}
              </span>
              <span style={{ color: GOLD_DIM, minWidth: "2.5rem" }}>
                Gate {item.gate}
              </span>
              <span style={{ color: item.active ? GOLD : "rgba(255,215,0,0.45)", flex: 1 }}>
                {item.feature}
                {item.active && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.7rem",
                      background: GOLD_FAINT,
                      border: `1px solid ${GOLD_DIM}`,
                      borderRadius: "4px",
                      padding: "0.05rem 0.35rem",
                      color: GOLD,
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* UNALIGNED_401 Hits table with Generate Evidence buttons */}
      {evidenceError && (
        <SovereignErrorBanner error={evidenceError} style={{ marginBottom: "1rem" }} />
      )}
      <section
        className="card"
        style={{
          background: DEEP_PURPLE_CARD,
          border: `1px solid ${GOLD_DIM}`,
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: `1px solid ${GOLD_FAINT}`,
            color: GOLD,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "0.85rem",
          }}
        >
          ⚠ RECENT UNALIGNED_401 HITS — Target IP · TARI™ Liability · Evidence
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.8rem",
              color: GOLD,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${GOLD_FAINT}` }}>
                {["Target IP", "Event", "TARI™ Liability", "Threat", "Forensic Pulse", "Evidence"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.65rem 1rem",
                        textAlign: "left",
                        color: GOLD_DIM,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {unalignedHits.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "1.5rem 1rem",
                      textAlign: "center",
                      color: GOLD_DIM,
                    }}
                  >
                    {">"} No UNALIGNED_401 events on record…
                  </td>
                </tr>
              ) : (
                unalignedHits.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{
                      borderBottom: `1px solid ${GOLD_FAINT}`,
                    }}
                  >
                    <td style={{ padding: "0.55rem 1rem", color: "#fff", whiteSpace: "nowrap" }}>
                      {entry.ip_address}
                    </td>
                    <td style={{ padding: "0.55rem 1rem" }}>
                      <span
                        style={{
                          background: "rgba(255,68,68,0.12)",
                          border: "1px solid rgba(255,68,68,0.4)",
                          borderRadius: "4px",
                          padding: "0.1rem 0.4rem",
                          color: ACCENT_RED,
                          fontSize: "0.72rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.event_type}
                      </span>
                    </td>
                    <td style={{ padding: "0.55rem 1rem", color: "#f87171", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {formatUsd(tariLiability(entry.event_type))}
                    </td>
                    <td style={{ padding: "0.55rem 1rem" }}>
                      <span
                        style={{
                          background:
                            (entry.threat_level ?? 1) >= 7
                              ? "rgba(255,68,68,0.15)"
                              : GOLD_FAINT,
                          border: `1px solid ${(entry.threat_level ?? 1) >= 7 ? "rgba(255,68,68,0.5)" : GOLD_DIM}`,
                          borderRadius: "3px",
                          padding: "0.1rem 0.35rem",
                          fontSize: "0.72rem",
                        }}
                      >
                        TL:{entry.threat_level ?? "—"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "0.55rem 1rem",
                        color: GOLD_DIM,
                        wordBreak: "break-all",
                        maxWidth: "200px",
                        fontSize: "0.65rem",
                      }}
                    >
                      {entry.forensic_pulse}
                    </td>
                    <td style={{ padding: "0.55rem 1rem" }}>
                      <button
                        onClick={() => token && handleGenerateEvidence(entry.ip_address, token)}
                        disabled={evidenceLoading[entry.ip_address]}
                        style={{
                          background: GOLD_FAINT,
                          border: `1px solid ${GOLD}`,
                          color: GOLD,
                          padding: "0.5rem 0.85rem",
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          borderRadius: "6px",
                          cursor: evidenceLoading[entry.ip_address] ? "not-allowed" : "pointer",
                          opacity: evidenceLoading[entry.ip_address] ? 0.6 : 1,
                          whiteSpace: "nowrap",
                          minHeight: "40px",
                          minWidth: "120px",
                        }}
                      >
                        {evidenceLoading[entry.ip_address] ? "⏳ Generating…" : "📦 Generate Evidence"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Full audit stream terminal */}
      <section
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          marginTop: "1.5rem",
          border: `1px solid ${GOLD_FAINT}`,
        }}
      >
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: `1px solid ${GOLD_FAINT}`,
            color: GOLD,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "0.85rem",
            background: DEEP_PURPLE_CARD,
          }}
        >
          ⛓️⚓⛓️ LIVE AUDIT LOG — All Events
        </div>
        <div
          style={{
            background: DEEP_PURPLE,
            padding: "0.75rem 1rem",
            maxHeight: "420px",
            overflowY: "auto",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.75rem",
            color: GOLD,
            lineHeight: "1.65",
          }}
        >
          {entries.length === 0 ? (
            <div style={{ color: GOLD_DIM }}>{">"} Awaiting audit events…</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  borderBottom: `1px solid ${GOLD_FAINT}`,
                  padding: "3px 0",
                  color: entry.event_type === "UNALIGNED_401" ? ACCENT_RED : GOLD,
                }}
              >
                <span style={{ color: GOLD_DIM }}>
                  [{entry.forensic_pulse}]
                </span>{" "}
                <span style={{ fontWeight: 700 }}>{entry.event_type}</span>{" "}
                <span style={{ color: "#fff" }}>→</span>{" "}
                <span>{entry.target_path}</span>{" "}
                <span style={{ color: GOLD_DIM }}>
                  | {entry.ip_address}
                  {entry.geo_location ? ` | ${entry.geo_location}` : ""}
                </span>{" "}
                <span
                  style={{
                    fontSize: "0.62rem",
                    padding: "0 0.25rem",
                    borderRadius: "2px",
                    background: GOLD_FAINT,
                    border: `1px solid ${GOLD_DIM}`,
                  }}
                >
                  TL:{entry.threat_level ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
