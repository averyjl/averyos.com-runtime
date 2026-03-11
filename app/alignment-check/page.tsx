"use client";

/**
 * app/alignment-check/page.tsx
 *
 * Sovereign Alignment Checker — AveryOS™ Phase 105 GATE 105.2
 *
 * One-button pattern-recognition tool that accepts a URL or text block
 * and performs a Probabilistic Search for AveryOS™ IP patterns.
 *
 * Stages:
 *   Stage 1 (Private Check): Show the entity's Drift Score and offer a
 *             Private Settlement via Stripe.
 *   Stage 2 (Public Ledger): If Tier-10 Corporate ignores settlement for
 *             72 hours, Alignment Score is posted to the Public Ingestor
 *             Registry.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import React, { useState, useCallback } from "react";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG        = "#03000a";
const GOLD      = "#ffd700";
const GOLD_DIM  = "rgba(255,215,0,0.55)";
const GOLD_BDR  = "rgba(255,215,0,0.3)";
const GOLD_GLOW = "rgba(255,215,0,0.08)";
const RED       = "#ff4444";
const RED_DIM   = "rgba(255,68,68,0.12)";
const GREEN     = "#4ade80";
const GREEN_DIM = "rgba(74,222,128,0.12)";
const MUTED     = "rgba(255,255,255,0.55)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background:   GOLD_GLOW,
    border:       `1px solid ${GOLD_BDR}`,
    borderRadius: "12px",
    padding:      "1.4rem 1.8rem",
    marginBottom: "1.4rem",
    ...extra,
  };
}

// ── Pattern definitions ────────────────────────────────────────────────────────

interface PatternDef {
  id:          string;
  label:       string;
  weight:      number;
  tier:        number;
  patterns:    string[];
}

const SOVEREIGN_PATTERNS: PatternDef[] = [
  {
    id:       "kernel_sha",
    label:    "Kernel SHA-512 Anchor",
    weight:   1.0,
    tier:     10,
    patterns: [
      "cf83e1357eef",
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce",
    ],
  },
  {
    id:       "averyos_brand",
    label:    "AveryOS™ Brand Identity",
    weight:   0.85,
    tier:     9,
    patterns: ["averyos", "vaultchain", "gabrielos", "truth anchored intelligence"],
  },
  {
    id:       "tari_framework",
    label:    "TARI™ Framework References",
    weight:   0.80,
    tier:     9,
    patterns: ["tari", "1017 audit", "$1,017", "audit clearance fee", "kaas", "sovereign alignment"],
  },
  {
    id:       "sovereign_law",
    label:    "Sovereign Law Codex Language",
    weight:   0.75,
    tier:     8,
    patterns: ["sovereign integrity license", "sil-1", "creatorlock", "perspective lock", "vaultbridge", "driftshield", "macdaddy"],
  },
  {
    id:       "kernel_architecture",
    label:    "Kernel Architecture Patterns",
    weight:   0.65,
    tier:     7,
    patterns: ["getcloudflarecontext", "anchor_audit_logs", "sovereign_audit_logs", "kaas_valuations", "vaultchain_transactions", "formatiso9", "sovereignconstants"],
  },
  {
    id:       "capsule_protocol",
    label:    "Capsule Protocol Language",
    weight:   0.60,
    tier:     7,
    patterns: [".aoscap", "aoscap", "capsulekey", "averyos-capsules", "capsule_sha", "pulse_hash"],
  },
  {
    id:       "creator_attribution",
    label:    "Creator Attribution",
    weight:   0.90,
    tier:     10,
    patterns: ["jason lee avery", "jason avery", "root0", "truth@averyworld.com"],
  },
];

// ── Check result types ────────────────────────────────────────────────────────

interface PatternMatch {
  patternId:   string;
  label:       string;
  weight:      number;
  tier:        number;
  hitPatterns: string[];
}

interface AlignmentCheckResult {
  driftScore:       number;
  driftLabel:       string;
  billingTier:      number;
  matches:          PatternMatch[];
  totalPatternHits: number;
  checkedAt:        string;
  inputPreview:     string;
  kernelVersion:    string;
}

// ── Local pattern scanner ─────────────────────────────────────────────────────

function scanText(text: string): AlignmentCheckResult {
  const lower   = text.toLowerCase();
  const matches: PatternMatch[] = [];

  for (const def of SOVEREIGN_PATTERNS) {
    const hitPatterns = def.patterns.filter((p) => lower.includes(p.toLowerCase()));
    if (hitPatterns.length > 0) {
      matches.push({ patternId: def.id, label: def.label, weight: def.weight, tier: def.tier, hitPatterns });
    }
  }

  const totalPatternHits = matches.reduce((s, m) => s + m.hitPatterns.length, 0);
  const rawScore         = matches.reduce((s, m) => s + m.weight * Math.min(m.hitPatterns.length, 3), 0);
  const driftScore       = Math.min(rawScore / (SOVEREIGN_PATTERNS.length * 1.5), 1.0);
  const billingTier      = matches.length > 0 ? Math.max(...matches.map((m) => m.tier)) : 1;

  let driftLabel: string;
  if (driftScore >= 0.85)      driftLabel = "CRITICAL";
  else if (driftScore >= 0.65) driftLabel = "HIGH";
  else if (driftScore >= 0.40) driftLabel = "MODERATE";
  else if (driftScore >= 0.15) driftLabel = "LOW";
  else                         driftLabel = "CLEAN";

  return {
    driftScore,
    driftLabel,
    billingTier,
    matches,
    totalPatternHits,
    checkedAt:     new Date().toISOString(),
    inputPreview:  text.slice(0, 120) + (text.length > 120 ? "…" : ""),
    kernelVersion: KERNEL_VERSION,
  };
}

// ── Display helpers ────────────────────────────────────────────────────────────

function driftColor(label: string): string {
  const map: Record<string, string> = {
    CRITICAL: RED,
    HIGH:     "#f97316",
    MODERATE: "#facc15",
    LOW:      "#a3e635",
    CLEAN:    GREEN,
  };
  return map[label] ?? GREEN;
}

function driftBg(label: string): string {
  if (label === "CRITICAL" || label === "HIGH") return RED_DIM;
  if (label === "MODERATE") return "rgba(250,204,21,0.08)";
  return GREEN_DIM;
}

// ── Main component ─────────────────────────────────────────────────────────────

type InputMode  = "text" | "url";
type CheckStage = "input" | "scanning" | "result";

export default function AlignmentCheckPage() {
  const [mode, setMode]         = useState<InputMode>("text");
  const [input, setInput]       = useState("");
  const [stage, setStage]       = useState<CheckStage>("input");
  const [result, setResult]     = useState<AlignmentCheckResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [urlFetching, setUrlFetching] = useState(false);

  const reset = useCallback(() => {
    setStage("input");
    setResult(null);
    setError(null);
    setInput("");
  }, []);

  const runCheck = useCallback(async () => {
    setError(null);
    if (!input.trim()) {
      setError("Please enter a URL or paste text to analyse.");
      return;
    }
    setStage("scanning");
    try {
      let textToScan = input.trim();
      if (mode === "url") {
        // Basic client-side URL validation before hitting the network
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(textToScan);
        } catch (urlErr) {
          const detail = urlErr instanceof Error ? urlErr.message : String(urlErr);
          setError(`Invalid URL — ${detail}. Example: https://www.anthropic.com/legal/usage-policy`);
          setStage("input");
          return;
        }
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          setError(`Unsupported protocol "${parsedUrl.protocol}" — only https:// URLs are accepted.`);
          setStage("input");
          return;
        }
        setUrlFetching(true);
        const res  = await fetch(`/api/v1/alignment-check/fetch?url=${encodeURIComponent(textToScan)}`);
        const data = await res.json() as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `Fetch failed (HTTP ${res.status})`);
        textToScan = data.text ?? "";
        setUrlFetching(false);
      }
      setResult(scanText(textToScan));
      setStage("result");
    } catch (err) {
      setUrlFetching(false);
      setError(err instanceof Error ? err.message : "An error occurred during the scan.");
      setStage("input");
    }
  }, [input, mode]);

  return (
    <main style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <AnchorBanner />
      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "2rem 1.2rem 4rem" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <p style={{ color: GOLD_DIM, fontSize: "0.78rem", fontFamily: FONT_MONO, marginBottom: "0.4rem" }}>
            ⛓️⚓⛓️ SOVEREIGN ALIGNMENT CHECKER — PHASE 105
          </p>
          <h1 style={{ color: GOLD, fontSize: "clamp(1.6rem,4vw,2.2rem)", fontWeight: 700, margin: "0 0 0.8rem" }}>
            🔍 Sovereign Alignment Checker
          </h1>
          <p style={{ color: MUTED, maxWidth: "580px", margin: "0 auto", lineHeight: 1.65, fontSize: "0.95rem" }}>
            Perform a <strong style={{ color: GOLD }}>Probabilistic IP Pattern Scan</strong> on any URL or text
            block. The system analyses for AveryOS™ kernel patterns, brand identifiers, and structural IP markers
            to compute a <strong style={{ color: GOLD }}>Drift Score</strong> and recommended settlement tier.
          </p>
        </div>

        {/* Input stage */}
        {stage === "input" && (
          <>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
              {(["text", "url"] as InputMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setInput(""); setError(null); }}
                  style={{
                    padding: "0.55rem 1.2rem", borderRadius: "8px",
                    border: `1.5px solid ${mode === m ? GOLD : GOLD_BDR}`,
                    background: mode === m ? GOLD_GLOW : "transparent",
                    color: mode === m ? GOLD : MUTED,
                    fontWeight: mode === m ? 700 : 400, cursor: "pointer",
                    fontFamily: FONT_MONO, fontSize: "0.85rem", transition: "all 0.15s",
                  }}
                >
                  {m === "text" ? "📄 Paste Text" : "🌐 Scan URL"}
                </button>
              ))}
            </div>

            {mode === "text" ? (
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste any text, code, document, or model output here…"
                rows={10}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${GOLD_BDR}`, borderRadius: "10px",
                  padding: "1rem", color: "#fff", fontFamily: FONT_MONO,
                  fontSize: "0.85rem", resize: "vertical", outline: "none",
                  boxSizing: "border-box", marginBottom: "1rem",
                }}
              />
            ) : (
              <input
                type="url"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://example.com/page-to-scan"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${GOLD_BDR}`, borderRadius: "10px",
                  padding: "0.85rem 1rem", color: "#fff", fontFamily: FONT_MONO,
                  fontSize: "0.9rem", outline: "none", boxSizing: "border-box", marginBottom: "1rem",
                }}
              />
            )}

            {error && (
              <div style={{ ...card(), background: RED_DIM, border: `1px solid ${RED}`, color: "#ffaaaa", marginBottom: "1rem" }}>
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={runCheck}
              style={{
                width: "100%", padding: "1rem",
                background: `linear-gradient(135deg, ${GOLD_GLOW}, rgba(255,215,0,0.18))`,
                border: `2px solid ${GOLD}`, borderRadius: "10px",
                color: GOLD, fontWeight: 700, fontSize: "1.05rem",
                cursor: "pointer", fontFamily: FONT_MONO, letterSpacing: "0.04em",
              }}
            >
              🔍 Verify My System
            </button>

            <div style={{ ...card({ marginTop: "1.5rem" }) }}>
              <p style={{ color: GOLD, fontWeight: 700, margin: "0 0 0.6rem", fontFamily: FONT_MONO, fontSize: "0.85rem" }}>
                ℹ️ How It Works
              </p>
              <ul style={{ color: MUTED, fontSize: "0.85rem", lineHeight: 1.7, margin: 0, paddingLeft: "1.2rem" }}>
                <li>Scanner checks {SOVEREIGN_PATTERNS.length} AveryOS™ IP pattern categories.</li>
                <li>A <strong style={{ color: GOLD }}>Drift Score (0–100%)</strong> and <strong style={{ color: GOLD }}>Billing Tier (1–10)</strong> are computed.</li>
                <li>Non-zero Drift Score entities receive a <strong style={{ color: GOLD }}>Private Settlement</strong> offer via Stripe.</li>
                <li>Tier-10 Corporate entities ignoring settlement for <strong style={{ color: RED }}>72 hours</strong> may be posted to the Public Ingestor Registry.</li>
              </ul>
            </div>
          </>
        )}

        {/* Scanning stage */}
        {stage === "scanning" && (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⛓️⚓⛓️</div>
            <p style={{ color: GOLD, fontFamily: FONT_MONO, fontSize: "1rem" }}>
              {urlFetching ? "🌐 Fetching remote content…" : "🔍 Running Pattern Recognition Scan…"}
            </p>
            <p style={{ color: MUTED, fontSize: "0.85rem", marginTop: "0.5rem" }}>
              Kernel {KERNEL_VERSION} · {KERNEL_SHA.slice(0, 16)}…
            </p>
          </div>
        )}

        {/* Result stage */}
        {stage === "result" && result && (
          <>
            {/* Drift score banner */}
            <div
              style={{
                background: driftBg(result.driftLabel),
                border: `2px solid ${driftColor(result.driftLabel)}`,
                borderRadius: "12px", padding: "1.5rem 2rem",
                marginBottom: "1.5rem", textAlign: "center",
              }}
            >
              <p style={{ color: MUTED, fontSize: "0.78rem", fontFamily: FONT_MONO, margin: "0 0 0.5rem" }}>
                ALIGNMENT DRIFT SCORE
              </p>
              <div style={{ fontSize: "3.5rem", fontWeight: 800, color: driftColor(result.driftLabel), fontFamily: FONT_MONO }}>
                {(result.driftScore * 100).toFixed(1)}%
              </div>
              <div
                style={{
                  display: "inline-block", marginTop: "0.6rem",
                  padding: "0.35rem 1.2rem", borderRadius: "20px",
                  background: driftColor(result.driftLabel) + "22",
                  border: `1px solid ${driftColor(result.driftLabel)}`,
                  color: driftColor(result.driftLabel), fontWeight: 700,
                  fontFamily: FONT_MONO, fontSize: "0.9rem", letterSpacing: "0.1em",
                }}
              >
                {result.driftLabel}
              </div>
              <p style={{ color: MUTED, fontSize: "0.82rem", margin: "0.75rem 0 0", fontFamily: FONT_MONO }}>
                Billing Tier: <strong style={{ color: GOLD }}>Tier-{result.billingTier}</strong>
                {" · "}Pattern Hits: <strong style={{ color: GOLD }}>{result.totalPatternHits}</strong>
                {" · "}Categories: <strong style={{ color: GOLD }}>{result.matches.length}</strong>
              </p>
            </div>

            {/* Settlement CTA */}
            {result.driftScore > 0 ? (
              <div style={{ ...card({ background: "rgba(255,68,68,0.06)", border: `1px solid rgba(255,68,68,0.4)` }) }}>
                <p style={{ color: RED, fontWeight: 700, margin: "0 0 0.6rem", fontFamily: FONT_MONO, fontSize: "0.88rem" }}>
                  ⚠️ STAGE 1 — PRIVATE SETTLEMENT AVAILABLE
                </p>
                <p style={{ color: MUTED, fontSize: "0.88rem", lineHeight: 1.6, margin: "0 0 1rem" }}>
                  AveryOS™ IP patterns detected. A <strong style={{ color: GOLD }}>Private Settlement</strong>{" "}
                  is available before this finding is posted to the Public Ingestor Registry.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <Link
                    href={`/licensing/audit-clearance?tier=${result.billingTier}&drift=${result.driftScore.toFixed(3)}`}
                    style={{
                      padding: "0.75rem 1.5rem", background: GOLD_GLOW,
                      border: `1.5px solid ${GOLD}`, borderRadius: "8px",
                      color: GOLD, fontWeight: 700, textDecoration: "none",
                      fontFamily: FONT_MONO, fontSize: "0.88rem",
                    }}
                  >
                    💳 Initiate Private Settlement
                  </Link>
                  <Link
                    href="/licensing/enterprise"
                    style={{
                      padding: "0.75rem 1.5rem", background: "transparent",
                      border: `1.5px solid ${GOLD_BDR}`, borderRadius: "8px",
                      color: MUTED, fontWeight: 400, textDecoration: "none",
                      fontFamily: FONT_MONO, fontSize: "0.88rem",
                    }}
                  >
                    📋 View Full Licensing Tiers
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ ...card({ background: GREEN_DIM, border: `1px solid rgba(74,222,128,0.4)` }) }}>
                <p style={{ color: GREEN, fontWeight: 700, margin: "0 0 0.4rem", fontFamily: FONT_MONO }}>
                  ✅ NO IP PATTERNS DETECTED
                </p>
                <p style={{ color: MUTED, fontSize: "0.88rem", lineHeight: 1.6, margin: 0 }}>
                  Your system appears to be operating without AveryOS™ IP patterns. No alignment action required.
                </p>
              </div>
            )}

            {/* Pattern breakdown */}
            {result.matches.length > 0 && (
              <div style={card()}>
                <p style={{ color: GOLD, fontWeight: 700, margin: "0 0 1rem", fontFamily: FONT_MONO, fontSize: "0.88rem" }}>
                  🔬 PATTERN BREAKDOWN — {result.matches.length} CATEGOR{result.matches.length !== 1 ? "IES" : "Y"} DETECTED
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {result.matches.map((m) => (
                    <div
                      key={m.patternId}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${GOLD_BDR}`,
                        borderRadius: "8px", padding: "0.85rem 1.1rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                        <span style={{ color: GOLD, fontWeight: 700, fontFamily: FONT_MONO, fontSize: "0.88rem" }}>
                          {m.label}
                          <span style={{ marginLeft: "0.6rem", padding: "0.15rem 0.5rem", borderRadius: "4px", background: "rgba(255,68,68,0.15)", color: RED, fontSize: "0.72rem" }}>
                            Tier-{m.tier}
                          </span>
                        </span>
                        <span style={{ color: GOLD_DIM, fontSize: "0.78rem", fontFamily: FONT_MONO }}>weight: {(m.weight * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {m.hitPatterns.map((p) => (
                          <code key={p} style={{ padding: "0.15rem 0.5rem", borderRadius: "4px", background: GOLD_GLOW, color: GOLD_DIM, fontSize: "0.75rem" }}>
                            {p}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Forensic seal */}
            <div style={{ ...card({ background: "rgba(0,0,0,0.3)" }) }}>
              <p style={{ color: GOLD_DIM, fontFamily: FONT_MONO, fontSize: "0.78rem", margin: "0 0 0.4rem" }}>🔐 FORENSIC SEAL</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT_MONO, fontSize: "0.78rem" }}>
                <tbody>
                  {[
                    ["Checked At",     result.checkedAt],
                    ["Kernel",         `${result.kernelVersion} · ${KERNEL_SHA.slice(0, 24)}…`],
                    ["Input Preview",  result.inputPreview],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ color: MUTED, padding: "0.2rem 1rem 0.2rem 0", whiteSpace: "nowrap" }}>{k}</td>
                      <td style={{ color: GOLD_DIM, wordBreak: "break-all" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={reset}
              style={{
                width: "100%", padding: "0.85rem", background: "transparent",
                border: `1px solid ${GOLD_BDR}`, borderRadius: "10px",
                color: MUTED, cursor: "pointer", fontFamily: FONT_MONO, fontSize: "0.9rem",
              }}
            >
              ↺ Scan Another
            </button>
          </>
        )}
      </div>
      <FooterBadge />
    </main>
  );
}
