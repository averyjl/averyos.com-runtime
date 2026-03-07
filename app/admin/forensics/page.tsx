"use client";

/**
 * AveryOS™ Forensic Dashboard
 *
 * Password-protected dashboard that organises edge-request traffic from the
 * anchor_audit_logs D1 table by RayID, ASN (country), and path.  Highlights
 * suspicious activity on sensitive paths such as /.env and /hooks.
 *
 * Auth: same VAULTAUTH_TOKEN / sessionStorage gate used by /admin.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_VERSION } from "../../../lib/sovereignConstants";

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK_BG     = "#060010";
const PURPLE_MID  = "rgba(98,0,234,0.18)";
const GOLD        = "#ffd700";
const RED         = "#ff4444";
const GREEN       = "#4ade80";
const ORANGE      = "#f97316";
const WHITE       = "#ffffff";
const MUTED       = "rgba(180,200,255,0.65)";

// Paths that indicate probing / attack attempts
const SENSITIVE_PATHS = new Set(["/.env", "/hooks", "/.git", "/wp-admin", "/xmlrpc.php"]);

interface AuditRow {
  id: number;
  ray_id: string;
  ip_address: string;
  path: string;
  asn: string;
  event_type: string;
  anchored_at: string;
  timestamp: string;
}

interface GroupedEntry {
  asn: string;
  path: string;
  count: number;
  rayIds: string[];
  ips: string[];
  isSensitive: boolean;
}

function groupRows(rows: AuditRow[]): GroupedEntry[] {
  const map = new Map<string, GroupedEntry>();
  for (const row of rows) {
    const key = `${row.asn}||${row.path}`;
    const existing = map.get(key);
    const isSensitive = SENSITIVE_PATHS.has(row.path) ||
      row.path.includes("/.env") || row.path.includes("/hooks");
    if (existing) {
      existing.count++;
      if (!existing.rayIds.includes(row.ray_id)) existing.rayIds.push(row.ray_id);
      if (!existing.ips.includes(row.ip_address)) existing.ips.push(row.ip_address);
    } else {
      map.set(key, {
        asn: row.asn || "UNKNOWN",
        path: row.path || "/",
        count: 1,
        rayIds: row.ray_id ? [row.ray_id] : [],
        ips: row.ip_address ? [row.ip_address] : [],
        isSensitive,
      });
    }
  }
  // Sort: sensitive first, then by count desc
  return Array.from(map.values()).sort(
    (a, b) => Number(b.isSensitive) - Number(a.isSensitive) || b.count - a.count
  );
}

export default function ForensicDashboard() {
  const [authed, setAuthed]         = useState(false);
  const [checking, setChecking]     = useState(true);
  const [password, setPassword]     = useState("");
  const [authError, setAuthError]   = useState("");
  const [rows, setRows]             = useState<AuditRow[]>([]);
  const [grouped, setGrouped]       = useState<GroupedEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<AosUiError | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [limit, setLimit]           = useState(500);

  // ── VaultGate auth check on mount ────────────────────────────────────────
  // On mount, probe the forensics API — if the browser carries a valid
  // `aos-vault-auth` HttpOnly cookie (set by a previous login), the request
  // will succeed and we skip the password gate.  The token is NEVER stored
  // in sessionStorage or any browser-accessible storage from this page.
  useEffect(() => {
    fetch("/api/v1/forensics/rayid-log?limit=1", { credentials: "same-origin" })
      .then(r => {
        if (r.ok) { setAuthed(true); }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // ── Password submit — sets HttpOnly Secure cookie via POST ───────────────
  // The token is sent to /api/v1/vault/auth which validates it server-side
  // and responds with `Set-Cookie: aos-vault-auth=...; HttpOnly; Secure`.
  // The raw token never touches browser-accessible storage.
  const handlePasswordSubmit = async () => {
    setAuthError("");
    try {
      const res = await fetch("/api/v1/vault/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: password }),
      });
      if (res.ok) {
        setAuthed(true);
      } else {
        setAuthError("⛔ Invalid token. Access denied.");
      }
    } catch {
      setAuthError("⛔ Auth check failed. Try again.");
    }
  };

  // ── Data fetch — credentials: "same-origin" sends the HttpOnly cookie ────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/forensics/rayid-log?limit=${limit}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(msg);
      }
      const data = await res.json() as { rows: AuditRow[] };
      setRows(data.rows ?? []);
      setGrouped(groupRows(data.rows ?? []));
      setLastRefresh(new Date().toISOString());
    } catch (err) {
      setError(buildAosUiError(AOS_ERROR.UNKNOWN, err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  // ── Render: initial auth check ────────────────────────────────────────────
  if (checking) {
    return (
      <main className="page" style={{ background: DARK_BG }}>
        <AnchorBanner />
        <p style={{ color: MUTED, textAlign: "center", marginTop: "4rem" }}>
          Verifying VaultGate…
        </p>
      </main>
    );
  }

  // ── Render: password gate ─────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="page" style={{ background: DARK_BG }}>
        <AnchorBanner />
        <div style={{
          maxWidth: 420,
          margin: "5rem auto",
          padding: "2rem",
          background: PURPLE_MID,
          border: `1px solid rgba(120,60,255,0.35)`,
          borderRadius: 16,
          textAlign: "center",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ color: WHITE, marginBottom: "1rem" }}>Forensic Dashboard</h2>
          <p style={{ color: MUTED, marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            Enter your VAULTAUTH_TOKEN to access the Sovereign Forensic Dashboard.
          </p>
          <input
            type="password"
            placeholder="VAULTAUTH_TOKEN"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: 8,
              border: `1px solid rgba(120,60,255,0.4)`,
              background: "rgba(0,0,0,0.4)",
              color: WHITE,
              marginBottom: "0.75rem",
              fontFamily: "JetBrains Mono, monospace",
              boxSizing: "border-box",
            }}
          />
          {authError && (
            <p style={{ color: RED, marginBottom: "0.75rem", fontSize: "0.85rem" }}>{authError}</p>
          )}
          <button
            onClick={handlePasswordSubmit}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: 8,
              background: "rgba(120,60,255,0.6)",
              border: "none",
              color: WHITE,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Unlock Dashboard
          </button>
        </div>
        <FooterBadge />
      </main>
    );
  }

  // ── Render: forensic dashboard ────────────────────────────────────────────
  const sensitiveRows = grouped.filter(g => g.isSensitive);
  const normalRows    = grouped.filter(g => !g.isSensitive);

  return (
    <main className="page" style={{ background: DARK_BG, minHeight: "100vh" }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: WHITE, fontSize: "1.5rem", marginBottom: "0.4rem" }}>
          🔬 Forensic Dashboard
        </h1>
        <p style={{ color: MUTED, fontSize: "0.85rem" }}>
          AveryOS™ edge-request telemetry — Kernel {KERNEL_VERSION} |{" "}
          Status: <span style={{ color: GREEN, fontWeight: "bold" }}>LOCKED_IN_PARITY</span>
          {" "}| 7/7 Repos Aligned
        </p>
        {lastRefresh && (
          <p style={{ color: MUTED, fontSize: "0.75rem", marginTop: "0.25rem" }}>
            Last refresh: {lastRefresh}
          </p>
        )}
      </div>

      {error && <SovereignErrorBanner error={error} />}

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <select
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(120,60,255,0.35)",
            color: WHITE,
            cursor: "pointer",
          }}
        >
          <option value={100}>Last 100 requests</option>
          <option value={500}>Last 500 requests</option>
          <option value={1000}>Last 1,000 requests</option>
          <option value={5000}>Last 5,000 requests</option>
        </select>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: 8,
            background: loading ? "rgba(120,60,255,0.2)" : "rgba(120,60,255,0.6)",
            border: "1px solid rgba(120,60,255,0.4)",
            color: WHITE,
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "⏳ Refreshing…" : "🔄 Refresh"}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: "flex",
        gap: "1rem",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
      }}>
        {[
          { label: "Total Requests", value: rows.length, color: WHITE },
          { label: "Unique Paths", value: new Set(rows.map(r => r.path)).size, color: GREEN },
          { label: "Unique IPs", value: new Set(rows.map(r => r.ip_address)).size, color: ORANGE },
          { label: "⚠️ Suspicious Paths", value: sensitiveRows.reduce((s, g) => s + g.count, 0), color: RED },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: "1 1 140px",
            padding: "0.75rem 1rem",
            background: "rgba(9,16,34,0.8)",
            border: "1px solid rgba(120,148,255,0.2)",
            borderRadius: 10,
          }}>
            <div style={{ color: stat.color, fontSize: "1.6rem", fontWeight: "bold" }}>
              {stat.value.toLocaleString()}
            </div>
            <div style={{ color: MUTED, fontSize: "0.75rem" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Suspicious paths section */}
      {sensitiveRows.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: RED, fontSize: "1.1rem", marginBottom: "0.75rem" }}>
            🚨 Suspicious Path Probes
          </h2>
          <TrafficTable rows={sensitiveRows} highlightColor={RED} />
        </section>
      )}

      {/* All traffic section */}
      <section>
        <h2 style={{ color: GOLD, fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          📡 All Traffic — Grouped by ASN × Path
        </h2>
        {loading && (
          <p style={{ color: MUTED }}>⏳ Loading forensic data from D1…</p>
        )}
        {!loading && normalRows.length === 0 && !error && (
          <p style={{ color: MUTED }}>No requests logged yet. Edge traffic will appear here once the RayID Vault is active.</p>
        )}
        {!loading && normalRows.length > 0 && (
          <TrafficTable rows={normalRows} highlightColor={GREEN} />
        )}
      </section>

      <FooterBadge />
    </main>
  );
}

