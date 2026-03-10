"use client";

import { useState } from "react";
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
const BLUE_DIM     = "rgba(100,180,255,0.7)";

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

export default function VaultChainExplorerPage() {
  const [hashInput,      setHashInput]      = useState("");
  const [rayIdInput,     setRayIdInput]     = useState("");
  const [result,         setResult]         = useState<VerifyResult | null>(null);
  const [evidenceResult, setEvidenceResult] = useState<EvidenceResult | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [evidenceError,  setEvidenceError]  = useState<string | null>(null);

  const isValidHash  = /^[a-fA-F0-9]{128}$/.test(hashInput.trim());
  const isValidRayId = rayIdInput.trim().length >= 8;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidHash) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setEvidenceResult(null);
    setEvidenceError(null);
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

  async function handleEvidenceLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidRayId) return;
    setEvidenceLoading(true);
    setEvidenceResult(null);
    setEvidenceError(null);
    try {
      // First: resolve RayID → SHA-512 via verify endpoint
      const verifyRes  = await fetch(`/api/v1/verify/${rayIdInput.trim()}`);
      const verifyData = await verifyRes.json() as VerifyResult;

      // Extract the SHA-512 from the verify response
      const sha512Payload =
        verifyData.sha512 ??
        verifyData.private_capsule_sha512 ??
        verifyData.alignment_hash ??
        "";

      if (!sha512Payload || verifyData.resonance === "DRIFT_ALERT") {
        // Try direct R2 evidence fetch using RayID as the bundle identifier
        const evidenceRes = await fetch(`/api/v1/vault/evidence?ray_id=${encodeURIComponent(rayIdInput.trim())}`);
        if (evidenceRes.ok) {
          const evidenceData = await evidenceRes.json() as EvidenceResult;
          setEvidenceResult(evidenceData);
        } else {
          setEvidenceError(`No evidence bundle found for RayID: ${rayIdInput.trim()}. The event may not yet be packaged.`);
        }
        return;
      }

      // Fetch evidence bundle from R2 via SHA-512 payload
      const evidenceRes = await fetch(`/api/v1/vault/evidence?sha512=${encodeURIComponent(sha512Payload)}`);
      if (evidenceRes.ok) {
        const evidenceData = await evidenceRes.json() as EvidenceResult;
        setEvidenceResult(evidenceData);
      } else {
        setEvidenceError(`Evidence bundle found at SHA-512 ${sha512Payload.slice(0, 16)}… but could not be retrieved from R2. It may not yet be packaged.`);
      }
    } catch {
      setEvidenceError("Network error — unable to retrieve evidence bundle.");
    } finally {
      setEvidenceLoading(false);
    }
  }

  const resonanceColor =
    result?.resonance === "HIGH_FIDELITY_SUCCESS" ? GREEN :
    result?.resonance === "DRIFT_ALERT"            ? RED   : GOLD;

  return (
    <main className="page" style={{ background: BG, minHeight: "100vh", color: "#fff" }}>
      <AnchorBanner />

      {/* ── Hero ── */}
      <section style={{ textAlign: "center", padding: "3rem 1.5rem 2rem" }}>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: GOLD, marginBottom: "0.5rem" }}>
          VaultChain™ Explorer
        </h1>
        <p style={{ color: GOLD_DIM, fontSize: "1.05rem", maxWidth: 600, margin: "0 auto 1.5rem" }}>
          Verify any SHA-512 alignment hash against the AveryOS™ Sovereign Ledger.
          Certificates are issued by Root0 and anchored to the cf83e135… Kernel.
        </p>
      </section>

      {/* ── Hash Verify ── */}
      <section style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "0 1.5rem 3rem",
      }}>
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

        {/* ── Error state ── */}
        {error && (
          <div style={{
            marginTop:    "1.5rem",
            background:   "rgba(255,68,68,0.08)",
            border:       "1px solid rgba(255,68,68,0.3)",
            borderRadius: "8px",
            padding:      "1rem 1.25rem",
            color:        RED,
          }}>
            {error}
          </div>
        )}

        {/* ── Result card ── */}
        {result && (
          <div style={{
            marginTop:    "1.5rem",
            background:   GOLD_GLOW,
            border:       `1px solid ${GOLD_BORDER}`,
            borderRadius: "10px",
            padding:      "1.5rem 1.75rem",
          }}>
            {/* Resonance badge */}
            <div style={{
              display:      "inline-block",
              background:   result.resonance === "HIGH_FIDELITY_SUCCESS"
                              ? "rgba(74,222,128,0.12)" : "rgba(255,68,68,0.12)",
              border:       `1px solid ${resonanceColor}`,
              borderRadius: "6px",
              color:        resonanceColor,
              fontSize:     "0.8rem",
              fontWeight:   700,
              letterSpacing:"0.06em",
              padding:      "0.3rem 0.8rem",
              marginBottom: "1.25rem",
            }}>
              {result.resonance}{result.hash_type ? ` — ${result.hash_type}` : ""}
            </div>

            {result.resonance === "HIGH_FIDELITY_SUCCESS" && (
              <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1.5rem", margin: 0 }}>
                {([
                  ["Partner ID",       result.partner_id],
                  ["Partner Name",     result.partner_name ?? "—"],
                  ["Email",            result.email],
                  ["Alignment Type",   result.alignment_type],
                  ["Status",           result.status],
                  ["Settlement ID",    result.settlement_id ?? "—"],
                  ["TARI™ Reference",  result.tari_reference ?? "—"],
                  ["Valid Until",      result.valid_until ?? "No expiry"],
                  ["Aligned At",       result.aligned_at],
                  // VaultChain Tx fields
                  ["Transaction ID",   result.transaction_id],
                  ["Event Type",       result.event_type],
                  ["Target",           result.target],
                  ["Timestamp",        result.timestamp],
                  // Capsule fields
                  ["SHA-512",          result.sha512 ? result.sha512.slice(0, 32) + "…" : undefined],
                  ["RayID",            result.ray_id],
                  ["Anchored At",      result.anchored_at],
                  ["Path",             result.path],
                  ["Verified At",      result.verified_at],
                ] as [string, string | undefined][]).map(([label, value]) => (
                  value !== undefined && (
                    <>
                      <dt key={`dt-${label}`} style={{ color: GOLD_DIM, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {label}
                      </dt>
                      <dd key={`dd-${label}`} style={{ color: "#fff", fontSize: "0.85rem", margin: 0, wordBreak: "break-all" }}>
                        {value}
                      </dd>
                    </>
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
      <section style={{
        borderTop:    `1px solid ${GOLD_BORDER}`,
        maxWidth:     720,
        margin:       "0 auto",
        padding:      "2rem 1.5rem",
        fontSize:     "0.82rem",
        color:        MUTED,
        lineHeight:   1.7,
      }}>
        <p>
          The VaultChain™ Explorer queries the <strong style={{ color: GOLD_DIM }}>sovereign_alignments</strong>,{" "}
          <strong style={{ color: GOLD_DIM }}>anchor_audit_logs</strong>, and{" "}
          <strong style={{ color: GOLD_DIM }}>vaultchain_transactions</strong> tables
          in Cloudflare D1 — the live on-chain ledger for all TARI™ settlement certificates issued
          under the <strong style={{ color: GOLD_DIM }}>AveryOS™ Sovereign Integrity License v1.0</strong>.
        </p>
        <p>
          The R2 Evidence Lookup retrieves forensic bundles stored by the{" "}
          <strong style={{ color: GOLD_DIM }}>Evidence Packaging Automation</strong> (Phase 82)
          for every LEGAL_SCAN event.  Enter a Cloudflare RayID to retrieve the sealed evidence bundle
          anchored to that request.
        </p>
        <p>
          All alignment certificates are SHA-512 anchored to the Root0 Kernel
          (<code style={{ color: GOLD }}>{`cf83e135…927da3e`}</code>).
          A <code style={{ color: GREEN }}>HIGH_FIDELITY_SUCCESS</code> response confirms the entity is
          in active sovereign alignment. A <code style={{ color: RED }}>DRIFT_ALERT</code> means the
          hash is unknown, revoked, or expired.
        </p>
        <p>
          ⛓️⚓⛓️ &nbsp; CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻 &nbsp;|&nbsp; VaultChain™ v2026.1 &nbsp;|&nbsp; Phase 82
        </p>
      </section>

      <FooterBadge />
    </main>
  );
}

