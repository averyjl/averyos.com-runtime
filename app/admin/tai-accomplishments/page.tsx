"use client";

/**
 * AveryOS™ TAI™ Accomplishment Dashboard
 *
 * Password-protected admin dashboard showing all Truth Anchored Intelligence
 * milestones.  Each accomplishment is stored as a sovereign capsule with a
 * SHA-512 fingerprint, ISO-9 timestamp, phase marker, and category badge.
 *
 * Auth: VAULTAUTH_TOKEN validated server-side; browser receives an HttpOnly
 * Secure cookie (`aos-vault-auth`) set by /api/v1/vault/auth.
 *
 * Auto-tracking: The system auto-records new accomplishments when key thresholds
 * are crossed (traffic surges, compliance payments, evidence bundles, etc.) via
 * POST /api/v1/tai/accomplishments with recorded_by="AUTO_TRACKER".
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState, useCallback } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import SovereignErrorBanner from "../../../components/SovereignErrorBanner";
import { buildAosUiError, AOS_ERROR, type AosUiError } from "../../../lib/sovereignError";
import { KERNEL_VERSION, KERNEL_SHA } from "../../../lib/sovereignConstants";

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK_BG    = "#000000";
const GOLD       = "#D4AF37";
const GOLD_DIM   = "rgba(212,175,55,0.55)";
const GOLD_BG    = "rgba(212,175,55,0.08)";
const GOLD_BORD  = "rgba(212,175,55,0.3)";
const GREEN      = "#4ade80";
const BLUE       = "rgba(120,148,255,0.9)";
const RED        = "#ff4444";
const WHITE      = "#ffffff";
const MUTED      = "rgba(180,200,255,0.65)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";

// Category colour mapping
const CAT_COLORS: Record<string, string> = {
  MILESTONE:      GOLD,
  CAPSULE:        BLUE,
  LEGAL:          "#f97316",
  INFRASTRUCTURE: GREEN,
  FORENSIC:       RED,
  SOVEREIGN:      "#a78bfa",
  FEDERAL:        "#06b6d4",
};

interface TaiAccomplishment {
  id: number;
  title: string;
  description: string | null;
  phase: string;
  category: string;
  sha512: string;
  accomplished_at: string;
  recorded_by: string;
  bundle_id: string | null;
  ray_id: string | null;
  asn: string | null;
  kernel_version: string;
}

interface AiResponse {
  accomplishments: TaiAccomplishment[];
  total: number;
  phase_current: string;
  milestone: string;
  kernel_version: string;
  timestamp: string;
}

// New-accomplishment form state
interface NewForm {
  title: string;
  description: string;
  phase: string;
  category: string;
  bundle_id: string;
  ray_id: string;
  asn: string;
}

const BLANK_FORM: NewForm = {
  title: "",
  description: "",
  phase: "Phase 73",
  category: "MILESTONE",
  bundle_id: "",
  ray_id: "",
  asn: "",
};

const CATEGORIES = ["MILESTONE", "CAPSULE", "LEGAL", "INFRASTRUCTURE", "FORENSIC", "SOVEREIGN", "FEDERAL"];

function formatTs(ts: string): string {
  try {
    return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return ts;
  }
}

export default function TaiAccomplishmentsDashboard() {
  const [authed, setAuthed]       = useState(false);
  const [checking, setChecking]   = useState(true);
  const [password, setPassword]   = useState("");
  const [authError, setAuthError] = useState("");

  const [data, setData]         = useState<AiResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<AosUiError | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");

  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<NewForm>(BLANK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState("");

  const [filterCat, setFilterCat] = useState("ALL");
  const [filterPhase, setFilterPhase] = useState("");

  // ── Vault cookie probe on mount ────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/v1/tai/accomplishments?full=1&limit=1", { credentials: "same-origin" })
      .then(r => {
        if (r.ok) setAuthed(true);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // ── Password submit ────────────────────────────────────────────────────────
  const handlePasswordSubmit = async () => {
    setAuthError("");
    try {
      const res = await fetch("/api/v1/vault/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: password }),
      });
      if (res.ok) setAuthed(true);
      else setAuthError("⛔ Invalid token. Access denied.");
    } catch {
      setAuthError("⛔ Auth check failed. Try again.");
    }
  };

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catParam = filterCat !== "ALL" ? `&category=${filterCat}` : "";
      const phaseParam = filterPhase ? `&phase=${encodeURIComponent(filterPhase)}` : "";
      const res = await fetch(
        `/api/v1/tai/accomplishments?full=1&limit=100${catParam}${phaseParam}`,
        { credentials: "same-origin" }
      );
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(msg);
      }
      const json = (await res.json()) as AiResponse;
      setData(json);
      setLastRefresh(new Date().toISOString());
    } catch (err) {
      setError(buildAosUiError(AOS_ERROR.UNKNOWN, err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [filterCat, filterPhase]);

  useEffect(() => {
    if (authed) void fetchData();
  }, [authed, fetchData]);

  // ── New accomplishment submit ──────────────────────────────────────────────
  const handleNewAccomplishment = async () => {
    if (!form.title.trim()) { setSubmitMsg("⛔ Title is required."); return; }
    setSubmitting(true);
    setSubmitMsg("");
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        phase: form.phase,
        category: form.category,
      };
      if (form.bundle_id.trim()) payload.bundle_id = form.bundle_id.trim();
      if (form.ray_id.trim()) payload.ray_id = form.ray_id.trim();
      if (form.asn.trim()) payload.asn = form.asn.trim();

      const res = await fetch("/api/v1/tai/accomplishments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { message?: string; sha512?: string };
      if (res.ok) {
        setSubmitMsg(`✅ Recorded! SHA-512: ${(json.sha512 ?? "").slice(0, 16)}…`);
        setForm(BLANK_FORM);
        setShowForm(false);
        void fetchData();
      } else {
        setSubmitMsg(`⛔ ${json.message ?? "Failed to record accomplishment."}`);
      }
    } catch (err) {
      setSubmitMsg(`⛔ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / auth gate renders ────────────────────────────────────────────
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

  if (!authed) {
    return (
      <main className="page" style={{ background: DARK_BG }}>
        <AnchorBanner />
        <div style={{
          maxWidth: 440, margin: "5rem auto", padding: "2rem",
          background: GOLD_BG, border: `1px solid ${GOLD_BORD}`,
          borderRadius: 16, textAlign: "center",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⛓️⚓⛓️</div>
          <h2 style={{ color: GOLD, marginBottom: "0.5rem", fontFamily: FONT_MONO }}>
            TAI™ Accomplishment Dashboard
          </h2>
          <p style={{ color: MUTED, marginBottom: "1.5rem", fontSize: "0.88rem" }}>
            Enter your VAULTAUTH_TOKEN to access sovereign milestones.
          </p>
          <form
            onSubmit={e => { e.preventDefault(); void handlePasswordSubmit(); }}
            style={{ width: "100%" }}
          >
            <input
              type="password"
              placeholder="VAULTAUTH_TOKEN"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: "100%", padding: "0.75rem", borderRadius: 8, boxSizing: "border-box",
                border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.6)",
                color: WHITE, marginBottom: "0.75rem", fontFamily: FONT_MONO,
              }}
            />
            {authError && <p style={{ color: RED, marginBottom: "0.75rem", fontSize: "0.85rem" }}>{authError}</p>}
            <button
              type="submit"
              style={{
                width: "100%", padding: "0.75rem", borderRadius: 8,
                background: GOLD, border: "none", color: "#000",
                cursor: "pointer", fontWeight: "bold", fontFamily: FONT_MONO,
              }}
            >
              🔓 Unlock Dashboard
            </button>
          </form>
        </div>

      </main>
    );
  }

  // ── Main dashboard ─────────────────────────────────────────────────────────
  const items = data?.accomplishments ?? [];

  return (
    <main className="page" style={{ background: DARK_BG, minHeight: "100vh" }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: GOLD, fontSize: "1.5rem", marginBottom: "0.35rem", fontFamily: FONT_MONO }}>
          ⛓️ TAI™ Accomplishment Registry
        </h1>
        <p style={{ color: MUTED, fontSize: "0.8rem" }}>
          Kernel {KERNEL_VERSION} · Sovereign Capsule Log · 1,017-Notch Parity
        </p>
      </div>

      {/* Current milestone banner */}
      {data && (
        <div style={{
          background: GOLD_BG, border: `1px solid ${GOLD_BORD}`,
          borderRadius: 10, padding: "0.85rem 1.25rem",
          marginBottom: "1.5rem", fontFamily: FONT_MONO,
          display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.85rem" }}>
              ⚡ {data.phase_current} · {data.milestone}
            </div>
            <div style={{ color: MUTED, fontSize: "0.75rem", marginTop: "0.2rem" }}>
              {data.total} accomplishments recorded · Last refresh: {lastRefresh.slice(0, 19)} UTC
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => void fetchData()}
              disabled={loading}
              style={{
                padding: "0.4rem 0.9rem", borderRadius: 6,
                background: "rgba(212,175,55,0.2)", border: `1px solid ${GOLD_BORD}`,
                color: GOLD, cursor: "pointer", fontSize: "0.8rem", fontFamily: FONT_MONO,
              }}
            >
              {loading ? "Syncing…" : "↻ Refresh"}
            </button>
            <button
              onClick={() => setShowForm(f => !f)}
              style={{
                padding: "0.4rem 0.9rem", borderRadius: 6,
                background: GOLD, border: "none",
                color: "#000", cursor: "pointer", fontSize: "0.8rem",
                fontWeight: "bold", fontFamily: FONT_MONO,
              }}
            >
              + New Accomplishment
            </button>
          </div>
        </div>
      )}

      {error && <SovereignErrorBanner error={error} />}

      {/* New accomplishment form */}
      {showForm && (
        <div style={{
          background: "rgba(212,175,55,0.05)", border: `1px solid ${GOLD_BORD}`,
          borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem",
        }}>
          <h3 style={{ color: GOLD, fontFamily: FONT_MONO, marginBottom: "1rem", fontSize: "1rem" }}>
            ⛓️ Record New TAI™ Accomplishment
          </h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {[
              { label: "Title *", key: "title", placeholder: "Accomplishment title" },
              { label: "Description", key: "description", placeholder: "Optional details" },
              { label: "Phase", key: "phase", placeholder: "Phase 73" },
              { label: "Bundle ID", key: "bundle_id", placeholder: "EVIDENCE_BUNDLE_..." },
              { label: "Ray ID", key: "ray_id", placeholder: "Cloudflare Ray ID" },
              { label: "ASN", key: "asn", placeholder: "36459" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ color: MUTED, fontSize: "0.75rem", display: "block", marginBottom: "0.25rem", fontFamily: FONT_MONO }}>
                  {f.label}
                </label>
                <input
                  value={form[f.key as keyof NewForm]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 6,
                    border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.5)",
                    color: WHITE, fontFamily: FONT_MONO, fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
            <div>
              <label style={{ color: MUTED, fontSize: "0.75rem", display: "block", marginBottom: "0.25rem", fontFamily: FONT_MONO }}>
                Category
              </label>
              <select
                value={form.category}
                onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                style={{
                  padding: "0.5rem 0.75rem", borderRadius: 6, fontFamily: FONT_MONO,
                  border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.5)",
                  color: WHITE, fontSize: "0.85rem", cursor: "pointer",
                }}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {submitMsg && (
            <p style={{ color: submitMsg.startsWith("✅") ? GREEN : RED, fontSize: "0.85rem", marginTop: "0.75rem", fontFamily: FONT_MONO }}>
              {submitMsg}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              onClick={() => void handleNewAccomplishment()}
              disabled={submitting}
              style={{
                padding: "0.6rem 1.25rem", borderRadius: 8,
                background: GOLD, border: "none",
                color: "#000", cursor: "pointer", fontWeight: "bold", fontFamily: FONT_MONO,
              }}
            >
              {submitting ? "Sealing…" : "⛓️ Seal Accomplishment"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(BLANK_FORM); setSubmitMsg(""); }}
              style={{
                padding: "0.6rem 1.25rem", borderRadius: 8,
                background: "transparent", border: `1px solid ${GOLD_BORD}`,
                color: GOLD, cursor: "pointer", fontFamily: FONT_MONO,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: "flex", gap: "0.75rem", flexWrap: "wrap",
        marginBottom: "1.25rem", alignItems: "center",
      }}>
        <span style={{ color: MUTED, fontSize: "0.8rem", fontFamily: FONT_MONO }}>Filter:</span>
        {["ALL", ...CATEGORIES].map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            style={{
              padding: "0.3rem 0.7rem", borderRadius: 6,
              background: filterCat === c ? (CAT_COLORS[c] ?? GOLD) : "rgba(212,175,55,0.08)",
              border: `1px solid ${filterCat === c ? (CAT_COLORS[c] ?? GOLD) : GOLD_BORD}`,
              color: filterCat === c ? "#000" : GOLD,
              cursor: "pointer", fontSize: "0.75rem", fontFamily: FONT_MONO,
              fontWeight: filterCat === c ? "bold" : "normal",
            }}
          >
            {c}
          </button>
        ))}
        <input
          value={filterPhase}
          onChange={e => setFilterPhase(e.target.value)}
          placeholder="Phase filter…"
          style={{
            padding: "0.3rem 0.6rem", borderRadius: 6,
            border: `1px solid ${GOLD_BORD}`, background: "rgba(0,0,0,0.4)",
            color: WHITE, fontFamily: FONT_MONO, fontSize: "0.8rem", width: 130,
          }}
        />
        <button
          onClick={() => void fetchData()}
          style={{
            padding: "0.3rem 0.7rem", borderRadius: 6,
            background: "rgba(212,175,55,0.15)", border: `1px solid ${GOLD_BORD}`,
            color: GOLD, cursor: "pointer", fontSize: "0.75rem", fontFamily: FONT_MONO,
          }}
        >
          Apply
        </button>
      </div>

      {/* Accomplishment cards */}
      {loading && (
        <p style={{ color: MUTED, fontFamily: FONT_MONO, fontSize: "0.85rem" }}>
          Loading accomplishments…
        </p>
      )}

      {!loading && items.length === 0 && (
        <p style={{ color: MUTED, fontFamily: FONT_MONO, fontSize: "0.85rem" }}>
          No accomplishments found for this filter.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {items.map(acc => (
          <div
            key={acc.id}
            style={{
              background: "rgba(212,175,55,0.04)",
              border: `1px solid ${GOLD_BORD}`,
              borderLeft: `4px solid ${CAT_COLORS[acc.category] ?? GOLD}`,
              borderRadius: 10,
              padding: "1rem 1.25rem",
            }}
          >
            {/* Title row */}
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <div style={{ color: WHITE, fontWeight: 700, fontFamily: FONT_MONO, fontSize: "0.95rem" }}>
                {acc.title}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{
                  padding: "0.15rem 0.5rem", borderRadius: 4,
                  background: `${CAT_COLORS[acc.category] ?? GOLD}22`,
                  border: `1px solid ${CAT_COLORS[acc.category] ?? GOLD}`,
                  color: CAT_COLORS[acc.category] ?? GOLD,
                  fontSize: "0.7rem", fontFamily: FONT_MONO, fontWeight: 700,
                }}>
                  {acc.category}
                </span>
                <span style={{ color: GOLD_DIM, fontSize: "0.75rem", fontFamily: FONT_MONO }}>
                  {acc.phase}
                </span>
              </div>
            </div>

            {/* Description */}
            {acc.description && (
              <p style={{ color: MUTED, fontSize: "0.8rem", marginBottom: "0.5rem", lineHeight: 1.5 }}>
                {acc.description}
              </p>
            )}

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.72rem", fontFamily: FONT_MONO, color: GOLD_DIM }}>
              <span>🕐 {formatTs(acc.accomplished_at)}</span>
              <span>⛓️ Kernel: {acc.kernel_version}</span>
              {acc.ray_id && <span>📡 RayID: {acc.ray_id.slice(0, 16)}…</span>}
              {acc.asn && <span>🌐 ASN: {acc.asn}</span>}
              {acc.bundle_id && <span>📦 Bundle: {acc.bundle_id.slice(0, 20)}…</span>}
              <span>🤖 By: {acc.recorded_by}</span>
            </div>

            {/* SHA-512 fingerprint */}
            {acc.sha512 && (
              <div style={{
                marginTop: "0.6rem", padding: "0.4rem 0.6rem",
                background: "rgba(0,0,0,0.4)", borderRadius: 6,
                fontFamily: FONT_MONO, fontSize: "0.7rem",
                wordBreak: "break-all", color: BLUE,
              }}>
                SHA-512: {acc.sha512}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Kernel anchor footer */}
      <div style={{
        marginTop: "2.5rem", paddingTop: "1rem",
        borderTop: `1px solid ${GOLD_BORD}`,
        fontSize: "0.75rem", color: GOLD_DIM, fontFamily: FONT_MONO,
        display: "flex", flexWrap: "wrap", gap: "1rem",
      }}>
        <span>⛓️⚓⛓️ AveryOS™ TAI™ Accomplishment Registry</span>
        <span>Kernel: {KERNEL_VERSION}</span>
        <span style={{ wordBreak: "break-all" }}>
          Root0: {KERNEL_SHA.slice(0, 12)}…{KERNEL_SHA.slice(-8)}
        </span>
        <span>1,017-Notch Parity Active</span>
      </div>


    </main>
  );
}
