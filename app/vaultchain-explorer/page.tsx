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
const ORANGE       = "#ff9900";
const MUTED        = "rgba(255,255,255,0.55)";
const BLUE_DIM     = "rgba(100,180,255,0.7)";

type Tab = "hash" | "rayid";

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
  // VaultChain transaction fields
  transaction_id?: string;
  event_type?: string;
  private_capsule_sha512?: string;
  target?: string;
  details?: string;
  timestamp?: string;
  // VaultChain capsule fields
  sha512?: string;
  ray_id?: string;
  anchored_at?: string;
  ip_address?: string;
  path?: string;
  hash_type?: string;
}

interface EvidenceResult {
  CapsuleID?: string;
  CapsuleType?: string;
  EventType?: string;
  EventId?: number;
  TargetIP?: string;
  UserAgent?: string;
  GeoLocation?: string;
  TargetPath?: string;
  ThreatLevel?: number;
  TimestampNs?: string;
  PackagedAt?: string;
  KernelAnchor?: string;
  KernelVersion?: string;
  error?: string;
}

interface EvidencePayload {
  ray_id?: string;
  ip_address?: string;
  user_agent?: string;
  colo?: string;
  asn?: string;
  city?: string;
  country?: string;
  path?: string;
  waf_score_total?: number;
  waf_score_sqli?: number;
  wall_time_us?: number;
  edge_start_ts?: string;
  edge_end_ts?: string;
  threat_level?: number;
  ingestion_intent?: string;
  kernel_sha?: string;
  captured_at?: string;
}

interface EvidenceResult {
  resonance: string;
  kernel_sha?: string;
  kernel_version?: string;
  ray_id?: string;
  r2_key?: string;
  evidence?: EvidencePayload;
  retrieved_at?: string;
  detail?: string;
  error?: string;
}

// ── Shared styles ──────────────────────────────────────────────────────────────
function inputStyle(): React.CSSProperties {
  return {
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
  };
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    display:       "inline-block",
    background:    `rgba(${color === GREEN ? "74,222,128" : color === RED ? "255,68,68" : "255,153,0"},0.12)`,
    border:        `1px solid ${color}`,
    borderRadius:  "6px",
    color,
    fontSize:      "0.8rem",
    fontWeight:    700,
    letterSpacing: "0.06em",
    padding:       "0.3rem 0.8rem",
    marginBottom:  "1.25rem",
  };
}

function intentColor(intent: string | undefined): string {
  if (!intent) return MUTED;
  if (intent === 'LEGAL_SCAN') return RED;
  if (intent === 'DER_PROBE' || intent === 'HIGH_WAF_PROBE') return ORANGE;
  return GREEN;
}

