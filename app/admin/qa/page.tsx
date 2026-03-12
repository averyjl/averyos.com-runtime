"use client";

/**
 * app/admin/qa/page.tsx
 *
 * AveryOS™ Sovereign QA Engine Dashboard — Phase 112 / GATE 112.5
 *
 * VaultGate-protected admin page that displays the full QA run history,
 * suite results, test-level pass/fail detail, SHA-512 seals, and
 * performance metrics.  Supports triggering a new run on-demand.
 *
 * Auth: VaultGate HttpOnly cookie (aos-vault-auth) or x-vault-auth header,
 * checked on the client side the same way as /admin/forensics.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_VERSION } from "../../../lib/sovereignConstants";

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK_BG    = "#030010";
const GOLD       = "#D4AF37";
const GOLD_BG    = "rgba(212,175,55,0.07)";
const GOLD_BORD  = "rgba(212,175,55,0.28)";
const GREEN      = "#4ade80";
const RED        = "#ff4444";
const ORANGE     = "#f97316";
const WHITE      = "#ffffff";
const MUTED      = "rgba(180,200,255,0.60)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";
const PURPLE_MID = "rgba(98,0,234,0.16)";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QaTestRow {
  name:         string;
  passed:       boolean;
  durationMs:   number;
  perspective:  string;
  severity:     string;
  errorMessage: string | null;
}

interface QaSuiteRow {
  suiteName:  string;
  total:      number;
  passed:     number;
  failed:     number;
  durationMs: number;
  tests:      QaTestRow[];
}

interface QaRunResult {
  runId:         string;
  trigger:       string;
  status:        "pass" | "fail" | "partial";
  totalTests:    number;
  passedTests:   number;
  failedTests:   number;
  sha512:        string;
  kernelVersion: string;
  createdAt:     string;
  suites:        QaSuiteRow[];
}

interface QaResultRow {
  run_id:         string;
  trigger:        string;
  status:         string;
  total_tests:    number;
  passed_tests:   number;
  failed_tests:   number;
  sha512:         string;
  kernel_version: string;
  created_at:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  if (status === "pass")    return GREEN;
  if (status === "fail")    return RED;
  if (status === "partial") return ORANGE;
  return MUTED;
}

function statusIcon(status: string): string {
  if (status === "pass")    return "✅";
  if (status === "fail")    return "❌";
  if (status === "partial") return "⚠️";
  return "❓";
}

function severityColor(severity: string): string {
  if (severity === "critical") return RED;
  if (severity === "high")     return ORANGE;
  if (severity === "medium")   return GOLD;
  return MUTED;
}

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background:   GOLD_BG,
    border:       `1px solid ${GOLD_BORD}`,
    borderRadius: 12,
    padding:      "1.25rem 1.5rem",
    marginBottom: "1.25rem",
    ...extra,
  };
}

// ── Auth gate ─────────────────────────────────────────────────────────────────

function AuthGate({
  password, setPassword, authError, onSubmit, checking,
}: {
  password:    string;
  setPassword: (v: string) => void;
  authError:   string;
  onSubmit:    () => void;
  checking:    boolean;
}) {
  if (checking) {
    return (
      <main className="page" style={{ background: DARK_BG }}>
        <AnchorBanner />
        <p style={{ color: MUTED, textAlign: "center", marginTop: "4rem", fontFamily: FONT_MONO }}>
          Verifying VaultGate…
        </p>
      </main>
    );
  }
  return (
    <main className="page" style={{ background: DARK_BG }}>
      <AnchorBanner />
      <div style={{ maxWidth: 440, margin: "5rem auto", padding: "2rem", background: GOLD_BG, border: `1px solid ${GOLD_BORD}`, borderRadius: 16, textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🧪</div>
        <h2 style={{ color: GOLD, fontFamily: FONT_MONO, marginBottom: "1rem" }}>QA Engine Access</h2>
        <p style={{ color: MUTED, fontSize: "0.85rem", marginBottom: "1.25rem" }}>VaultGate authentication required.</p>
        {authError && <p style={{ color: RED, fontSize: "0.8rem", marginBottom: "1rem" }}>{authError}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="VaultGate passphrase"
          style={{
            width: "100%", padding: "0.65rem 1rem", borderRadius: 8,
            border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.6)",
            color: WHITE, fontFamily: FONT_MONO, fontSize: "0.9rem",
            marginBottom: "1rem", boxSizing: "border-box",
          }}
        />
        <button
          onClick={onSubmit}
          style={{
            width: "100%", padding: "0.7rem", borderRadius: 8,
            background: GOLD, color: "#000", fontWeight: 700,
            fontFamily: FONT_MONO, fontSize: "0.9rem", border: "none", cursor: "pointer",
          }}
        >
          🔐 Authenticate
        </button>
      </div>
    </main>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function QaDashboard() {
  const [checking,  setChecking]  = useState(true);
  const [authed,    setAuthed]    = useState(false);
  const [password,  setPassword]  = useState("");
  const [authError, setAuthError] = useState("");
  const [token,     setToken]     = useState("");

  const [running,    setRunning]    = useState(false);
  const [runResult,  setRunResult]  = useState<QaRunResult | null>(null);
  const [history,    setHistory]    = useState<QaResultRow[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [uiError,    setUiError]    = useState<AosUiError | null>(null);
  const [expandSuite, setExpandSuite] = useState<Record<string, boolean>>({});

  // ── Auth check on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem("VAULTAUTH_TOKEN");
    if (!stored) { setChecking(false); return; }
    setToken(stored);
    fetch("/api/gatekeeper/handshake-check", { headers: { "x-vault-auth": stored } })
      .then(r => r.json())
      .then((d: { status?: string }) => {
        const ok = d?.status === "LOCKED" || d?.status === "AUTHENTICATED";
        setAuthed(ok);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // ── Submit auth ────────────────────────────────────────────────────────────
  const handleAuth = useCallback(() => {
    if (!password.trim()) { setAuthError("Passphrase required."); return; }
    sessionStorage.setItem("VAULTAUTH_TOKEN", password.trim());
    setToken(password.trim());
    setAuthed(true);
    setPassword("");
    setAuthError("");
  }, [password]);

  // ── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!token) return;
    setLoadingHist(true);
    setUiError(null);
    try {
      const res = await fetch("/api/v1/qa/results?limit=20", {
        headers: { "x-vault-auth": token },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { results?: QaResultRow[] };
      setHistory(data.results ?? []);
    } catch (err) {
      setUiError(buildAosUiError(AOS_ERROR.EXTERNAL_API_ERROR, err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingHist(false);
    }
  }, [token]);

  useEffect(() => {
    if (authed) loadHistory();
  }, [authed, loadHistory]);

  // ── Trigger run ────────────────────────────────────────────────────────────
  const triggerRun = useCallback(async () => {
    if (!token || running) return;
    setRunning(true);
    setRunResult(null);
    setUiError(null);
    try {
      const res = await fetch("/api/v1/qa/run", {
        method:  "POST",
        headers: { "x-vault-auth": token, "Content-Type": "application/json" },
        body:    JSON.stringify({ trigger: "manual" }),
      });
      if (!res.ok) {
        const err = await res.json() as { detail?: string };
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as QaRunResult;
      setRunResult(data);
      await loadHistory();
    } catch (err) {
      setUiError(buildAosUiError(AOS_ERROR.EXTERNAL_API_ERROR, err instanceof Error ? err.message : String(err)));
    } finally {
      setRunning(false);
    }
  }, [token, running, loadHistory]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (checking || !authed) {
    return (
      <AuthGate
        password={password}
        setPassword={setPassword}
        authError={authError}
        onSubmit={handleAuth}
        checking={checking}
      />
    );
  }

  return (
    <main className="page" style={{ background: DARK_BG, fontFamily: FONT_MONO }}>
      <AnchorBanner />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ color: GOLD, margin: 0, fontSize: "1.4rem" }}>🧪 AveryOS™ QA Engine Dashboard</h1>
            <p style={{ color: MUTED, margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
              Phase 112 · Kernel {KERNEL_VERSION} · World-Class Sovereign QA
            </p>
          </div>
          <button
            onClick={triggerRun}
            disabled={running}
            style={{
              background:  running ? PURPLE_MID : GOLD,
              color:       running ? MUTED : "#000",
              border:      "none",
              borderRadius: 8,
              padding:     "0.65rem 1.5rem",
              fontWeight:  700,
              fontFamily:  FONT_MONO,
              fontSize:    "0.85rem",
              cursor:      running ? "not-allowed" : "pointer",
            }}
          >
            {running ? "⏳ Running…" : "▶ Run QA Suite"}
          </button>
        </div>

        {uiError && <SovereignErrorBanner error={uiError} />}

        {/* ── Latest run result ────────────────────────────────────────── */}
        {runResult && (
          <div style={card({ borderColor: statusColor(runResult.status) })}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "1.5rem" }}>{statusIcon(runResult.status)}</span>
              <div>
                <div style={{ color: statusColor(runResult.status), fontWeight: 700, fontSize: "1rem" }}>
                  {runResult.status.toUpperCase()} — {runResult.passedTests}/{runResult.totalTests} tests passed
                </div>
                <div style={{ color: MUTED, fontSize: "0.75rem" }}>
                  Run ID: {runResult.runId} · {runResult.createdAt}
                </div>
              </div>
            </div>

            {/* SHA-512 seal */}
            <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "0.5rem 0.75rem", marginBottom: "1rem" }}>
              <span style={{ color: MUTED, fontSize: "0.7rem" }}>SHA-512 Seal: </span>
              <span style={{ color: GOLD, fontSize: "0.7rem", wordBreak: "break-all" }}>{runResult.sha512}</span>
            </div>

            {/* Suite summary */}
            {runResult.suites?.map((suite) => (
              <div key={suite.suiteName} style={{ marginBottom: "0.75rem" }}>
                <button
                  onClick={() => setExpandSuite(prev => ({ ...prev, [suite.suiteName]: !prev[suite.suiteName] }))}
                  style={{
                    background: "transparent", border: `1px solid ${GOLD_BORD}`,
                    borderRadius: 6, padding: "0.4rem 0.75rem",
                    color: suite.failed > 0 ? RED : GREEN,
                    fontFamily: FONT_MONO, fontSize: "0.8rem",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    display: "flex", justifyContent: "space-between",
                  }}
                >
                  <span>
                    {suite.failed > 0 ? "❌" : "✅"} {suite.suiteName}
                    &nbsp;({suite.passed}/{suite.total} · {suite.durationMs}ms)
                  </span>
                  <span>{expandSuite[suite.suiteName] ? "▲" : "▼"}</span>
                </button>

                {expandSuite[suite.suiteName] && (
                  <div style={{ paddingLeft: "1rem", paddingTop: "0.5rem" }}>
                    {suite.tests.map((t, i) => (
                      <div key={i} style={{
                        display: "flex", gap: "0.5rem", alignItems: "flex-start",
                        padding: "0.3rem 0.5rem", borderBottom: `1px solid rgba(255,255,255,0.05)`,
                      }}>
                        <span style={{ fontSize: "0.75rem", minWidth: 16 }}>{t.passed ? "✅" : "❌"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: t.passed ? WHITE : RED, fontSize: "0.78rem" }}>{t.name}</div>
                          {!t.passed && t.errorMessage && (
                            <div style={{ color: ORANGE, fontSize: "0.7rem", marginTop: "0.2rem" }}>
                              ⚠ {t.errorMessage}
                            </div>
                          )}
                        </div>
                        <div style={{ color: MUTED, fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                          <span style={{ color: severityColor(t.severity) }}>{t.severity}</span>
                          &nbsp;·&nbsp;{t.perspective}
                          &nbsp;·&nbsp;{t.durationMs}ms
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Run history ──────────────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ color: GOLD, margin: 0, fontSize: "1rem" }}>📜 QA Run History</h2>
            <button
              onClick={loadHistory}
              disabled={loadingHist}
              style={{ background: "transparent", border: `1px solid ${GOLD_BORD}`, color: GOLD, borderRadius: 6, padding: "0.3rem 0.75rem", fontFamily: FONT_MONO, fontSize: "0.75rem", cursor: "pointer" }}
            >
              {loadingHist ? "Loading…" : "🔄 Refresh"}
            </button>
          </div>

          {history.length === 0 ? (
            <p style={{ color: MUTED, fontSize: "0.85rem", textAlign: "center", padding: "2rem" }}>
              No QA runs found. Click ▶ Run QA Suite to start the first run.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${GOLD_BORD}` }}>
                    {["Run ID", "Trigger", "Status", "Tests", "Pass", "Fail", "Version", "Created"].map(h => (
                      <th key={h} style={{ color: GOLD, textAlign: "left", padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.run_id} style={{ borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
                      <td style={{ color: MUTED, padding: "0.45rem 0.75rem", fontFamily: FONT_MONO }}>{row.run_id.slice(0, 20)}…</td>
                      <td style={{ color: WHITE, padding: "0.45rem 0.75rem" }}>{row.trigger}</td>
                      <td style={{ color: statusColor(row.status), padding: "0.45rem 0.75rem", fontWeight: 700 }}>
                        {statusIcon(row.status)} {row.status}
                      </td>
                      <td style={{ color: WHITE, padding: "0.45rem 0.75rem" }}>{row.total_tests}</td>
                      <td style={{ color: GREEN, padding: "0.45rem 0.75rem" }}>{row.passed_tests}</td>
                      <td style={{ color: row.failed_tests > 0 ? RED : GREEN, padding: "0.45rem 0.75rem" }}>{row.failed_tests}</td>
                      <td style={{ color: MUTED, padding: "0.45rem 0.75rem" }}>{row.kernel_version}</td>
                      <td style={{ color: MUTED, padding: "0.45rem 0.75rem", whiteSpace: "nowrap" }}>{row.created_at.slice(0, 19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{ marginTop: "3rem", textAlign: "center", color: MUTED, fontSize: "0.7rem", borderTop: `1px solid ${GOLD_BORD}`, paddingTop: "1rem" }}>
          ⛓️⚓⛓️ AveryOS™ Sovereign QA Engine · Phase 112 · {KERNEL_VERSION} · CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
        </div>
      </div>
    </main>
  );
}
