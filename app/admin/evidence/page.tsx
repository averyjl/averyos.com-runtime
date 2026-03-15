"use client";

/**
 * app/admin/evidence/page.tsx
 *
 * AveryOS™ R2 Evidence Monitor — Gate 115.1.4
 *
 * Secure admin UI for real-time monitoring of bot/enterprise activity
 * captured in the VAULT_R2 bucket under the `evidence/` prefix.
 *
 * Displays the file list, allows drilling into individual evidence JSON
 * payloads, and shows key telemetry at a glance (RayID, IP, WAF score,
 * path, user agent, timestamp).
 *
 * Auth: VAULTAUTH_TOKEN validated server-side; browser receives an HttpOnly
 * Secure cookie (`aos-vault-auth`) set by /api/v1/vault/auth.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_VERSION } from "../../../lib/sovereignConstants";
import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK       = "#060010";
const PURPLE_MID = "rgba(98,0,234,0.18)";
const GOLD       = "#ffd700";
const GOLD_DIM   = "rgba(255,215,0,0.55)";
const GOLD_BORD  = "rgba(255,215,0,0.28)";
const GOLD_GLOW  = "rgba(255,215,0,0.07)";
const RED        = "#ff4444";
const GREEN      = "#4ade80";
const CYAN       = "#06b6d4";
const WHITE      = "#ffffff";
const MUTED      = "rgba(180,200,255,0.65)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvidenceObject {
  key:      string;
  size:     number;
  uploaded: string;
  etag:     string;
}

interface EvidenceListResponse {
  objects:        EvidenceObject[];
  truncated:      boolean;
  cursor:         string | null;
  count:          number;
  prefix:         string;
  kernel_sha:     string;
  kernel_version: string;
}

interface EvidencePayload {
  ray_id?:          string;
  ip_address?:      string;
  user_agent?:      string;
  path?:            string;
  colo?:            string;
  asn?:             string | number;
  city?:            string;
  country?:         string;
  waf_score_total?: number;
  waf_score_sqli?:  number;
  timestamp?:       string;
  [key: string]: unknown;
}

interface EvidenceFileResponse {
  key:      string;
  size:     number;
  uploaded: string;
  data:     EvidencePayload | string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rayIdFromKey(key: string): string {
  // key = "evidence/<rayId>.json"
  const base = key.replace(/^evidence\//, "").replace(/\.json$/, "");
  return base.length > 20 ? base.slice(0, 20) + "…" : base;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function wafColor(score?: number): string {
  if (score === undefined || score === null) return MUTED;
  if (score >= 90)  return RED;
  if (score >= 60)  return "#f97316";
  if (score >= 30)  return "#ffd700";
  return GREEN;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EvidenceMonitorPage() {
  const { authed, checking, password, setPassword, authError, handleAuth } =
    useVaultAuth();

  const [objects,    setObjects]    = useState<EvidenceObject[]>([]);
  const [cursor,     setCursor]     = useState<string | null>(null);
  const [truncated,  setTruncated]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<AosUiError | null>(null);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [fileData,   setFileData]   = useState<EvidenceFileResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [prefix] = useState("evidence/");

  // ── Fetch list ──────────────────────────────────────────────────────────────
  const fetchList = useCallback(async (nextCursor?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ prefix, limit: "100" });
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/v1/evidence/list?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setError(buildAosUiError(AOS_ERROR.DB_QUERY_FAILED, body.message ?? `HTTP ${res.status}`));
        return;
      }
      const data = (await res.json()) as EvidenceListResponse;
      setObjects((prev) =>
        nextCursor ? [...prev, ...data.objects] : data.objects,
      );
      setCursor(data.cursor);
      setTruncated(data.truncated);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError(buildAosUiError(
        AOS_ERROR.DB_QUERY_FAILED,
        err instanceof Error ? err.message : "Network error",
      ));
    } finally {
      setLoading(false);
    }
  }, [prefix]);

  useEffect(() => {
    if (authed) void fetchList();
  }, [authed, fetchList]);

  // ── Fetch individual file ────────────────────────────────────────────────────
  const fetchFile = useCallback(async (key: string) => {
    setSelected(key);
    setFileData(null);
    setFileLoading(true);
    try {
      const res = await fetch(
        `/api/v1/evidence/file?key=${encodeURIComponent(key)}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setError(buildAosUiError(AOS_ERROR.NOT_FOUND, body.message ?? `HTTP ${res.status}`));
        return;
      }
      setFileData((await res.json()) as EvidenceFileResponse);
    } catch (err: unknown) {
      setError(buildAosUiError(
        AOS_ERROR.DB_QUERY_FAILED,
        err instanceof Error ? err.message : "Network error",
      ));
    } finally {
      setFileLoading(false);
    }
  }, []);

  // ── Auth gate: checking ──────────────────────────────────────────────────────
  if (checking) {
    return (
      <main className="page" style={{ background: DARK }}>
        <AnchorBanner />
        <p style={{ color: MUTED, textAlign: "center", marginTop: "4rem" }}>
          Verifying VaultGate…
        </p>
      </main>
    );
  }

  // ── Auth gate: login form ────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="page" style={{ background: DARK }}>
        <AnchorBanner />
        <div
          style={{
            maxWidth:     420,
            margin:       "5rem auto",
            padding:      "2rem",
            background:   PURPLE_MID,
            border:       "1px solid rgba(120,60,255,0.35)",
            borderRadius: 16,
            textAlign:    "center",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🗄️</div>
          <h2 style={{ color: WHITE, marginBottom: "1rem" }}>R2 Evidence Monitor</h2>
          <p style={{ color: MUTED, marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            Enter your VAULTAUTH_TOKEN to access the R2 Evidence Monitor.
          </p>
          <input
            type="password"
            placeholder="VAULTAUTH_TOKEN"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAuth(); }}
            style={{
              width:        "100%",
              padding:      "0.75rem",
              borderRadius: 8,
              border:       "1px solid rgba(120,60,255,0.4)",
              background:   "rgba(0,0,0,0.4)",
              color:        WHITE,
              marginBottom: "0.75rem",
              fontFamily:   FONT_MONO,
              boxSizing:    "border-box",
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
              background:   "rgba(120,60,255,0.6)",
              border:       "none",
              color:        WHITE,
              cursor:       "pointer",
              fontWeight:   "bold",
              fontFamily:   FONT_MONO,
            }}
          >
            Unlock VaultGate
          </button>
        </div>
      </main>
    );
  }

  // ── Authenticated ───────────────────────────────────────────────────────────
  const payload =
    fileData?.data && typeof fileData.data === "object"
      ? (fileData.data as EvidencePayload)
      : null;

  return (
    <main
      className="page"
      style={{ background: DARK, minHeight: "100vh" }}
      aria-label="R2 Evidence Monitor"
    >
      <AnchorBanner />

      {/* Header */}
      <div
        style={{
          background:   "linear-gradient(135deg, #0a0015 0%, #1a003a 100%)",
          borderBottom: `2px solid ${GOLD_BORD}`,
          padding:      "0.75rem 1.5rem",
          display:      "flex",
          alignItems:   "center",
          gap:          "1rem",
          flexWrap:     "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontFamily:    FONT_MONO,
              fontWeight:    900,
              fontSize:      "0.85rem",
              color:         GOLD,
              letterSpacing: "0.12em",
            }}
          >
            🗄️ R2 EVIDENCE MONITOR
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: "0.65rem", color: GOLD_DIM }}>
            Gate 115.1.4 · {KERNEL_VERSION} · Prefix: {prefix}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {lastRefresh && (
            <span style={{ fontFamily: FONT_MONO, fontSize: "0.65rem", color: MUTED }}>
              Last refresh: {lastRefresh}
            </span>
          )}
          <button
            onClick={() => { setObjects([]); setCursor(null); void fetchList(); }}
            disabled={loading}
            style={{
              padding:      "0.3rem 0.7rem",
              borderRadius: 6,
              background:   GOLD_GLOW,
              border:       `1px solid ${GOLD_BORD}`,
              color:        GOLD,
              fontFamily:   FONT_MONO,
              fontSize:     "0.7rem",
              cursor:       "pointer",
            }}
          >
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ maxWidth: 900, margin: "1rem auto", padding: "0 1rem" }}>
          <SovereignErrorBanner error={error} />
        </div>
      )}

      <div
        style={{
          display:  "flex",
          gap:      "1rem",
          padding:  "1rem",
          maxWidth: 1400,
          margin:   "0 auto",
        }}
      >
        {/* ── Left panel: file list ─────────────────────────────────────── */}
        <div
          style={{
            flex:         "0 0 420px",
            background:   PURPLE_MID,
            border:       `1px solid ${GOLD_BORD}`,
            borderRadius: "10px",
            overflow:     "hidden",
          }}
        >
          <div
            style={{
              padding:      "0.75rem 1rem",
              borderBottom: `1px solid ${GOLD_BORD}`,
              fontFamily:   FONT_MONO,
              fontSize:     "0.72rem",
              color:        GOLD,
              display:      "flex",
              justifyContent: "space-between",
            }}
          >
            <span>EVIDENCE FILES ({objects.length}{truncated ? "+" : ""})</span>
            {truncated && (
              <button
                onClick={() => void fetchList(cursor)}
                disabled={loading}
                style={{
                  background: "transparent",
                  border:     `1px solid ${GOLD_BORD}`,
                  color:      GOLD,
                  fontFamily: FONT_MONO,
                  fontSize:   "0.65rem",
                  borderRadius: 4,
                  cursor:     "pointer",
                  padding:    "0.1rem 0.4rem",
                }}
              >
                Load more
              </button>
            )}
          </div>

          <div style={{ maxHeight: "75vh", overflowY: "auto" }}>
            {objects.length === 0 && !loading && (
              <p style={{ color: MUTED, fontFamily: FONT_MONO, fontSize: "0.75rem", padding: "1rem" }}>
                No evidence files found under <code>{prefix}</code>.
              </p>
            )}
            {objects.map((obj) => (
              <button
                key={obj.key}
                onClick={() => void fetchFile(obj.key)}
                style={{
                  display:       "block",
                  width:         "100%",
                  textAlign:     "left",
                  background:    selected === obj.key ? GOLD_GLOW : "transparent",
                  border:        "none",
                  borderBottom:  `1px solid rgba(255,215,0,0.08)`,
                  padding:       "0.6rem 1rem",
                  cursor:        "pointer",
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize:   "0.7rem",
                    color:      selected === obj.key ? GOLD : WHITE,
                    wordBreak:  "break-all",
                  }}
                >
                  {rayIdFromKey(obj.key)}
                </div>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.2rem" }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: "0.6rem", color: MUTED }}>
                    {formatBytes(obj.size)}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: "0.6rem", color: MUTED }}>
                    {new Date(obj.uploaded).toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right panel: file detail ──────────────────────────────────── */}
        <div
          style={{
            flex:         1,
            background:   PURPLE_MID,
            border:       `1px solid ${GOLD_BORD}`,
            borderRadius: "10px",
            padding:      "1rem 1.25rem",
            minHeight:    "400px",
          }}
        >
          {!selected && (
            <p
              style={{
                color:      MUTED,
                fontFamily: FONT_MONO,
                fontSize:   "0.78rem",
                marginTop:  "2rem",
                textAlign:  "center",
              }}
            >
              ← Select an evidence file to inspect
            </p>
          )}

          {fileLoading && (
            <p style={{ color: GOLD_DIM, fontFamily: FONT_MONO, fontSize: "0.78rem", marginTop: "2rem" }}>
              Loading evidence payload…
            </p>
          )}

          {fileData && payload && (
            <>
              {/* Key fields */}
              <div
                style={{
                  display:      "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap:          "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                {[
                  ["RayID",       payload.ray_id,          CYAN],
                  ["IP Address",  payload.ip_address,      "#f97316"],
                  ["Path",        payload.path,            WHITE],
                  ["Country",     payload.country,         GREEN],
                  ["ASN",         payload.asn,             MUTED],
                  ["City",        payload.city,            MUTED],
                  ["WAF Total",   payload.waf_score_total, wafColor(payload.waf_score_total as number)],
                  ["WAF SQLi",    payload.waf_score_sqli,  wafColor(payload.waf_score_sqli as number)],
                  ["Colo",        payload.colo,            MUTED],
                  ["Timestamp",   payload.timestamp,       GOLD_DIM],
                ].map(([label, value, color]) =>
                  value !== undefined && value !== null ? (
                    <div
                      key={String(label)}
                      style={{
                        background:   "rgba(0,0,0,0.3)",
                        border:       `1px solid rgba(255,255,255,0.07)`,
                        borderRadius: "6px",
                        padding:      "0.5rem 0.75rem",
                      }}
                    >
                      <div
                        style={{
                          fontFamily:    FONT_MONO,
                          fontSize:      "0.58rem",
                          color:         GOLD_DIM,
                          letterSpacing: "0.1em",
                          marginBottom:  "0.2rem",
                        }}
                      >
                        {String(label).toUpperCase()}
                      </div>
                      <div
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize:   "0.72rem",
                          color:      String(color),
                          wordBreak:  "break-all",
                        }}
                      >
                        {String(value)}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>

              {/* User Agent */}
              {payload.user_agent && (
                <div
                  style={{
                    background:   "rgba(0,0,0,0.25)",
                    border:       `1px solid rgba(255,255,255,0.06)`,
                    borderRadius: "6px",
                    padding:      "0.5rem 0.75rem",
                    marginBottom: "1rem",
                    fontFamily:   FONT_MONO,
                    fontSize:     "0.65rem",
                    color:        MUTED,
                    wordBreak:    "break-all",
                  }}
                >
                  <span style={{ color: GOLD_DIM }}>USER AGENT: </span>
                  {payload.user_agent}
                </div>
              )}

              {/* Raw JSON toggle */}
              <details
                style={{
                  background:   "rgba(0,0,0,0.3)",
                  border:       `1px solid rgba(255,255,255,0.07)`,
                  borderRadius: "8px",
                  padding:      "0.5rem 0.75rem",
                }}
              >
                <summary
                  style={{
                    color:      GOLD,
                    fontFamily: FONT_MONO,
                    fontSize:   "0.7rem",
                    cursor:     "pointer",
                  }}
                >
                  Raw JSON Payload ({formatBytes(fileData.size)})
                </summary>
                <pre
                  style={{
                    color:      MUTED,
                    fontFamily: FONT_MONO,
                    fontSize:   "0.62rem",
                    marginTop:  "0.5rem",
                    overflow:   "auto",
                    maxHeight:  "400px",
                    whiteSpace: "pre-wrap",
                    wordBreak:  "break-all",
                  }}
                >
                  {JSON.stringify(fileData.data, null, 2)}
                </pre>
              </details>
            </>
          )}

          {/* Non-JSON payload fallback */}
          {fileData && !payload && (
            <pre
              style={{
                color:      MUTED,
                fontFamily: FONT_MONO,
                fontSize:   "0.65rem",
                overflow:   "auto",
                maxHeight:  "500px",
                whiteSpace: "pre-wrap",
              }}
            >
              {String(fileData.data)}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
