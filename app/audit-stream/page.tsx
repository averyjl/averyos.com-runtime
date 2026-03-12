"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import SovereignErrorBanner from "../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../lib/sovereignError";

// Recharts is excluded from the SSR bundle via ssr:false to keep the
// Cloudflare Worker under the 3 MiB compressed size limit.
const ResonancePulseChart = dynamic(() => import("./ResonancePulseChart"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        background: "#0a0015",
        border: "1px solid rgba(255,215,0,0.35)",
        borderRadius: "12px",
        padding: "1.25rem",
        marginBottom: "1.5rem",
        minHeight: "200px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,215,0,0.55)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "0.8rem",
      }}
    >
      📡 Loading Resonance Pulse…
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Deep Purple & Gold theme — AveryOS™ Mobile Command Center
// ---------------------------------------------------------------------------

const PURPLE_DEEP = "#0a0015";
const PURPLE_MID = "rgba(98,0,234,0.18)";
const PURPLE_BORDER = "rgba(120,60,255,0.35)";
const GOLD = "#ffd700";
const GOLD_DIM = "rgba(255,215,0,0.55)";
const GOLD_BORDER = "rgba(255,215,0,0.35)";
const GOLD_GLOW = "rgba(255,215,0,0.12)";
const WHITE = "#ffffff";
const RED = "#ff4444";
const RED_DIM = "rgba(255,68,68,0.55)";

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

/** Validates a well-formed IPv4 or IPv6 address (mirrors scripts/export-evidence.js). */
function isValidIp(ip: string): boolean {
  // IPv4: expanded pattern to avoid quantified group (ReDoS heuristic)
  const ipv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipv4.test(ip)) {
    return ip.split(".").every((o) => parseInt(o, 10) <= 255);
  }
  const ipv6 = /^[0-9a-fA-F:]{2,39}$/;
  return ipv6.test(ip) && ip.includes(":");
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

// ---------------------------------------------------------------------------
// 10-Point Sovereign Roadmap
// ---------------------------------------------------------------------------

const SOVEREIGN_ROADMAP = [
  { gate: 1,  name: "Automated TARI™ Invoicing",       active: true  },
  { gate: 2,  name: "TARI™ Revenue Dashboard",          active: true  },
  { gate: 3,  name: "Linguistic Steganography Audit",   active: false },
  { gate: 4,  name: "VaultChain™ Explorer",             active: false },
  { gate: 5,  name: "Biometric Identity Shield",        active: false },
  { gate: 6,  name: "Multi-Cloud D1/Firebase Sync",     active: false },
  { gate: 7,  name: "Sovereign Takedown Bot",           active: true  },
  { gate: 8,  name: "1,017-Notch API Throttling",       active: false },
  { gate: 9,  name: "Genesis Archive Pull",             active: true  },
  { gate: 10, name: "GabrielOS™ Mobile Push",           active: false },
];