// ── Sub-component: Traffic table ──────────────────────────────────────────────
function TrafficTable({
  rows,
  highlightColor,
}: {
  rows: GroupedEntry[];
  highlightColor: string;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: "JetBrains Mono, Courier New, monospace",
        fontSize: "0.8rem",
        color: MUTED,
      }}>
        <thead>
          <tr style={{ background: "rgba(9,16,34,0.9)", color: WHITE }}>
            {["ASN / Country", "Path", "Hits", "Unique IPs", "Sample RayIDs"].map(h => (
              <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", borderBottom: "1px solid rgba(120,148,255,0.2)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? "rgba(9,16,34,0.6)" : "rgba(9,16,34,0.3)",
                borderBottom: "1px solid rgba(120,148,255,0.08)",
              }}
            >
              <td style={{ padding: "0.4rem 0.75rem", color: highlightColor }}>{row.asn}</td>
              <td style={{ padding: "0.4rem 0.75rem", wordBreak: "break-all" }}>{row.path}</td>
              <td style={{ padding: "0.4rem 0.75rem", color: row.isSensitive ? RED : WHITE, fontWeight: "bold" }}>
                {row.count.toLocaleString()}
              </td>
              <td style={{ padding: "0.4rem 0.75rem" }}>{row.ips.length}</td>
              <td style={{ padding: "0.4rem 0.75rem", opacity: 0.7, fontSize: "0.72rem" }}>
                {row.rayIds.slice(0, 3).join(", ")}{row.rayIds.length > 3 ? ` +${row.rayIds.length - 3}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