export default function VaultChainExplorerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("hash");

  // ── Hash Verify state ──────────────────────────────────────────────────────
  const [hashInput,  setHashInput]  = useState("");
  const [hashResult, setHashResult] = useState<VerifyResult | null>(null);
  const [hashLoading, setHashLoading] = useState(false);
  const [hashError,  setHashError]  = useState<string | null>(null);

  const isValidHash  = /^[a-fA-F0-9]{128}$/.test(hashInput.trim());
  const isValidRayId = rayIdInput.trim().length >= 8;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidHash) return;
    setHashLoading(true);
    setHashResult(null);
    setHashError(null);
    try {
      const res  = await fetch(`/api/v1/verify/${hashInput.trim()}`);
      const data = await res.json() as VerifyResult;
      setHashResult(data);
    } catch {
      setHashError("Network error — unable to reach the VaultChain™ ledger.");
    } finally {
      setHashLoading(false);
    }
  }

  // ── RayID Evidence state ───────────────────────────────────────────────────
  const [rayInput,    setRayInput]    = useState("");
  const [rayToken,    setRayToken]    = useState("");
  const [rayResult,   setRayResult]   = useState<EvidenceResult | null>(null);
  const [rayLoading,  setRayLoading]  = useState(false);
  const [rayError,    setRayError]    = useState<string | null>(null);

  const isValidRayId = /^[a-zA-Z0-9]{16,32}$/.test(rayInput.trim());

  async function handleEvidenceLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidRayId) return;
    setRayLoading(true);
    setRayResult(null);
    setRayError(null);
    try {
      const headers: Record<string, string> = {};
      if (rayToken.trim()) headers['Authorization'] = `Bearer ${rayToken.trim()}`;
      const res  = await fetch(`/api/v1/evidence/${rayInput.trim()}`, { headers });
      const data = await res.json() as EvidenceResult;
      setRayResult(data);
    } catch {
      setRayError("Network error — unable to reach the Forensic Evidence Vault.");
    } finally {
      setRayLoading(false);
    }
  }

  const hashResonanceColor =
    hashResult?.resonance === "HIGH_FIDELITY_SUCCESS" ? GREEN :
    hashResult?.resonance === "DRIFT_ALERT"            ? RED   : GOLD;

  // ── Tab style helper ───────────────────────────────────────────────────────
  function tabStyle(tab: Tab): React.CSSProperties {
    const active = activeTab === tab;
    return {
      background:    active ? GOLD : "transparent",
      border:        `1px solid ${active ? GOLD : GOLD_BORDER}`,
      borderRadius:  "6px",
      color:         active ? "#000" : GOLD_DIM,
      cursor:        "pointer",
      fontWeight:    active ? 700 : 400,
      fontSize:      "0.88rem",
      padding:       "0.45rem 1.25rem",
      transition:    "all 0.2s",
    };
  }

  return (
    <main className="page" style={{ background: BG, minHeight: "100vh", color: "#fff" }}>
      <AnchorBanner />

      {/* ── Hero ── */}
      <section style={{ textAlign: "center", padding: "3rem 1.5rem 2rem" }}>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: GOLD, marginBottom: "0.5rem" }}>
          VaultChain™ Explorer
        </h1>
        <p style={{ color: GOLD_DIM, fontSize: "1.05rem", maxWidth: 640, margin: "0 auto 1.5rem" }}>
          Verify alignment certificates and retrieve forensic evidence bundles from the
          AveryOS™ Sovereign Ledger — anchored to the cf83e135… Kernel Root.
        </p>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button style={tabStyle("hash")} onClick={() => setActiveTab("hash")}>
            ⛓️ Hash Verify
          </button>
          <button style={tabStyle("rayid")} onClick={() => setActiveTab("rayid")}>
            🔍 RayID Evidence
          </button>
        </div>
      </section>

      <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 1.5rem 3rem" }}>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1 — SHA-512 Hash Verification
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "hash" && (
          <>
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
                style={inputStyle()}
              />
              <button
                type="submit"
                disabled={!isValidHash || hashLoading}
                style={{
                  alignSelf:    "flex-start",
                  background:   isValidHash && !hashLoading ? GOLD : "rgba(255,215,0,0.15)",
                  border:       "none",
                  borderRadius: "6px",
                  color:        isValidHash && !hashLoading ? "#000" : MUTED,
                  cursor:       isValidHash && !hashLoading ? "pointer" : "not-allowed",
                  fontSize:     "0.9rem",
                  fontWeight:   700,
                  padding:      "0.6rem 1.8rem",
                  transition:   "background 0.2s",
                }}
              >
                {hashLoading ? "Verifying…" : "Verify ⛓️"}
              </button>
            </form>

            {hashError && (
              <div style={{ marginTop: "1.5rem", background: "rgba(255,68,68,0.08)",
                            border: "1px solid rgba(255,68,68,0.3)", borderRadius: "8px",
                            padding: "1rem 1.25rem", color: RED }}>
                {hashError}
              </div>
            )}

            {hashResult && (
              <div style={{ marginTop: "1.5rem", background: GOLD_GLOW,
                            border: `1px solid ${GOLD_BORDER}`, borderRadius: "10px",
                            padding: "1.5rem 1.75rem" }}>
                <div style={badgeStyle(hashResonanceColor)}>{hashResult.resonance}</div>
                {hashResult.resonance === "HIGH_FIDELITY_SUCCESS" && (
                  <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr",
                                gap: "0.5rem 1.5rem", margin: 0 }}>
                    {([
                      ["Partner ID",      hashResult.partner_id],
                      ["Partner Name",    hashResult.partner_name ?? "—"],
                      ["Email",           hashResult.email],
                      ["Alignment Type",  hashResult.alignment_type],
                      ["Status",          hashResult.status],
                      ["Settlement ID",   hashResult.settlement_id ?? "—"],
                      ["TARI™ Reference", hashResult.tari_reference ?? "—"],
                      ["Valid Until",     hashResult.valid_until ?? "No expiry"],
                      ["Aligned At",      hashResult.aligned_at],
                      ["Verified At",     hashResult.verified_at],
                    ] as [string, string | undefined][]).map(([label, value]) => (
                      value !== undefined && (
                        <React.Fragment key={label}>
                          <dt style={{ color: GOLD_DIM, fontSize: "0.8rem",
                                                            whiteSpace: "nowrap" }}>
                            {label}
                          </dt>
                          <dd style={{ color: "#fff", fontSize: "0.85rem",
                                                            margin: 0, wordBreak: "break-all" }}>
                            {value}
                          </dd>
                        </React.Fragment>
                      )
                    ))}
                  </dl>
                )}
                {hashResult.resonance === "DRIFT_ALERT" && (
                  <p style={{ color: MUTED, fontSize: "0.9rem", margin: 0 }}>
                    {hashResult.detail ?? "No sovereign alignment found for this hash."}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2 — RayID Forensic Evidence Lookup
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "rayid" && (
          <>
            <form onSubmit={handleEvidenceLookup}
                  style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <label style={{ color: GOLD_DIM, fontSize: "0.85rem", letterSpacing: "0.08em" }}>
                CLOUDFLARE RAYID (16–32 alphanumeric characters)
              </label>
              <input
                type="text"
                value={rayInput}
                onChange={(e) => setRayInput(e.target.value)}
                placeholder="abc123def456789ab (e.g. from X-AveryOS-Alignment header)"
                maxLength={32}
                spellCheck={false}
                style={inputStyle()}
              />
              <label style={{ color: GOLD_DIM, fontSize: "0.85rem", letterSpacing: "0.08em", marginTop: "0.25rem" }}>
                VAULT PASSPHRASE (Bearer token — required for evidence access)
              </label>
              <input
                type="password"
                value={rayToken}
                onChange={(e) => setRayToken(e.target.value)}
                placeholder="Enter your VAULT_PASSPHRASE"
                style={inputStyle()}
              />
              <button
                type="submit"
                disabled={!isValidRayId || rayLoading}
                style={{
                  alignSelf:    "flex-start",
                  background:   isValidRayId && !rayLoading ? GOLD : "rgba(255,215,0,0.15)",
                  border:       "none",
                  borderRadius: "6px",
                  color:        isValidRayId && !rayLoading ? "#000" : MUTED,
                  cursor:       isValidRayId && !rayLoading ? "pointer" : "not-allowed",
                  fontSize:     "0.9rem",
                  fontWeight:   700,
                  padding:      "0.6rem 1.8rem",
                  transition:   "background 0.2s",
                }}
              >
                {rayLoading ? "Fetching Evidence…" : "Fetch Evidence 🔍"}
              </button>
            </form>

            {rayError && (
              <div style={{ marginTop: "1.5rem", background: "rgba(255,68,68,0.08)",
                            border: "1px solid rgba(255,68,68,0.3)", borderRadius: "8px",
                            padding: "1rem 1.25rem", color: RED }}>
                {rayError}
              </div>
            )}

            {rayResult && (
              <div style={{ marginTop: "1.5rem", background: GOLD_GLOW,
                            border: `1px solid ${GOLD_BORDER}`, borderRadius: "10px",
                            padding: "1.5rem 1.75rem" }}>
                <div style={badgeStyle(rayResult.resonance === "HIGH_FIDELITY_SUCCESS" ? GREEN : RED)}>
                  {rayResult.resonance}
                </div>

                {rayResult.resonance === "HIGH_FIDELITY_SUCCESS" && rayResult.evidence && (
                  <>
                    {/* ── Identity block ── */}
                    <h3 style={{ color: GOLD, fontSize: "0.9rem", margin: "0 0 0.75rem",
                                  letterSpacing: "0.06em" }}>
                      EDGE TELEMETRY
                    </h3>
                    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr",
                                  gap: "0.45rem 1.5rem", margin: "0 0 1.5rem" }}>
                      {([
                        ["RayID",            rayResult.ray_id],
                        ["IP Address",       rayResult.evidence.ip_address],
                        ["City",             rayResult.evidence.city || "—"],
                        ["Country",          rayResult.evidence.country || "—"],
                        ["ASN",              rayResult.evidence.asn || "—"],
                        ["Colo",             rayResult.evidence.colo],
                        ["Path",             rayResult.evidence.path],
                        ["User Agent",       rayResult.evidence.user_agent],
                      ] as [string, string | undefined][]).map(([label, value]) => (
                        value !== undefined && (
                          <React.Fragment key={label}>
                            <dt style={{ color: GOLD_DIM, fontSize: "0.8rem",
                                             whiteSpace: "nowrap" }}>
                              {label}
                            </dt>
                            <dd style={{ color: "#fff", fontSize: "0.82rem",
                                             margin: 0, wordBreak: "break-all",
                                             fontFamily: "monospace" }}>
                              {value}
                            </dd>
                          </React.Fragment>
                        )
                      ))}
                    </dl>

                    {/* ── WAF + Intent block ── */}
                    <h3 style={{ color: GOLD, fontSize: "0.9rem", margin: "0 0 0.75rem",
                                  letterSpacing: "0.06em" }}>
                      WAF ATTACK SCORES &amp; INTENT
                    </h3>
                    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr",
                                  gap: "0.45rem 1.5rem", margin: "0 0 1.5rem" }}>
                      <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        WAF Total Score
                      </dt>
                      <dd style={{ color: (rayResult.evidence.waf_score_total ?? 0) >= 80 ? RED : GREEN,
                                    fontWeight: 700, fontFamily: "monospace", margin: 0,
                                    fontSize: "0.9rem" }}>
                        {rayResult.evidence.waf_score_total ?? 0}
                      </dd>
                      <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        WAF SQLi Score
                      </dt>
                      <dd style={{ color: (rayResult.evidence.waf_score_sqli ?? 0) > 0 ? ORANGE : GREEN,
                                    fontFamily: "monospace", margin: 0, fontSize: "0.9rem" }}>
                        {rayResult.evidence.waf_score_sqli ?? 0}
                      </dd>
                      <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        Ingestion Intent
                      </dt>
                      <dd style={{ color: intentColor(rayResult.evidence.ingestion_intent),
                                    fontWeight: 700, fontFamily: "monospace", margin: 0,
                                    fontSize: "0.88rem" }}>
                        {rayResult.evidence.ingestion_intent ?? "—"}
                      </dd>
                      <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        Threat Level
                      </dt>
                      <dd style={{ color: (rayResult.evidence.threat_level ?? 1) >= 10 ? RED : GOLD,
                                    fontFamily: "monospace", margin: 0, fontSize: "0.9rem" }}>
                        {rayResult.evidence.threat_level ?? 1}
                      </dd>
                      <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        Wall Time (µs)
                      </dt>
                      <dd style={{ color: MUTED, fontFamily: "monospace", margin: 0, fontSize: "0.85rem" }}>
                        {(rayResult.evidence.wall_time_us ?? 0).toLocaleString()} µs
                      </dd>
                      <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        Edge Start
                      </dt>
                      <dd style={{ color: MUTED, fontFamily: "monospace", margin: 0, fontSize: "0.82rem" }}>
                        {rayResult.evidence.edge_start_ts ?? "—"}
                      </dd>
                      <dt style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        Edge End
                      </dt>
                      <dd style={{ color: MUTED, fontFamily: "monospace", margin: 0, fontSize: "0.82rem" }}>
                        {rayResult.evidence.edge_end_ts ?? "—"}
                      </dd>
                    </dl>

                    {/* ── Kernel anchor block ── */}
                    <h3 style={{ color: GOLD, fontSize: "0.9rem", margin: "0 0 0.75rem",
                                  letterSpacing: "0.06em" }}>
                      KERNEL ANCHOR
                    </h3>
                    <code style={{ display: "block", background: "rgba(255,215,0,0.04)",
                                    border: `1px solid ${GOLD_BORDER}`, borderRadius: "6px",
                                    color: GOLD, fontSize: "0.7rem", padding: "0.75rem",
                                    wordBreak: "break-all", lineHeight: 1.6 }}>
                      {rayResult.evidence.kernel_sha ?? rayResult.kernel_sha ?? "—"}
                    </code>
                    <p style={{ color: MUTED, fontSize: "0.78rem", marginTop: "0.5rem" }}>
                      R2 Key: <code style={{ color: GOLD_DIM }}>{rayResult.r2_key}</code>
                      &nbsp;|&nbsp; Retrieved: {rayResult.retrieved_at}
                    </p>
                  </>
                )}

                {rayResult.resonance !== "HIGH_FIDELITY_SUCCESS" && (
                  <p style={{ color: MUTED, fontSize: "0.9rem", margin: 0 }}>
                    {rayResult.detail ?? "No evidence bundle found for this RayID."}
                  </p>
                )}
              </div>
            )}
          </>
        )}

      </section>

      {/* ── R2 Evidence Lookup ── */}
      <section style={{
        maxWidth:    720,
        margin:      "0 auto",
        padding:     "0 1.5rem 3rem",
        borderTop:   `1px solid ${GOLD_BORDER}`,
        paddingTop:  "2rem",
      }}>
        <h2 style={{ color: GOLD_DIM, fontSize: "1.15rem", marginBottom: "0.5rem", fontWeight: 700 }}>
          R2 Forensic Evidence Lookup
        </h2>
        <p style={{ color: MUTED, fontSize: "0.88rem", marginBottom: "1.25rem" }}>
          Retrieve a sealed forensic evidence bundle from R2 by Cloudflare RayID or SHA-512 payload.
          Evidence bundles are created by the Evidence Packaging Automation for every LEGAL_SCAN event.
        </p>
        <form onSubmit={handleEvidenceLookup} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label style={{ color: BLUE_DIM, fontSize: "0.85rem", letterSpacing: "0.08em" }}>
            RAYID OR SHA-512 PAYLOAD
          </label>
          <input
            type="text"
            value={rayIdInput}
            onChange={(e) => setRayIdInput(e.target.value)}
            placeholder="Enter Cloudflare RayID (e.g. 8a3f1b2c4d5e6f7g) or SHA-512 hash…"
            maxLength={128}
            spellCheck={false}
            style={{
              background:   "rgba(100,180,255,0.04)",
              border:       `1px solid rgba(100,180,255,0.3)`,
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
            disabled={!isValidRayId || evidenceLoading}
            style={{
              alignSelf:    "flex-start",
              background:   isValidRayId && !evidenceLoading ? BLUE_DIM : "rgba(100,180,255,0.1)",
              border:       "none",
              borderRadius: "6px",
              color:        isValidRayId && !evidenceLoading ? "#000" : MUTED,
              cursor:       isValidRayId && !evidenceLoading ? "pointer" : "not-allowed",
              fontSize:     "0.9rem",
              fontWeight:   700,
              padding:      "0.6rem 1.8rem",
              transition:   "background 0.2s",
            }}
          >
            {evidenceLoading ? "Fetching…" : "Fetch Evidence 🔍"}
          </button>
        </form>

        {evidenceError && (
          <div style={{
            marginTop:    "1.5rem",
            background:   "rgba(255,68,68,0.08)",
            border:       "1px solid rgba(255,68,68,0.3)",
            borderRadius: "8px",
            padding:      "1rem 1.25rem",
            color:        RED,
          }}>
            {evidenceError}
          </div>
        )}

        {evidenceResult && !evidenceResult.error && (
          <div style={{
            marginTop:    "1.5rem",
            background:   "rgba(100,180,255,0.05)",
            border:       "1px solid rgba(100,180,255,0.25)",
            borderRadius: "10px",
            padding:      "1.5rem 1.75rem",
          }}>
            <div style={{
              display:       "inline-block",
              background:    "rgba(74,222,128,0.12)",
              border:        `1px solid ${GREEN}`,
              borderRadius:  "6px",
              color:         GREEN,
              fontSize:      "0.8rem",
              fontWeight:    700,
              letterSpacing: "0.06em",
              padding:       "0.3rem 0.8rem",
              marginBottom:  "1.25rem",
            }}>
              EVIDENCE BUNDLE FOUND
            </div>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1.5rem", margin: 0 }}>
              {([
                ["Capsule ID",    evidenceResult.CapsuleID],
                ["Capsule Type",  evidenceResult.CapsuleType],
                ["Event Type",    evidenceResult.EventType],
                ["Event ID",      String(evidenceResult.EventId ?? "")],
                ["Target IP",     evidenceResult.TargetIP],
                ["Target Path",   evidenceResult.TargetPath],
                ["Geo Location",  evidenceResult.GeoLocation],
                ["Threat Level",  String(evidenceResult.ThreatLevel ?? "")],
                ["Packaged At",   evidenceResult.PackagedAt],
                ["Kernel Version",evidenceResult.KernelVersion],
              ] as [string, string | undefined][]).map(([label, value]) => (
                value ? (
                  <>
                    <dt key={`dt-${label}`} style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {label}
                    </dt>
                    <dd key={`dd-${label}`} style={{ color: "#fff", fontSize: "0.85rem", margin: 0, wordBreak: "break-all" }}>
                      {value}
                    </dd>
                  </>
                ) : null
              ))}
            </dl>
          </div>
        )}
      </section>

      {/* ── Info footer ── */}
      <section style={{ borderTop: `1px solid ${GOLD_BORDER}`, maxWidth: 720,
                        margin: "0 auto", padding: "2rem 1.5rem", fontSize: "0.82rem",
                        color: MUTED, lineHeight: 1.7 }}>
        <p>
          The <strong style={{ color: GOLD_DIM }}>Hash Verify</strong> tab queries the{" "}
          <strong style={{ color: GOLD_DIM }}>sovereign_alignments</strong> D1 table — the live
          on-chain ledger for all TARI™ settlement certificates.
        </p>
        <p>
          The <strong style={{ color: GOLD_DIM }}>RayID Evidence</strong> tab fetches the raw
          Cloudflare telemetry JSON from <strong style={{ color: GOLD_DIM }}>VAULT_R2</strong> at
          path <code style={{ color: GOLD }}>evidence/&#123;rayid&#125;.json</code>.
          Evidence bundles include WAF Attack Scores, geolocation, INGESTION_INTENT
          classification, wall-clock timing, and the cf83™ Kernel SHA anchor.
        </p>
        <p>
          ⛓️⚓⛓️ &nbsp; CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻 &nbsp;|&nbsp;
          VaultChain™ v2026.2 — Phase 82 Forensic Evidence Explorer
        </p>
      </section>

      <FooterBadge />
    </main>
  );
}

