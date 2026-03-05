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
        background: "#000",
        border: "1px solid #00FF41",
        borderRadius: "6px",
        padding: "0.4rem 0.65rem",
        fontFamily: "monospace",
        fontSize: "0.72rem",
        color: "#00FF41",
      }}
    >
      <div style={{ color: "rgba(0,255,65,0.5)", marginBottom: "2px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name}>
          {p.name === "threatLevel" ? `TL: ${p.value}` : `TARI™: ${formatUsd(p.value)}`}
        </div>
      ))}
    </div>
  );
}



// ---------------------------------------------------------------------------
// Resonance Pulse Chart
// ---------------------------------------------------------------------------

function ResonancePulseChart({ entries }: { entries: AuditStreamEntry[] }) {
  // Build chart data: most recent 20 entries, oldest → newest left-to-right
  const chartData = [...entries]
    .slice(0, 20)
    .reverse()
    .map((e) => ({
      pulse: e.forensic_pulse.slice(11, 19),
      threatLevel: e.threat_level ?? 1,
      tari: tariLiability(e.event_type),
    }));

  return (
    <div
      style={{
        background: "rgba(0,8,20,0.95)",
        border: "1px solid rgba(0,255,65,0.3)",
        borderRadius: "10px",
        padding: "1.25rem",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          color: "#00FF41",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: "0.8rem",
          marginBottom: "0.75rem",
        }}
      >
        📡 RESONANCE PULSE — Threat Level by Event
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(0,255,65,0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="pulse"
            tick={{ fill: "rgba(0,255,65,0.45)", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(0,255,65,0.45)", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 10]}
          />
          <Tooltip
            content={<PulseTooltip />}
            cursor={{ fill: "rgba(0,255,65,0.05)" }}
          />
          <Bar dataKey="threatLevel" fill="#00FF41" maxBarSize={24} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function AuditStreamPage() {
  const [entries, setEntries] = useState<AuditStreamEntry[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false); // gate: only show UI after hydration

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
        setAuthError("Passphrase rejected — re-authentication required.");
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

  // Prevent content flash — render nothing until hydration is complete
  if (!ready) return null;

  // Passphrase gate
  if (!token) {
    return (
      <main className="page">
        <section className="hero">
          <h1>⛓️ AveryOS™ Sovereign Audit Stream</h1>
          <p className="auth-seal">GabrielOS™ Command Center · YUBIKEY HANDSHAKE REQUIRED</p>
        </section>

        <section
          className="card"
          style={{
            background: "rgba(0,8,20,0.95)",
            border: "2px solid rgba(0,255,65,0.35)",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          <h2 style={{ color: "#00FF41", marginTop: 0 }}>🔐 Sovereign Passphrase</h2>
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
                background: "#000",
                border: "1px solid #00FF41",
                color: "#00FF41",
                padding: "0.5rem 0.85rem",
                fontFamily: "inherit",
                fontSize: "0.85rem",
                borderRadius: "6px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                background: "rgba(0,255,65,0.12)",
                border: "1px solid #00FF41",
                color: "#00FF41",
                padding: "0.5rem 1.25rem",
                fontFamily: "inherit",
                fontSize: "0.85rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              AUTHENTICATE
            </button>
          </form>
          {authError && (
            <p style={{ color: "#f87171", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              ⚠ {authError}
            </p>
          )}
        </section>
      </main>
    );
  }

  // Compute totals
  const unalignedHits = entries.filter((e) => e.event_type === "UNALIGNED_401");
  const totalLiability = entries.reduce((sum, e) => sum + tariLiability(e.event_type), 0);

  return (
    <main className="page">
      {/* Page banner */}
      <div
        style={{
          background:
            "repeating-linear-gradient(135deg,#000800 0,#000800 10px,#001200 10px,#001200 20px)",
          border: "none",
          borderBottom: "2px solid rgba(0,255,65,0.4)",
          padding: "0.55rem 1rem",
          textAlign: "center",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 900,
          fontSize: "clamp(0.7rem,1.8vw,0.9rem)",
          color: "#00FF41",
          letterSpacing: "0.15em",
        }}
      >
        ⛓️⚓⛓️&nbsp; SOVEREIGN AUDIT STREAM — COMMAND CENTER &nbsp;
        <span style={{ color: connected ? "#00FF41" : "#f87171" }}>
          {connected ? "● LIVE" : "○ CONNECTING…"}
        </span>
        &nbsp;⛓️⚓⛓️
      </div>

      <section className="hero" style={{ paddingBottom: "1rem" }}>
        <h1>📡 AveryOS™ Sovereign Audit Stream</h1>
        <p className="auth-seal">
          Real-time GabrielOS™ Forensic Telemetry · D1 Audit Feed
        </p>
      </section>

      {/* TARI™ summary */}
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
              background: "rgba(0,8,20,0.9)",
              border: "1px solid rgba(0,255,65,0.25)",
              borderRadius: "10px",
              padding: "1rem 1.25rem",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <div style={{ fontSize: "0.7rem", color: "rgba(0,255,65,0.55)", marginBottom: "0.35rem" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#00FF41" }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Resonance Pulse Chart */}
      <ResonancePulseChart entries={entries} />

      {/* UNALIGNED_401 Hits table */}
      <section
        className="card"
        style={{
          background: "rgba(0,8,20,0.95)",
          border: "1px solid rgba(0,255,65,0.25)",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: "1px solid rgba(0,255,65,0.15)",
            color: "#00FF41",
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "0.8rem",
          }}
        >
          ⚠ RECENT UNALIGNED_401 HITS — Target IP · TARI™ Liability · Forensic Pulse
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.75rem",
              color: "#00FF41",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,255,65,0.12)" }}>
                {["Target IP", "Event", "TARI™ Liability", "Threat", "Forensic Pulse SHA"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.6rem 1rem",
                        textAlign: "left",
                        color: "rgba(0,255,65,0.55)",
                        fontWeight: 600,
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
                    colSpan={5}
                    style={{
                      padding: "1.5rem 1rem",
                      textAlign: "center",
                      color: "rgba(0,255,65,0.35)",
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
                      borderBottom: "1px solid rgba(0,255,65,0.07)",
                    }}
                  >
                    <td style={{ padding: "0.5rem 1rem", color: "#fff" }}>
                      {entry.ip_address}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <span
                        style={{
                          background: "rgba(255,49,49,0.12)",
                          border: "1px solid rgba(255,49,49,0.4)",
                          borderRadius: "4px",
                          padding: "0.1rem 0.4rem",
                          color: "#ff3131",
                          fontSize: "0.7rem",
                        }}
                      >
                        {entry.event_type}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem 1rem", color: "#f87171", fontWeight: 700 }}>
                      {formatUsd(tariLiability(entry.event_type))}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <span
                        style={{
                          background:
                            (entry.threat_level ?? 1) >= 7
                              ? "rgba(255,49,49,0.15)"
                              : "rgba(0,255,65,0.08)",
                          border: `1px solid ${(entry.threat_level ?? 1) >= 7 ? "rgba(255,49,49,0.5)" : "rgba(0,255,65,0.25)"}`,
                          borderRadius: "3px",
                          padding: "0.1rem 0.35rem",
                          fontSize: "0.7rem",
                        }}
                      >
                        TL:{entry.threat_level ?? "—"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 1rem",
                        color: "rgba(0,255,65,0.5)",
                        wordBreak: "break-all",
                        maxWidth: "240px",
                        fontSize: "0.65rem",
                      }}
                    >
                      {entry.forensic_pulse}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Full audit stream terminal */}
      <section className="card" style={{ padding: 0, overflow: "hidden", marginTop: "1.5rem" }}>
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: "1px solid rgba(0,255,65,0.15)",
            color: "#00FF41",
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "0.8rem",
            background: "rgba(0,8,20,0.95)",
          }}
        >
          ⛓️⚓⛓️ LIVE AUDIT LOG — All Events
        </div>
        <div
          style={{
            background: "#000",
            padding: "0.75rem 1rem",
            maxHeight: "420px",
            overflowY: "auto",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.72rem",
            color: "#00FF41",
            lineHeight: "1.65",
          }}
        >
          {entries.length === 0 ? (
            <div style={{ color: "rgba(0,255,65,0.35)" }}>{">"} Awaiting audit events…</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  borderBottom: "1px solid rgba(0,255,65,0.07)",
                  padding: "3px 0",
                  color: entry.event_type === "UNALIGNED_401" ? "#ff3131" : "#00FF41",
                }}
              >
                <span style={{ color: "rgba(0,255,65,0.4)" }}>
                  [{entry.forensic_pulse}]
                </span>{" "}
                <span style={{ fontWeight: 700 }}>{entry.event_type}</span>{" "}
                <span style={{ color: "#fff" }}>→</span>{" "}
                <span>{entry.target_path}</span>{" "}
                <span style={{ color: "rgba(0,255,65,0.5)" }}>
                  | {entry.ip_address}
                  {entry.geo_location ? ` | ${entry.geo_location}` : ""}
                </span>{" "}
                <span
                  style={{
                    fontSize: "0.62rem",
                    padding: "0 0.25rem",
                    borderRadius: "2px",
                    background: "rgba(0,255,65,0.06)",
                    border: "1px solid rgba(0,255,65,0.2)",
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
