"use client";

import React, { useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG           = "#03000a";
const GOLD         = "#ffd700";
const GOLD_DIM     = "rgba(255,215,0,0.55)";
const GOLD_BORDER  = "rgba(255,215,0,0.3)";
const GOLD_GLOW    = "rgba(255,215,0,0.08)";
const GREEN        = "#4ade80";
const RED          = "#ff4444";
const MUTED        = "rgba(255,255,255,0.55)";
const CYAN         = "#38bdf8";

// ── Types ──────────────────────────────────────────────────────────────────────
interface VerifyResult {
  resonance: string;
  alignment_hash?: string;
  partner_id?: string;
  partner_name?: string | null;
  email?: string;
  alignment_type?: string;
  settlement_id?: string | null;
  tari_reference?: string | null;
  valid_until?: string | null;
  aligned_at?: string;
  status?: string;
  verified_at?: string;
  detail?: string;
  error?: string;
}

// Phase 82: R2 Evidence Artifact from evidence/${sha512}.json
interface EvidenceResult {
  sha512_payload?: string;
  ray_id?: string;
  ip_address?: string;
  asn?: string;
  path?: string;
  request_uri?: string;
  request_method?: string;
  request_referrer?: string | null;
  request_protocol?: string | null;
  client_city?: string | null;
  client_lat?: string | null;
  client_lon?: string | null;
  waf_score_total?: number | null;
  waf_score_sqli?: number | null;
  bot_category?: string | null;
  edge_colo?: string | null;
  wall_time_us?: number | null;
  edge_start_ts?: string;
  edge_end_ts?: string;
  kernel_sha?: string;
  archived_at?: string;
  fetched_at?: string;
  r2_key?: string;
  error?: string;
  detail?: string;
}

type ActiveTab = "alignment" | "evidence";

export default function VaultChainExplorerPage() {
  const [activeTab,    setActiveTab]    = useState<ActiveTab>("alignment");

  // Alignment verifier state
  const [hashInput,    setHashInput]    = useState("");
  const [result,       setResult]       = useState<VerifyResult | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Phase 82: Evidence Explorer state
  const [evidenceId,     setEvidenceId]     = useState("");
  const [vaultAuth,      setVaultAuth]      = useState("");
  const [evidence,       setEvidence]       = useState<EvidenceResult | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError,   setEvidenceError]   = useState<string | null>(null);

  const isValidHash     = /^[a-fA-F0-9]{128}$/.test(hashInput.trim());
  const isValidEvidenceId = evidenceId.trim().length >= 10;

  // ── Alignment verify ───────────────────────────────────────────────────────
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidHash) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res  = await fetch(`/api/v1/verify/${hashInput.trim()}`);
      const data = await res.json() as VerifyResult;
      setResult(data);
    } catch {
      setError("Network error — unable to reach the VaultChain™ ledger.");
    } finally {
      setLoading(false);
    }
  }

  // ── Phase 82: Evidence fetch ───────────────────────────────────────────────
  async function handleFetchEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEvidenceId || !vaultAuth.trim()) return;
    setEvidenceLoading(true);
    setEvidence(null);
    setEvidenceError(null);
    try {
      const res = await fetch(`/api/v1/evidence/${encodeURIComponent(evidenceId.trim())}`, {
        headers: { "x-vault-auth": vaultAuth.trim() },
      });
      const data = await res.json() as EvidenceResult;
      if (data.error) {
        setEvidenceError(data.detail ?? data.error);
      } else {
        setEvidence(data);
      }
    } catch {
      setEvidenceError("Network error — unable to reach the R2 Evidence Vault.");
    } finally {
      setEvidenceLoading(false);
    }
  }

  const resonanceColor =
    result?.resonance === "HIGH_FIDELITY_SUCCESS" ? GREEN :
    result?.resonance === "DRIFT_ALERT"            ? RED   : GOLD;

  const wafColor = (score: number | null | undefined) => {
    if (score == null) return MUTED;
    if (score > 80) return RED;
    if (score > 40) return GOLD;
    return GREEN;
  };

  return (
    <main className="page" style={{ background: BG, minHeight: "100vh", color: "#fff" }}>
      <AnchorBanner />

      {/* ── Hero ── */}
      <section style={{ textAlign: "center", padding: "3rem 1.5rem 2rem" }}>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: GOLD, marginBottom: "0.5rem" }}>
          VaultChain™ Explorer
        </h1>
        <p style={{ color: GOLD_DIM, fontSize: "1.05rem", maxWidth: 660, margin: "0 auto 1.5rem" }}>
          Verify alignment hashes against the Sovereign Ledger or inspect R2 forensic
          evidence artifacts by RayID / SHA-512 payload hash.
        </p>

        {/* ── Tab switcher ── */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
          {(["alignment", "evidence"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background:   activeTab === tab ? GOLD : "rgba(255,215,0,0.08)",
                border:       `1px solid ${activeTab === tab ? GOLD : GOLD_BORDER}`,
                borderRadius: "6px",
                color:        activeTab === tab ? "#000" : GOLD_DIM,
                cursor:       "pointer",
                fontSize:     "0.82rem",
                fontWeight:   700,
                padding:      "0.4rem 1.2rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                transition:   "background 0.15s",
              }}
            >
              {tab === "alignment" ? "⛓️ Alignment Hash" : "🔍 R2 Evidence"}
            </button>
          ))}
        </div>
      </section>

      {/* ── Tab: Alignment Hash Verify ── */}
      {activeTab === "alignment" && (
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 1.5rem 3rem" }}>
          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ color: GOLD_DIM, fontSize: "0.85rem", letterSpacing: "0.08em" }}>
              ALIGNMENT HASH (128-character SHA-512 hex)
            </label>
            <input
              type="text"
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              placeholder="cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921…"
              maxLength={128}
              spellCheck={false}
              style={{
                background:   "rgba(255,215,0,0.04)",
                border:       `1px solid ${GOLD_BORDER}`,
                borderRadius: "6px",
                color:        "#fff",
                fontFamily:   "monospace",
                fontSize:     "0.78rem",
                padding:      "0.7rem 1rem",
                outline:      "none",
                width:        "100%",
                boxSizing:    "border-box",
              }}
            />
            <button
              type="submit"
              disabled={!isValidHash || loading}
              style={{
                alignSelf:    "flex-start",
                background:   isValidHash && !loading ? GOLD : "rgba(255,215,0,0.15)",
                border:       "none",
                borderRadius: "6px",
                color:        isValidHash && !loading ? "#000" : MUTED,
                cursor:       isValidHash && !loading ? "pointer" : "not-allowed",
                fontSize:     "0.9rem",
                fontWeight:   700,
                padding:      "0.6rem 1.8rem",
                transition:   "background 0.2s",
              }}
            >
              {loading ? "Verifying…" : "Verify ⛓️"}
            </button>
          </form>

          {error && (
            <div style={{
              marginTop: "1.5rem", background: "rgba(255,68,68,0.08)",
              border: "1px solid rgba(255,68,68,0.3)", borderRadius: "8px",
              padding: "1rem 1.25rem", color: RED,
            }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{
              marginTop: "1.5rem", background: GOLD_GLOW,
              border: `1px solid ${GOLD_BORDER}`, borderRadius: "10px",
              padding: "1.5rem 1.75rem",
            }}>
              <div style={{
                display: "inline-block",
                background: result.resonance === "HIGH_FIDELITY_SUCCESS"
                  ? "rgba(74,222,128,0.12)" : "rgba(255,68,68,0.12)",
                border: `1px solid ${resonanceColor}`, borderRadius: "6px",
                color: resonanceColor, fontSize: "0.8rem", fontWeight: 700,
                letterSpacing: "0.06em", padding: "0.3rem 0.8rem", marginBottom: "1.25rem",
              }}>
                {result.resonance}
              </div>

              {result.resonance === "HIGH_FIDELITY_SUCCESS" && (
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1.5rem", margin: 0 }}>
                  {([
                    ["Partner ID",      result.partner_id],
                    ["Partner Name",    result.partner_name ?? "—"],
                    ["Email",           result.email],
                    ["Alignment Type",  result.alignment_type],
                    ["Status",          result.status],
                    ["Settlement ID",   result.settlement_id ?? "—"],
                    ["TARI™ Reference", result.tari_reference ?? "—"],
                    ["Valid Until",     result.valid_until ?? "No expiry"],
                    ["Aligned At",      result.aligned_at],
                    ["Verified At",     result.verified_at],
                  ] as [string, string | undefined][]).map(([label, value]) => (
                    value !== undefined && (
                      <React.Fragment key={label}>
                        <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{label}</dt>
                        <dd style={{ color: "#fff", fontSize: "0.85rem", margin: 0, wordBreak: "break-all" }}>{value}</dd>
                      </React.Fragment>
                    )
                  ))}
                </dl>
              )}

              {result.resonance === "DRIFT_ALERT" && (
                <p style={{ color: MUTED, fontSize: "0.9rem", margin: 0 }}>
                  {result.detail ?? "No sovereign alignment found for this hash."}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Tab: R2 Forensic Evidence (Phase 82) ── */}
      {activeTab === "evidence" && (
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 1.5rem 3rem" }}>
          <form onSubmit={handleFetchEvidence} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ color: GOLD_DIM, fontSize: "0.85rem", letterSpacing: "0.08em" }}>
              RAYID OR SHA-512 PAYLOAD HASH
            </label>
            <input
              type="text"
              value={evidenceId}
              onChange={(e) => setEvidenceId(e.target.value)}
              placeholder="e.g. 8bc4f3e2a1d0-SJC or 128-char SHA-512 hex…"
              spellCheck={false}
              style={{
                background: "rgba(56,189,248,0.04)", border: `1px solid rgba(56,189,248,0.3)`,
                borderRadius: "6px", color: "#fff", fontFamily: "monospace",
                fontSize: "0.78rem", padding: "0.7rem 1rem", outline: "none",
                width: "100%", boxSizing: "border-box",
              }}
            />
            <label style={{ color: GOLD_DIM, fontSize: "0.85rem", letterSpacing: "0.08em" }}>
              VAULT AUTH TOKEN
            </label>
            <input
              type="password"
              value={vaultAuth}
              onChange={(e) => setVaultAuth(e.target.value)}
              placeholder="VAULT_PASSPHRASE…"
              style={{
                background: "rgba(255,215,0,0.04)", border: `1px solid ${GOLD_BORDER}`,
                borderRadius: "6px", color: "#fff", fontSize: "0.85rem",
                padding: "0.7rem 1rem", outline: "none", width: "100%", boxSizing: "border-box",
              }}
            />
            <button
              type="submit"
              disabled={!isValidEvidenceId || !vaultAuth.trim() || evidenceLoading}
              style={{
                alignSelf: "flex-start",
                background: isValidEvidenceId && vaultAuth.trim() && !evidenceLoading
                  ? CYAN : "rgba(56,189,248,0.12)",
                border: "none", borderRadius: "6px",
                color: isValidEvidenceId && vaultAuth.trim() && !evidenceLoading ? "#000" : MUTED,
                cursor: isValidEvidenceId && vaultAuth.trim() && !evidenceLoading ? "pointer" : "not-allowed",
                fontSize: "0.9rem", fontWeight: 700, padding: "0.6rem 1.8rem", transition: "background 0.2s",
              }}
            >
              {evidenceLoading ? "Fetching…" : "Fetch Evidence 🔍"}
            </button>
          </form>

          {evidenceError && (
            <div style={{
              marginTop: "1.5rem", background: "rgba(255,68,68,0.08)",
              border: "1px solid rgba(255,68,68,0.3)", borderRadius: "8px",
              padding: "1rem 1.25rem", color: RED,
            }}>
              {evidenceError}
            </div>
          )}

          {evidence && (
            <div style={{
              marginTop: "1.5rem", background: "rgba(56,189,248,0.04)",
              border: "1px solid rgba(56,189,248,0.25)", borderRadius: "10px",
              padding: "1.5rem 1.75rem",
            }}>
              <div style={{
                display: "inline-block", background: "rgba(56,189,248,0.1)",
                border: "1px solid rgba(56,189,248,0.4)", borderRadius: "6px",
                color: CYAN, fontSize: "0.8rem", fontWeight: 700,
                letterSpacing: "0.06em", padding: "0.3rem 0.8rem", marginBottom: "1.25rem",
              }}>
                R2 EVIDENCE ARTIFACT
              </div>

              <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1.5rem", margin: 0 }}>
                {/* Core forensic fields */}
                {([
                  ["RayID",           evidence.ray_id],
                  ["IP Address",      evidence.ip_address],
                  ["ASN / Country",   evidence.asn],
                  ["City",            evidence.client_city ?? "—"],
                  ["Lat / Lon",       evidence.client_lat && evidence.client_lon
                    ? `${evidence.client_lat}, ${evidence.client_lon}` : "—"],
                  ["Path",            evidence.path],
                  ["Method",          evidence.request_method],
                  ["Protocol",        evidence.request_protocol ?? "—"],
                  ["Referrer",        evidence.request_referrer ?? "—"],
                  ["Bot Category",    evidence.bot_category ?? "—"],
                  ["Edge Colo",       evidence.edge_colo ?? "—"],
                  ["Wall Time (µs)",  evidence.wall_time_us?.toString() ?? "—"],
                  ["Edge Start",      evidence.edge_start_ts],
                  ["Edge End",        evidence.edge_end_ts],
                  ["Archived At",     evidence.archived_at],
                  ["Fetched At",      evidence.fetched_at],
                ] as [string, string | undefined][]).map(([label, value]) => (
                  value !== undefined && (
                    <React.Fragment key={label}>
                      <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{label}</dt>
                      <dd style={{ color: "#fff", fontSize: "0.85rem", margin: 0, wordBreak: "break-all" }}>{value}</dd>
                    </React.Fragment>
                  )
                ))}

                {/* WAF Attack Scores — highlighted */}
                <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>WAF Score (Total)</dt>
                <dd style={{
                  color: wafColor(evidence.waf_score_total),
                  fontSize: "0.85rem", margin: 0, fontWeight: 700,
                }}>
                  {evidence.waf_score_total != null ? evidence.waf_score_total : "—"}
                  {evidence.waf_score_total != null && evidence.waf_score_total > 80 && " ⚠️ HIGH"}
                </dd>

                <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>WAF Score (SQLi)</dt>
                <dd style={{
                  color: wafColor(evidence.waf_score_sqli),
                  fontSize: "0.85rem", margin: 0, fontWeight: 700,
                }}>
                  {evidence.waf_score_sqli != null ? evidence.waf_score_sqli : "—"}
                </dd>
              </dl>

              {/* SHA-512 payload */}
              {evidence.sha512_payload && (
                <div style={{ marginTop: "1rem" }}>
                  <p style={{ color: GOLD_DIM, fontSize: "0.78rem", marginBottom: "0.25rem" }}>SHA-512 PAYLOAD</p>
                  <code style={{
                    display: "block", color: GOLD, fontSize: "0.7rem", wordBreak: "break-all",
                    background: "rgba(255,215,0,0.04)", padding: "0.5rem 0.75rem", borderRadius: "4px",
                  }}>
                    {evidence.sha512_payload}
                  </code>
                </div>
              )}

              {/* R2 key */}
              {evidence.r2_key && (
                <p style={{ color: MUTED, fontSize: "0.78rem", marginTop: "0.75rem" }}>
                  R2 Key: <code style={{ color: CYAN }}>{evidence.r2_key}</code>
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Info footer ── */}
      <section style={{
        borderTop: `1px solid ${GOLD_BORDER}`, maxWidth: 720,
        margin: "0 auto", padding: "2rem 1.5rem",
        fontSize: "0.82rem", color: MUTED, lineHeight: 1.7,
      }}>
        <p>
          The <strong style={{ color: GOLD_DIM }}>Alignment Hash</strong> tab queries the{" "}
          <strong style={{ color: GOLD_DIM }}>sovereign_alignments</strong> D1 ledger for TARI™
          settlement certificates. The{" "}
          <strong style={{ color: CYAN }}>R2 Evidence</strong> tab fetches raw forensic artifacts
          from the <strong style={{ color: CYAN }}>VAULT_R2</strong> Evidence Vault — requires
          VAULT_PASSPHRASE authentication.
        </p>
        <p>
          All artifacts are SHA-512 anchored to the Root0 Kernel
          (<code style={{ color: GOLD }}>{`cf83e135…927da3e`}</code>).
          WAF Attack Scores{" > "}80 indicate high-risk deep-probe ingestion.
        </p>
        <p>
          ⛓️⚓⛓️ &nbsp; CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻 &nbsp;|&nbsp; VaultChain™ v2026.2
        </p>
      </section>

      <FooterBadge />
    </main>
  );
}
