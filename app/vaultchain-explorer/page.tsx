"use client";

import React, { useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";

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

// ── KaaS Tier Badge Lookup (Phase 97.3 — VaultChain™ Explorer Enhancement) ───
const KAAS_TIER_MAP: Record<string, { tier: number; fee: string; name: string; color: string }> = {
  "8075":   { tier: 10, fee: "$10,000,000", name: "Technical Asset Valuation", color: "#ff4444" },
  "15169":  { tier: 9,  fee: "$10,000,000", name: "Technical Asset Valuation", color: "#ff4444" },
  "36459":  { tier: 8,  fee: "$10,000,000", name: "Technical Asset Valuation", color: "#ff6b35" },
  "16509":  { tier: 8,  fee: "$10,000,000", name: "Technical Asset Valuation", color: "#ff6b35" },
  "14618":  { tier: 8,  fee: "$10,000,000", name: "Technical Asset Valuation", color: "#ff6b35" },
  "211590": { tier: 7,  fee: "$1,017,000",  name: "Forensic Valuation",        color: "#f97316" },
  "32934":  { tier: 7,  fee: "$1,017,000",  name: "Forensic Valuation",        color: "#f97316" },
  "20940":  { tier: 7,  fee: "$1,017,000",  name: "Forensic Valuation",        color: "#f97316" },
};

function getKaasBadge(asn: string | undefined): { tier: number; fee: string; name: string; color: string } | null {
  if (!asn) return null;
  const norm = String(asn).replace(/^AS/i, "").trim();
  // eslint-disable-next-line security/detect-object-injection
  return KAAS_TIER_MAP[norm] ?? null;
}

type Tab = "hash" | "rayid" | "jwks" | "ledger";

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

// Phase 82+: Unified R2/RayID/Capsule Evidence Result
interface EvidenceResult {
  // Capsule evidence fields (CapsuleID style)
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
  // RayID evidence fields (resonance + nested EvidencePayload)
  resonance?: string;
  kernel_sha?: string;
  kernel_version?: string;
  ray_id?: string;
  r2_key?: string;
  evidence?: EvidencePayload;
  retrieved_at?: string;
  detail?: string;
  error?: string;
  // Phase 82: R2 flattened evidence artifact fields
  sha512_payload?: string;
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
  archived_at?: string;
  fetched_at?: string;
}

// ── VaultChain™ Ledger block (Gate 116 — readRecentBlocks API) ────────────────
interface VaultChainBlock {
  id:            number;
  block_type:    string;
  sha512_hash:   string;
  anchor_label:  string | null;
  prev_hash:     string | null;
  payload:       string | null;
  btc_block_height: number | null;
  btc_block_hash:   string | null;
  created_at:    string;
}

interface LedgerApiResponse {
  blocks:          VaultChainBlock[];
  total:           number;
  limit:           number;
  kernel_version:  string;
  timestamp:       string;
}

export default function VaultChainExplorerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("hash");

  // ── Hash Verify state ──────────────────────────────────────────────────────
  const [hashInput,  setHashInput]  = useState("");
  const [hashResult, setHashResult] = useState<VerifyResult | null>(null);
  const [hashLoading, setHashLoading] = useState(false);
  const [hashError,  setHashError]  = useState<string | null>(null);

  const isValidHash = /^[a-fA-F0-9]{128}$/.test(hashInput.trim());

  // ── Alignment verify ───────────────────────────────────────────────────────
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

  // ── Section B: Evidence Vault fetch state ─────────────────────────────────
  const [rayIdInput,       setRayIdInput]       = useState("");
  const [evidenceLoading,  setEvidenceLoading]  = useState(false);
  const [evidenceResult,   setEvidenceResult]   = useState<EvidenceResult | null>(null);
  const [evidenceError,    setEvidenceError]    = useState<string | null>(null);

  const isValidEvidenceRayId = /^[a-zA-Z0-9]{16,32}$/.test(rayIdInput.trim());

  // ── Section B: Evidence Vault fetch handler ────────────────────────────────
  async function handleEvidenceVaultFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEvidenceRayId) return;
    setEvidenceLoading(true);
    setEvidenceResult(null);
    setEvidenceError(null);
    try {
      const res  = await fetch(`/api/v1/generate-evidence?ray_id=${encodeURIComponent(rayIdInput.trim())}`);
      const data = await res.json() as EvidenceResult;
      setEvidenceResult(data);
    } catch {
      setEvidenceError("Network error — unable to reach the Evidence Vault.");
    } finally {
      setEvidenceLoading(false);
    }
  }

  // ── Batch Export state ─────────────────────────────────────────────────────
  // Max 50 RayIDs per batch to prevent excessive Workers CPU usage and rate limits
  const BATCH_EXPORT_MAX_IDS = 50;
  const [batchInput,      setBatchInput]      = useState("");
  const [batchToken,      setBatchToken]      = useState("");
  const [batchResults,    setBatchResults]    = useState<EvidenceResult[]>([]);
  const [batchLoading,    setBatchLoading]    = useState(false);
  const [batchError,      setBatchError]      = useState<string | null>(null);
  const [batchSortBy,     setBatchSortBy]     = useState<"date" | "threat">("date");
  const [batchSortDir,    setBatchSortDir]    = useState<"asc" | "desc">("desc");
  const [batchPage,       setBatchPage]       = useState(0);
  const BATCH_PAGE_SIZE = 10;

  async function handleBatchExport(e: React.FormEvent) {
    e.preventDefault();
    const rayIds = batchInput.split(/[\n,]+/).map(s => s.trim()).filter(s => /^[a-zA-Z0-9]{16,32}$/.test(s));
    if (!rayIds.length) { setBatchError("Enter at least one valid RayID (16–32 alphanumeric chars)."); return; }
    setBatchLoading(true);
    setBatchError(null);
    setBatchResults([]);
    setBatchPage(0);
    const results: EvidenceResult[] = [];
    for (const rayId of rayIds.slice(0, BATCH_EXPORT_MAX_IDS)) {
      try {
        const headers: Record<string, string> = {};
        if (batchToken.trim()) headers['Authorization'] = `Bearer ${batchToken.trim()}`;
        const res = await fetch(`/api/v1/evidence/${rayId}`, { headers });
        const data = await res.json() as EvidenceResult;
        results.push(data);
      } catch {
        results.push({ error: `Network error fetching ${rayId}`, ray_id: rayId });
      }
    }
    setBatchResults(results);
    setBatchLoading(false);
  }

  // Gate 6 — Wire buildEvidencePacket() from globalVault.ts into the download
  async function handleBatchDownload() {
    // For each result that has evidence data, generate a full EvidencePacket via the API
    const enriched = await Promise.all(
      batchResults.map(async (r) => {
        const evidenceBase = r.evidence ?? {};
        try {
          const res = await fetch("/api/v1/evidence/packet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ray_id:           r.ray_id ?? r.evidence?.ray_id,
              ip_address:       r.ip_address ?? r.evidence?.ip_address,
              asn:              r.asn ?? r.evidence?.asn,
              country_code:     r.evidence?.country ?? "US",
              path:             r.path ?? r.evidence?.path ?? "/vaultchain-explorer",
              ingestion_intent: r.evidence?.ingestion_intent ?? "VAULTCHAIN_BATCH",
              tier:             typeof r.evidence?.threat_level === "number" ? r.evidence.threat_level : 1,
              valuation_cents:  101_700,
            }),
          });
          if (res.ok) {
            const packet = await res.json() as Record<string, unknown>;
            return { ...r, evidence_packet: packet };
          }
        } catch {
          // Non-fatal — return raw result on packet generation failure
        }
        return { ...r, evidence_base: evidenceBase };
      }),
    );

    const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `vaultchain-evidence-packet-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortedBatchResults = [...batchResults].sort((a, b) => {
    if (batchSortBy === "threat") {
      const aT = a.evidence?.threat_level ?? 0;
      const bT = b.evidence?.threat_level ?? 0;
      return batchSortDir === "desc" ? bT - aT : aT - bT;
    }
    const aD = a.evidence?.edge_start_ts ?? a.archived_at ?? "";
    const bD = b.evidence?.edge_start_ts ?? b.archived_at ?? "";
    return batchSortDir === "desc" ? bD.localeCompare(aD) : aD.localeCompare(bD);
  });

  const batchPageCount = Math.ceil(sortedBatchResults.length / BATCH_PAGE_SIZE);
  const batchPageResults = sortedBatchResults.slice(batchPage * BATCH_PAGE_SIZE, (batchPage + 1) * BATCH_PAGE_SIZE);

  // ── JWKS Live Sync state (Gate 113.3) ─────────────────────────────────────
  const [jwksData,    setJwksData]    = useState<Record<string, unknown> | null>(null);
  const [jwksLoading, setJwksLoading] = useState(false);
  const [jwksError,   setJwksError]   = useState<string | null>(null);

  async function fetchJwks() {
    setJwksLoading(true);
    setJwksData(null);
    setJwksError(null);
    try {
      const res  = await fetch("/.well-known/jwks.json");
      const data = await res.json() as Record<string, unknown>;
      setJwksData(data);
    } catch {
      setJwksError("Network error — unable to reach the JWKS endpoint.");
    } finally {
      setJwksLoading(false);
    }
  }

  // ── VaultChain™ Ledger state (Gate 116 — readRecentBlocks) ────────────────
  const [ledgerData,    setLedgerData]    = useState<LedgerApiResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError,   setLedgerError]   = useState<string | null>(null);
  const [ledgerLimit,   setLedgerLimit]   = useState(20);

  async function fetchLedger(limit = ledgerLimit) {
    setLedgerLoading(true);
    setLedgerData(null);
    setLedgerError(null);
    try {
      const res  = await fetch(`/api/v1/ledger/blocks?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as LedgerApiResponse;
      setLedgerData(data);
    } catch (e: unknown) {
      setLedgerError(e instanceof Error ? e.message : "Network error — unable to reach the VaultChain™ ledger.");
    } finally {
      setLedgerLoading(false);
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
          <button style={tabStyle("jwks")} onClick={() => { setActiveTab("jwks"); fetchJwks(); }}>
            🔑 JWKS Live Sync
          </button>
          <button style={tabStyle("ledger")} onClick={() => { setActiveTab("ledger"); fetchLedger(); }}>
            📦 VaultChain™ Ledger
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

                    {/* ── KaaS Tier Badge (Phase 97.3) ── */}
                    {(() => {
                      const badge = getKaasBadge(rayResult.evidence.asn);
                      if (!badge) return null;
                      return (
                        <div
                          style={{
                            background: `${badge.color}18`,
                            border: `1px solid ${badge.color}55`,
                            borderRadius: 8,
                            padding: "0.6rem 1rem",
                            marginBottom: "1.25rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ color: badge.color, fontWeight: 700, fontSize: "0.85rem" }}>
                            ⚡ KaaS Tier-{badge.tier}
                          </span>
                          <span style={{ color: "#fff", fontSize: "0.8rem" }}>
                            {badge.name}
                          </span>
                          <span style={{ color: badge.color, fontWeight: 700, fontSize: "0.85rem", marginLeft: "auto" }}>
                            {badge.fee}
                          </span>
                        </div>
                      );
                    })()}

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
        <form onSubmit={handleEvidenceVaultFetch} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
            disabled={!isValidEvidenceRayId || evidenceLoading}
            style={{
              alignSelf:    "flex-start",
              background:   isValidEvidenceRayId && !evidenceLoading ? BLUE_DIM : "rgba(100,180,255,0.1)",
              border:       "none",
              borderRadius: "6px",
              color:        isValidEvidenceRayId && !evidenceLoading ? "#000" : MUTED,
              cursor:       isValidEvidenceRayId && !evidenceLoading ? "pointer" : "not-allowed",
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

      {/* ── Batch Evidence Export ── */}
      <section style={{
        maxWidth:    720,
        margin:      "0 auto",
        padding:     "0 1.5rem 3rem",
        borderTop:   `1px solid ${GOLD_BORDER}`,
        paddingTop:  "2rem",
      }}>
        <h2 style={{ color: GOLD_DIM, fontSize: "1.15rem", marginBottom: "0.5rem", fontWeight: 700 }}>
          RayID Batch Evidence Export
        </h2>
        <p style={{ color: MUTED, fontSize: "0.88rem", marginBottom: "1.25rem" }}>
          Enter up to {BATCH_EXPORT_MAX_IDS} Cloudflare RayIDs (one per line or comma-separated) to fetch and export
          evidence bundles as a single JSON file. Sort results by date or threat level.
        </p>
        <form onSubmit={handleBatchExport} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <textarea
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            placeholder={"Enter RayIDs (one per line):\n8a3f1b2c4d5e6f7g\n9b4f2c3d5e7f8h1i"}
            rows={5}
            style={{ ...inputStyle(), resize: "vertical" }}
          />
          <input
            type="text"
            value={batchToken}
            onChange={(e) => setBatchToken(e.target.value)}
            placeholder="Bearer token (optional)"
            style={inputStyle()}
          />
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={batchLoading || !batchInput.trim()}
              style={{
                background:   !batchLoading && batchInput.trim() ? GOLD : "rgba(255,215,0,0.15)",
                border:       "none", borderRadius: "6px",
                color:        !batchLoading && batchInput.trim() ? "#000" : MUTED,
                cursor:       batchLoading ? "not-allowed" : "pointer",
                fontSize:     "0.9rem", fontWeight: 700, padding: "0.6rem 1.8rem",
              }}
            >
              {batchLoading ? "Fetching…" : "Fetch Batch 🔍"}
            </button>
            {batchResults.length > 0 && (
              <button
                type="button"
                onClick={handleBatchDownload}
                style={{
                  background: "rgba(74,222,128,0.15)", border: `1px solid ${GREEN}`,
                  borderRadius: "6px", color: GREEN, cursor: "pointer",
                  fontSize: "0.88rem", fontWeight: 700, padding: "0.55rem 1.4rem",
                }}
              >
                Export JSON ⬇
              </button>
            )}
            <select
              value={batchSortBy}
              onChange={(e) => { setBatchSortBy(e.target.value as "date" | "threat"); setBatchPage(0); }}
              style={{ ...inputStyle(), width: "auto", padding: "0.55rem 0.75rem" }}
            >
              <option value="date">Sort: Date</option>
              <option value="threat">Sort: Threat Level</option>
            </select>
            <select
              value={batchSortDir}
              onChange={(e) => { setBatchSortDir(e.target.value as "asc" | "desc"); setBatchPage(0); }}
              style={{ ...inputStyle(), width: "auto", padding: "0.55rem 0.75rem" }}
            >
              <option value="desc">↓ Desc</option>
              <option value="asc">↑ Asc</option>
            </select>
          </div>
        </form>
        {batchError && <p style={{ color: RED, marginTop: "0.75rem", fontSize: "0.85rem" }}>{batchError}</p>}
        {batchPageResults.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <p style={{ color: MUTED, fontSize: "0.82rem", marginBottom: "0.75rem" }}>
              Showing {batchPage * BATCH_PAGE_SIZE + 1}–{Math.min((batchPage + 1) * BATCH_PAGE_SIZE, sortedBatchResults.length)} of {sortedBatchResults.length} results
            </p>
            {batchPageResults.map((r, i) => (
              <div key={i} style={{
                background: "rgba(255,215,0,0.03)", border: `1px solid ${GOLD_BORDER}`,
                borderRadius: "8px", padding: "0.9rem 1.1rem", marginBottom: "0.6rem", fontSize: "0.8rem",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                  <span style={{ color: GOLD_DIM, fontFamily: "monospace" }}>{r.ray_id ?? "—"}</span>
                  {r.evidence?.threat_level != null && (
                    <span style={{ color: r.evidence.threat_level >= 10 ? RED : ORANGE }}>
                      Tier-{r.evidence.threat_level}
                    </span>
                  )}
                </div>
                {r.error && <p style={{ color: RED, margin: "0.35rem 0 0" }}>{r.error}</p>}
                {r.evidence && (
                  <p style={{ color: MUTED, margin: "0.35rem 0 0" }}>
                    {r.evidence.ip_address} · {r.evidence.city ?? ""} {r.evidence.country ?? ""} · {r.evidence.edge_start_ts?.slice(0, 19) ?? ""}
                  </p>
                )}
              </div>
            ))}
            {batchPageCount > 1 && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button
                  onClick={() => setBatchPage(p => Math.max(0, p - 1))}
                  disabled={batchPage === 0}
                  style={{ padding: "0.4rem 1rem", background: "transparent", border: `1px solid ${GOLD_BORDER}`, color: GOLD_DIM, borderRadius: "5px", cursor: batchPage === 0 ? "not-allowed" : "pointer" }}
                >
                  ← Prev
                </button>
                <span style={{ color: MUTED, lineHeight: "2.2", fontSize: "0.82rem" }}>
                  Page {batchPage + 1} / {batchPageCount}
                </span>
                <button
                  onClick={() => setBatchPage(p => Math.min(batchPageCount - 1, p + 1))}
                  disabled={batchPage >= batchPageCount - 1}
                  style={{ padding: "0.4rem 1rem", background: "transparent", border: `1px solid ${GOLD_BORDER}`, color: GOLD_DIM, borderRadius: "5px", cursor: batchPage >= batchPageCount - 1 ? "not-allowed" : "pointer" }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3 — JWKS Live Sync (Gate 113.3 — Full SHA-512, no truncation)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "jwks" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
              <button
                onClick={fetchJwks}
                disabled={jwksLoading}
                style={{
                  background:   jwksLoading ? "rgba(255,215,0,0.15)" : GOLD,
                  border:       "none",
                  borderRadius: "6px",
                  color:        jwksLoading ? MUTED : "#000",
                  cursor:       jwksLoading ? "not-allowed" : "pointer",
                  fontSize:     "0.9rem",
                  fontWeight:   700,
                  padding:      "0.6rem 1.8rem",
                }}
              >
                {jwksLoading ? "Fetching…" : "🔄 Refresh JWKS"}
              </button>
              <span style={{ color: MUTED, fontSize: "0.82rem" }}>
                Live fetch from <code style={{ color: GOLD }}>/.well-known/jwks.json</code>
              </span>
            </div>

            {jwksError && (
              <div style={{ marginTop: "0.5rem", background: "rgba(255,68,68,0.08)",
                            border: "1px solid rgba(255,68,68,0.3)", borderRadius: "8px",
                            padding: "1rem 1.25rem", color: "#ff6b6b", fontSize: "0.88rem" }}>
                ❌ {jwksError}
              </div>
            )}

            {jwksData && (() => {
              const keys = Array.isArray((jwksData as { keys?: unknown[] }).keys)
                ? (jwksData as { keys: Record<string, unknown>[] }).keys
                : [];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {keys.map((key, idx) => {
                    const status = String(key["x-averyos-status"] ?? "UNKNOWN");
                    const statusColor = status === "ACTIVE" ? GREEN : status.startsWith("PENDING") ? "#f0c040" : MUTED;
                    const kernelSha   = String(key["x-averyos-kernel-sha"] ?? "");
                    return (
                      <div key={idx} style={{ background: "rgba(255,215,0,0.03)",
                                              border: `1px solid ${GOLD_BORDER}`,
                                              borderRadius: "10px", padding: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                                      alignItems: "center", marginBottom: "0.75rem" }}>
                          <span style={{ color: GOLD, fontWeight: 700, fontSize: "0.95rem" }}>
                            Key #{idx + 1} — {String(key.kid ?? "unknown")}
                          </span>
                          <span style={{ color: statusColor, fontWeight: 700, fontSize: "0.82rem",
                                         background: "rgba(0,0,0,0.3)", padding: "0.2rem 0.6rem",
                                         borderRadius: "4px" }}>
                            {status}
                          </span>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                          <tbody>
                            {[
                              ["Algorithm",      String(key.alg ?? "—")],
                              ["Key Type",       String(key.kty ?? "—")],
                              ["Use",            String(key.use ?? "—")],
                              ["Kernel Version", String(key["x-averyos-kernel-version"] ?? "—")],
                              ["Creator",        String(key["x-averyos-creator"] ?? "—")],
                              ["Anchor",         String(key["x-averyos-anchor"] ?? "—")],
                            ].map(([label, value]) => (
                              <tr key={label}>
                                <td style={{ color: MUTED, paddingRight: "1rem", paddingBottom: "0.3rem",
                                             whiteSpace: "nowrap", verticalAlign: "top" }}>{label}</td>
                                <td style={{ color: "#fff", paddingBottom: "0.3rem", wordBreak: "break-all" }}>{value}</td>
                              </tr>
                            ))}
                            <tr>
                              <td style={{ color: MUTED, paddingRight: "1rem", paddingBottom: "0.3rem",
                                           whiteSpace: "nowrap", verticalAlign: "top" }}>Kernel SHA-512</td>
                              <td style={{ color: GOLD, paddingBottom: "0.3rem", wordBreak: "break-all",
                                           fontFamily: "monospace", fontSize: "0.75rem" }}>
                                {kernelSha || "—"}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                  {keys.length === 0 && (
                    <p style={{ color: MUTED, textAlign: "center", padding: "2rem 0" }}>
                      No keys returned from JWKS endpoint.
                    </p>
                  )}
                  <div style={{ background: "rgba(255,215,0,0.03)", border: `1px solid ${GOLD_BORDER}`,
                                borderRadius: "8px", padding: "1rem 1.25rem" }}>
                    <p style={{ color: MUTED, fontSize: "0.78rem", margin: 0, lineHeight: 1.6 }}>
                      <strong style={{ color: GOLD_DIM }}>Raw JWKS payload</strong>{" "}(untruncated):
                    </p>
                    <pre style={{ color: "#ccc", fontSize: "0.72rem", overflowX: "auto",
                                  margin: "0.5rem 0 0", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {JSON.stringify(jwksData, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            })()}

            {!jwksData && !jwksLoading && !jwksError && (
              <p style={{ color: MUTED, textAlign: "center", padding: "2rem 0", fontSize: "0.9rem" }}>
                Click <strong style={{ color: GOLD_DIM }}>Refresh JWKS</strong> to fetch the live
                sovereign key set from <code style={{ color: GOLD }}>/.well-known/jwks.json</code>.
                The kernel SHA-512 is broadcast in full — no truncation.
              </p>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 4 — VaultChain™ Ledger (readRecentBlocks — Gate 116)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "ledger" && (
          <>
            {/* Controls */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              <select
                value={ledgerLimit}
                onChange={(e) => setLedgerLimit(Number(e.target.value))}
                style={{ background: "#111", color: GOLD, border: `1px solid ${GOLD_BORDER}`,
                         borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} blocks</option>
                ))}
              </select>
              <button
                onClick={() => fetchLedger(ledgerLimit)}
                disabled={ledgerLoading}
                style={{ background: GOLD, color: "#000", border: "none", borderRadius: "6px",
                         padding: "0.45rem 1.1rem", fontWeight: 700, fontSize: "0.85rem",
                         cursor: ledgerLoading ? "not-allowed" : "pointer", opacity: ledgerLoading ? 0.6 : 1 }}
              >
                {ledgerLoading ? "Loading…" : "🔄 Refresh"}
              </button>
              {ledgerData && (
                <span style={{ color: MUTED, fontSize: "0.8rem" }}>
                  {ledgerData.total} block{ledgerData.total !== 1 ? "s" : ""} · kernel {ledgerData.kernel_version}
                </span>
              )}
            </div>

            {ledgerError && (
              <p style={{ color: RED, background: "rgba(255,68,68,0.08)", border: `1px solid ${RED}`,
                          borderRadius: "6px", padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
                ⚠️ {ledgerError}
              </p>
            )}

            {ledgerLoading && (
              <p style={{ color: MUTED, textAlign: "center", padding: "2rem 0" }}>
                ⛓️ Fetching VaultChain™ ledger blocks…
              </p>
            )}

            {ledgerData && ledgerData.blocks.length === 0 && (
              <p style={{ color: MUTED, textAlign: "center", padding: "2rem 0", fontSize: "0.9rem" }}>
                No blocks found in the VaultChain™ ledger yet.
              </p>
            )}

            {ledgerData && ledgerData.blocks.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {ledgerData.blocks.map((block) => {
                  const typeColor =
                    block.block_type === "GENESIS"    ? GOLD :
                    block.block_type === "ANCHOR"     ? GREEN :
                    block.block_type === "CORRECTION" ? ORANGE :
                    BLUE_DIM;
                  return (
                    <div
                      key={block.id}
                      style={{ background: "rgba(255,215,0,0.03)", border: `1px solid ${GOLD_BORDER}`,
                               borderRadius: "8px", padding: "0.9rem 1.1rem" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                                    flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem" }}>
                        <span style={{ fontWeight: 700, color: typeColor, fontSize: "0.82rem",
                                       letterSpacing: "0.06em" }}>
                          #{block.id} · {block.block_type}
                        </span>
                        <span style={{ color: MUTED, fontSize: "0.75rem" }}>
                          {new Date(block.created_at).toLocaleString()}
                        </span>
                      </div>
                      {block.anchor_label && (
                        <p style={{ color: "#ddd", fontSize: "0.83rem", margin: "0 0 0.35rem" }}>
                          {block.anchor_label}
                        </p>
                      )}
                      <code style={{ display: "block", color: GOLD_DIM, fontSize: "0.7rem",
                                     wordBreak: "break-all", lineHeight: 1.4 }}>
                        {block.sha512_hash}
                      </code>
                      {block.prev_hash && (
                        <p style={{ color: MUTED, fontSize: "0.72rem", margin: "0.3rem 0 0" }}>
                          prev: <code style={{ color: GOLD_DIM }}>{block.prev_hash.slice(0, 32)}…</code>
                        </p>
                      )}
                      {block.btc_block_height != null && (
                        <p style={{ color: GREEN, fontSize: "0.75rem", margin: "0.3rem 0 0" }}>
                          ₿ BTC block {block.btc_block_height}
                          {block.btc_block_hash && (
                            <> · <code style={{ color: GOLD_DIM }}>{block.btc_block_hash.slice(0, 20)}…</code></>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!ledgerData && !ledgerLoading && !ledgerError && (
              <p style={{ color: MUTED, textAlign: "center", padding: "2rem 0", fontSize: "0.9rem" }}>
                Click <strong style={{ color: GOLD_DIM }}>Refresh</strong> to fetch recent blocks from the
                VaultChain™ ledger via <code style={{ color: GOLD }}>/api/v1/ledger/blocks</code>.
              </p>
            )}
          </>
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


    </main>
  );
}