function SovereignRoadmapSection() {
  return (
    <section
      style={{
        background: PURPLE_DEEP,
        border: `1px solid ${GOLD_BORDER}`,
        borderRadius: "12px",
        padding: "1.25rem",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          color: GOLD,
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: "0.85rem",
          marginBottom: "1rem",
          letterSpacing: "0.08em",
        }}
      >
        🗺️ SOVEREIGN ROADMAP — 10-POINT GATE STATUS
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.6rem" }}>
        {SOVEREIGN_ROADMAP.map((item) => (
          <div
            key={item.gate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.5rem 0.75rem",
              background: item.active ? "rgba(255,215,0,0.06)" : PURPLE_MID,
              border: `1px solid ${item.active ? GOLD_BORDER : PURPLE_BORDER}`,
              borderRadius: "8px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.78rem",
              minHeight: "44px",
            }}
          >
            <span style={{ fontSize: "1rem", lineHeight: 1 }}>
              {item.active ? "🟢" : "🔴"}
            </span>
            <span style={{ color: "rgba(255,255,255,0.55)", minWidth: "1.4rem", fontWeight: 700 }}>
              G{item.gate}
            </span>
            <span style={{ color: item.active ? GOLD : "rgba(255,255,255,0.7)", lineHeight: 1.3 }}>
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Export Evidence Button — downloads the .aoscap forensic bundle
// ---------------------------------------------------------------------------

interface ExportEvidenceButtonProps {
  entry: AuditStreamEntry;
  token: string;
}

function ExportEvidenceButton({ entry, token }: ExportEvidenceButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<AosUiError | null>(null);

  const handleExport = async () => {
    setState("loading");
    setErrorMsg(null);
    const ip = entry.ip_address;
    if (!isValidIp(ip)) {
      setErrorMsg(buildAosUiError(AOS_ERROR.MISSING_FIELD, `Invalid IP: "${ip}" — evidence cannot be exported.`));
      setState("error");
      return;
    }
    try {
      const res = await fetch(`/api/v1/generate-evidence?ip=${encodeURIComponent(ip)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        setErrorMsg(buildAosUiError(AOS_ERROR.INTERNAL_ERROR, `Evidence export failed: ${errBody.error ?? res.statusText}`));
        setState("error");
        return;
      }
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
      setState("done");
    } catch {
      setErrorMsg(buildAosUiError(AOS_ERROR.INTERNAL_ERROR, "Export failed — check network connection."));
      setState("error");
    }
  };

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={state === "loading"}
        style={{
          background: state === "done" ? "rgba(0,255,65,0.1)" : state === "error" ? "rgba(255,68,68,0.15)" : "rgba(255,215,0,0.08)",
          border: `1px solid ${state === "done" ? "#4ade80" : state === "error" ? RED : GOLD_BORDER}`,
          color: state === "done" ? "#4ade80" : state === "error" ? RED : GOLD,
          padding: "0.3rem 0.65rem",
          borderRadius: "6px",
          fontSize: "0.7rem",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          cursor: state === "loading" ? "wait" : "pointer",
          whiteSpace: "nowrap",
          minHeight: "36px",
          minWidth: "110px",
          marginBottom: errorMsg ? "0.2rem" : 0,
        }}
      >
        {state === "loading" ? "⏳ Exporting…" : state === "done" ? "✅ Exported" : state === "error" ? "⚠ Retry" : "📥 Export .aoscap"}
      </button>
      {errorMsg && <SovereignErrorBanner error={errorMsg} style={{ marginTop: "0.25rem", fontSize: "0.65rem" }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Invoice Button — creates TARI™ Stripe invoice
// ---------------------------------------------------------------------------

interface CreateInvoiceButtonProps {
  entry: AuditStreamEntry;
  token: string;
}

function CreateInvoiceButton({ entry, token }: CreateInvoiceButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setState("loading");
    try {
      const bundleId = `EVIDENCE_BUNDLE_${entry.id}_${entry.ip_address.replace(/\./g, "-")}_${Date.now()}`;
      const res = await fetch("/api/v1/compliance/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bundleId,
          targetIp: entry.ip_address,
          tariLiability: Math.round(tariLiability(entry.event_type) * 100),
        }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = (await res.json()) as { checkoutUrl: string };
      setCheckoutUrl(data.checkoutUrl ?? null);
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done" && checkoutUrl) {
    return (
      <a
        href={checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          background: "rgba(255,215,0,0.15)",
          border: `1px solid ${GOLD}`,
          color: GOLD,
          padding: "0.3rem 0.65rem",
          borderRadius: "6px",
          fontSize: "0.7rem",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
          minHeight: "36px",
          lineHeight: "1.8",
        }}
      >
        📄 Open Invoice
      </a>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={state === "loading"}
      style={{
        background: state === "error" ? "rgba(255,68,68,0.15)" : "rgba(255,215,0,0.08)",
        border: `1px solid ${state === "error" ? RED : GOLD_BORDER}`,
        color: state === "error" ? RED : GOLD,
        padding: "0.3rem 0.65rem",
        borderRadius: "6px",
        fontSize: "0.7rem",
        fontFamily: "JetBrains Mono, monospace",
        fontWeight: 700,
        cursor: state === "loading" ? "wait" : "pointer",
        whiteSpace: "nowrap",
        minHeight: "36px",
        minWidth: "120px",
      }}
    >
      {state === "loading" ? "⏳ Packaging…" : state === "error" ? "⚠ Retry" : "💳 Create Invoice"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function AuditStreamPage() {
  const [entries, setEntries] = useState<AuditStreamEntry[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<AosUiError | null>(null);
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

  // Prevent content flash — render nothing until hydration is complete
  if (!ready) return null;

  // Passphrase gate — VaultGate passphrase handshake, zero-content-flash
  if (!token) {
    return (
      <main
        className="page"
        style={{ background: PURPLE_DEEP, minHeight: "100vh" }}
        aria-label="Sovereign Audit Stream — Authentication"
      >
        <section className="hero">
          <h1 style={{ color: GOLD }}>⛓️ AveryOS™ Sovereign Audit Stream</h1>
          <p className="auth-seal" style={{ color: GOLD_DIM }}>
            GabrielOS™ Mobile Command Center · VAULT_PASSPHRASE REQUIRED
          </p>
        </section>

        <section
          className="card"
          style={{
            background: "rgba(10,0,21,0.98)",
            border: `2px solid ${GOLD_BORDER}`,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          <h2 style={{ color: GOLD, marginTop: 0, fontSize: "1rem" }}>🔐 Sovereign Passphrase</h2>
          <form
            onSubmit={handleAuth}
            style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}
          >
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter VAULT_PASSPHRASE…"
              aria-label="VAULT_PASSPHRASE"
              style={{
                flex: 1,
                minWidth: "220px",
                background: "#0a0015",
                border: `1px solid ${GOLD_BORDER}`,
                color: GOLD,
                padding: "0.65rem 0.85rem",
                fontFamily: "inherit",
                fontSize: "1rem",
                borderRadius: "8px",
                outline: "none",
                minHeight: "44px",
              }}
            />
            <button
              type="submit"
              style={{
                background: GOLD_GLOW,
                border: `1px solid ${GOLD}`,
                color: GOLD,
                padding: "0.65rem 1.5rem",
                fontFamily: "inherit",
                fontSize: "1rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 700,
                minHeight: "44px",
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
      style={{ background: PURPLE_DEEP, minHeight: "100vh" }}
      aria-label="Sovereign Audit Stream — Command Center"
    >
      {/* Page banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a0015 0%, #1a003a 100%)",
          borderBottom: `2px solid ${GOLD_BORDER}`,
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
        <span style={{ color: connected ? "#4ade80" : RED }}>
          {connected ? "● LIVE" : "○ CONNECTING…"}
        </span>
        &nbsp;⛓️⚓⛓️
      </div>

      <section className="hero" style={{ paddingBottom: "1rem" }}>
        <h1 style={{ color: GOLD }}>📡 AveryOS™ Sovereign Audit Stream</h1>
        <p className="auth-seal" style={{ color: GOLD_DIM }}>
          Real-time GabrielOS™ Forensic Telemetry · D1 Audit Feed
        </p>
      </section>

      {/* TARI™ stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "Total Entries",        value: String(entries.length),        color: WHITE },
          { label: "UNALIGNED_401 Hits",   value: String(unalignedHits.length),  color: RED   },
          { label: "Total TARI™ Liability", value: formatUsd(totalLiability),    color: GOLD  },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: PURPLE_DEEP,
              border: `1px solid ${GOLD_BORDER}`,
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <div style={{ fontSize: "0.7rem", color: GOLD_DIM, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Resonance Pulse Chart */}
      <ResonancePulseChart entries={entries} />

      {/* 10-Point Sovereign Roadmap */}
      <SovereignRoadmapSection />

      {/* UNALIGNED_401 Hits table */}
      <section
        className="card"
        style={{
          background: PURPLE_DEEP,
          border: `1px solid ${GOLD_BORDER}`,
          padding: 0,
          overflow: "hidden",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: `1px solid ${GOLD_BORDER}`,
            color: GOLD,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "0.82rem",
            letterSpacing: "0.06em",
          }}
        >
          ⚠️ UNALIGNED_401 HITS — Actionable Forensics
        </div>

        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.78rem",
              color: WHITE,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${GOLD_BORDER}` }}>
                {["Target IP", "Event", "TARI™ Liability", "Threat", "Forensic Pulse", "Action"].map(
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
                    style={{ borderBottom: `1px solid ${GOLD_GLOW}` }}
                  >
                    <td style={{ padding: "0.6rem 1rem", color: WHITE, whiteSpace: "nowrap" }}>
                      {entry.ip_address}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      <span
                        style={{
                          background: "rgba(255,68,68,0.12)",
                          border: `1px solid ${RED_DIM}`,
                          borderRadius: "4px",
                          padding: "0.15rem 0.45rem",
                          color: RED,
                          fontSize: "0.7rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.event_type}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 1rem", color: RED, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {formatUsd(tariLiability(entry.event_type))}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      <span
                        style={{
                          background:
                            (entry.threat_level ?? 1) >= 7
                              ? "rgba(255,68,68,0.15)"
                              : PURPLE_MID,
                          border: `1px solid ${(entry.threat_level ?? 1) >= 7 ? RED_DIM : PURPLE_BORDER}`,
                          borderRadius: "4px",
                          padding: "0.15rem 0.4rem",
                          fontSize: "0.7rem",
                          color: (entry.threat_level ?? 1) >= 7 ? RED : GOLD_DIM,
                          whiteSpace: "nowrap",
                        }}
                      >
                        TL:{entry.threat_level ?? "—"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "0.6rem 1rem",
                        color: GOLD_DIM,
                        wordBreak: "break-all",
                        maxWidth: "200px",
                        fontSize: "0.65rem",
                      }}
                    >
                      {entry.forensic_pulse}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <ExportEvidenceButton entry={entry} token={token!} />
                        <CreateInvoiceButton entry={entry} token={token!} />
                      </div>
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
        style={{ padding: 0, overflow: "hidden", marginBottom: "1.5rem", background: PURPLE_DEEP, border: `1px solid ${PURPLE_BORDER}` }}
      >
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: `1px solid ${PURPLE_BORDER}`,
            color: GOLD,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "0.82rem",
          }}
        >
          ⛓️⚓⛓️ LIVE AUDIT LOG — All Events
        </div>
        <div
          style={{
            background: "#06001a",
            padding: "0.75rem 1rem",
            maxHeight: "400px",
            overflowY: "auto",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.72rem",
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
                  borderBottom: `1px solid ${GOLD_GLOW}`,
                  padding: "3px 0",
                  color: entry.event_type === "UNALIGNED_401" ? RED : GOLD,
                }}
              >
                <span style={{ color: GOLD_DIM }}>
                  [{entry.forensic_pulse}]
                </span>{" "}
                <span style={{ fontWeight: 700 }}>{entry.event_type}</span>{" "}
                <span style={{ color: WHITE }}>→</span>{" "}
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
                    background: GOLD_GLOW,
                    border: `1px solid ${GOLD_BORDER}`,
                    color: GOLD_DIM,
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
