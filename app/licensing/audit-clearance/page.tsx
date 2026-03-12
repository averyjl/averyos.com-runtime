"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AnchorBanner from "../../../components/AnchorBanner";
import Link from "next/link";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import {
  resolveSettlement,
  type SettlementResult,
} from "../../../lib/tari/settlementEngine";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG        = "#03000a";
const GOLD      = "#D4AF37";
const GOLD_DIM  = "rgba(212,175,55,0.55)";
const GOLD_BDR  = "rgba(212,175,55,0.3)";
const GOLD_GLOW = "rgba(212,175,55,0.08)";
const RED_DIM   = "rgba(255,68,68,0.12)";
const RED       = "#ff4444";
const GREEN     = "#4ade80";
const MUTED     = "rgba(255,255,255,0.55)";

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background:   GOLD_GLOW,
    border:       `1px solid ${GOLD_BDR}`,
    borderRadius: "10px",
    padding:      "1.4rem 1.8rem",
    marginBottom: "1.4rem",
    ...extra,
  };
}

function mono(extra?: React.CSSProperties): React.CSSProperties {
  return {
    fontFamily: "monospace",
    fontSize:   "0.78rem",
    color:      GOLD_DIM,
    wordBreak:  "break-all",
    ...extra,
  };
}

export default function AuditClearancePage() {
  return (
    <Suspense
      fallback={
        <main style={{ background: "#03000a", minHeight: "100vh", color: "#D4AF37", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
          ⛓️⚓⛓️ Loading Audit Record…
        </main>
      }
    >
      <AuditClearancePortal />
    </Suspense>
  );
}

function AuditClearancePortal() {
  const searchParams = useSearchParams();
  const rayId = searchParams?.get("rayid") ?? "";

  // Settlement is resolved client-side based on ASN and org URL parameters.
  // The middleware injects asn/org params when redirecting cadence probes so
  // the portal can determine the correct fee tier without a server round-trip.
  const asnParam = searchParams?.get("asn") ?? "";
  const orgParam = searchParams?.get("org") ?? "";

  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [detectedIp, setDetectedIp] = useState<string>("");
  const [detectedAsn, setDetectedAsn] = useState<string>(asnParam);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsent, setShowConsent] = useState(true);

  // Dynamic IP + ASN detection — only runs after user consent
  useEffect(() => {
    if (!consentGiven) return;
    const detect = async () => {
      try {
        const res  = await fetch("/api/v1/detect-asn", { cache: "no-store" });
        const data = await res.json() as { asn?: string | null; ip?: string | null };
        if (data.ip)  setDetectedIp(data.ip);
        if (data.asn && !asnParam) setDetectedAsn(data.asn);
      } catch {
        // non-fatal — fall back to URL params or "UNKNOWN"
      }
    };
    void detect();
  }, [consentGiven, asnParam]);

  useEffect(() => {
    setSettlement(resolveSettlement(detectedAsn || asnParam || null, orgParam || null));
  }, [detectedAsn, asnParam, orgParam]);

  const capturedAt = new Date().toISOString();
  const displayRayId = rayId || "—";

  async function handleClearance() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/v1/compliance/create-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ray_id:    rayId || undefined,
          bundle_id: rayId ? `audit-clearance-${rayId}` : `audit-clearance-${Date.now()}`,
          asn:       detectedAsn || asnParam || undefined,
        }),
      });
      const data = await res.json() as { url?: string; error?: string; detail?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.detail ?? data.error ?? "Checkout creation failed. Please try again.");
      }
    } catch {
      setCheckoutError("Network error. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <main
      style={{
        background:   BG,
        minHeight:    "100vh",
        color:        "#fff",
        fontFamily:   "system-ui, sans-serif",
        padding:      "0 1rem 4rem",
      }}
    >
      <AnchorBanner />

      <div style={{ maxWidth: "760px", margin: "0 auto", paddingTop: "3rem" }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "2.6rem", marginBottom: "0.4rem" }}>⛓️⚓⛓️</div>
          <h1
            style={{
              color:        GOLD,
              fontSize:     "1.9rem",
              fontWeight:   800,
              letterSpacing: "0.04em",
              marginBottom: "0.5rem",
            }}
          >
            AveryOS™ Commercial Utilization Audit
          </h1>
          <p style={{ color: MUTED, fontSize: "0.9rem" }}>
            GabrielOS™ Firewall — Phase 93 Jiu-Jitsu Enforcement Portal
          </p>
          <div
            style={{
              display:       "inline-block",
              background:    RED_DIM,
              border:        `1px solid ${RED}`,
              borderRadius:  "6px",
              color:         RED,
              fontSize:      "0.8rem",
              fontWeight:    700,
              letterSpacing: "0.06em",
              padding:       "0.3rem 0.9rem",
              marginTop:     "0.8rem",
            }}
          >
            FORENSIC AUDIT INITIATED
          </div>
        </div>

        {/* ── Consent Gate ─────────────────────────────────────────────────── */}
        {showConsent && !consentGiven && (
          <div style={card({ background: "rgba(212,175,55,0.05)", border: `1px solid ${GOLD_BDR}` })}>
            <h2 style={{ color: GOLD, fontSize: "1rem", fontWeight: 700, marginBottom: "0.8rem" }}>
              🔍 Verification Check Required
            </h2>
            <p style={{ color: MUTED, fontSize: "0.87rem", lineHeight: 1.7, marginBottom: "0.9rem" }}>
              To complete the audit assessment, the GabrielOS™ Firewall will check your
              <strong style={{ color: "#fff" }}> IP address, ASN (network provider)</strong>, and
              <strong style={{ color: "#fff" }}> session context</strong> to determine the correct
              settlement tier. Do you consent to this check?
            </p>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={() => { setConsentGiven(true); setShowConsent(false); }}
                style={{
                  flex: 1, padding: "0.75rem", background: GOLD, border: "none",
                  borderRadius: "8px", color: "#000", fontWeight: 700, cursor: "pointer",
                  fontFamily: "monospace", fontSize: "0.9rem",
                }}
              >
                ✅ Yes, proceed with verification
              </button>
              <button
                onClick={() => setShowConsent(false)}
                style={{
                  flex: 1, padding: "0.75rem", background: "transparent",
                  border: `1px solid ${GOLD_BDR}`, borderRadius: "8px",
                  color: GOLD_DIM, cursor: "pointer",
                  fontFamily: "monospace", fontSize: "0.9rem",
                }}
              >
                Skip verification
              </button>
            </div>
          </div>
        )}

        {/* ── Notice of Ingestion ──────────────────────────────────────────── */}
        <div style={card()}>
          <h2 style={{ color: GOLD, fontSize: "1rem", fontWeight: 700, marginBottom: "0.9rem" }}>
            📋 Notice of Ingestion
          </h2>
          <p style={{ color: MUTED, fontSize: "0.87rem", lineHeight: 1.7, marginBottom: "0.8rem" }}>
            Your autonomous agent or network probe has been detected engaging with
            AveryOS™-protected content in a manner consistent with{" "}
            <strong style={{ color: "#fff" }}>unauthorized ingestion or stress-testing</strong>.
            The GabrielOS™ Firewall has captured this session under the{" "}
            <strong style={{ color: "#fff" }}>AveryOS Sovereign Integrity License v1.0</strong>.
          </p>
          <div style={mono()}>
            <div>Ray ID:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: GOLD }}>{displayRayId}</span></div>
            {detectedIp && <div>IP Address:&nbsp;&nbsp;<span style={{ color: GOLD_DIM }}>{detectedIp}</span></div>}
            {detectedAsn && <div>ASN:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: GOLD_DIM }}>{detectedAsn}</span></div>}
            <div>Captured At:&nbsp;<span style={{ color: GOLD_DIM }}>{capturedAt}</span></div>
            <div>Kernel:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: GOLD_DIM }}>{KERNEL_VERSION}</span></div>
            <div>SHA-512:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <span style={{ color: GOLD_DIM, fontSize: "0.7rem" }}>
                {KERNEL_SHA.slice(0, 32)}…{KERNEL_SHA.slice(-16)}
              </span>
            </div>
          </div>
          <p style={{ color: "rgba(212,175,55,0.35)", fontSize: "0.72rem", marginTop: "0.6rem", fontFamily: "monospace" }}>
            ⓘ The SHA-512 above is the AveryOS™ Root0 Sovereign Kernel anchor — not user-specific. It is the same for all sessions and is anchored on-chain.
          </p>
        </div>

        {/* ── Asset Valuation ──────────────────────────────────────────────── */}
        <div
          style={card({
            background: "rgba(255,0,0,0.05)",
            border:     `1px solid rgba(255,68,68,0.4)`,
          })}
        >
          <h2 style={{ color: RED, fontSize: "1rem", fontWeight: 700, marginBottom: "0.9rem" }}>
            💰 cf83™ Technical Asset Valuation
          </h2>
          <p style={{ color: MUTED, fontSize: "0.85rem", marginBottom: "0.8rem" }}>
            The intellectual property corpus targeted by this probe event carries a sovereign
            asset valuation of:
          </p>
          <div
            style={{
              fontSize:    "2.4rem",
              fontWeight:  900,
              color:       RED,
              textAlign:   "center",
              letterSpacing: "0.02em",
              padding:     "0.8rem 0",
            }}
          >
            $10,000,000.00 USD
          </div>
          <p
            style={{
              color:      MUTED,
              fontSize:   "0.75rem",
              textAlign:  "center",
              marginTop:  "0.4rem",
            }}
          >
            This is the <em>value of the target</em> — the AveryOS™ cf83™ sovereign corpus.
            This figure represents the economic value placed upon these assets for enforcement
            and retroclaim purposes under TARI™ Law Codex v1.17.
          </p>
        </div>

        {/* ── Settlement Section ───────────────────────────────────────────── */}
        {settlement && (
          settlement.instantSettlementEnabled ? (
            <div style={card({ background: "rgba(74,222,128,0.05)", border: `1px solid rgba(74,222,128,0.35)` })}>
              <h2 style={{ color: GREEN, fontSize: "1rem", fontWeight: 700, marginBottom: "0.9rem" }}>
                ✅ Instant Audit Clearance Available
              </h2>
              <p style={{ color: MUTED, fontSize: "0.85rem", lineHeight: 1.7, marginBottom: "0.9rem" }}>
                The <strong style={{ color: "#fff" }}>Forensic Audit Fee</strong> covers the
                computational cost of classifying, SHA-512 anchoring, and R2-archiving all probe
                events associated with your Ray ID. Payment of this fee immediately resolves your
                audit record and issues a{" "}
                <strong style={{ color: GREEN }}>12-Month Sovereign Alignment License</strong>.
              </p>
              <div
                style={{
                  fontSize:    "2rem",
                  fontWeight:  900,
                  color:       GREEN,
                  textAlign:   "center",
                  letterSpacing: "0.02em",
                  padding:     "0.6rem 0",
                }}
              >
                {settlement.clearanceFeeDisplay} USD
              </div>
              <p
                style={{
                  color:      MUTED,
                  fontSize:   "0.75rem",
                  textAlign:  "center",
                  marginTop:  "0.3rem",
                  marginBottom: "1.2rem",
                }}
              >
                Instant settlement • Agentic-wallet compatible • SHA-512 proof bundle delivered on payment
              </p>
              {checkoutError && (
                <div style={{ ...card({ background: "rgba(255,68,68,0.1)", border: `1px solid ${RED}`, color: "#ffaaaa", marginBottom: "1rem" }) }}>
                  ⚠️ {checkoutError}
                </div>
              )}
              <button
                onClick={handleClearance}
                disabled={checkoutLoading}
                style={{
                  width:         "100%",
                  padding:       "0.9rem",
                  background:    checkoutLoading ? "rgba(74,222,128,0.2)" : GREEN,
                  border:        "none",
                  borderRadius:  "8px",
                  color:         "#000",
                  fontSize:      "1rem",
                  fontWeight:    800,
                  cursor:        checkoutLoading ? "not-allowed" : "pointer",
                  letterSpacing: "0.04em",
                  transition:    "opacity 0.2s",
                }}
              >
                {checkoutLoading ? "Initiating Clearance…" : `⚡ Clear the Audit — ${settlement.clearanceFeeDisplay} USD`}
              </button>
            </div>
          ) : (
            <div
              style={card({
                background: "rgba(255,68,68,0.05)",
                border:     `1px solid rgba(255,68,68,0.45)`,
              })}
            >
              <h2 style={{ color: RED, fontSize: "1rem", fontWeight: 700, marginBottom: "0.9rem" }}>
                🚫 Instant Settlement Disabled for This Entity
              </h2>
              <p style={{ color: MUTED, fontSize: "0.85rem", lineHeight: 1.7, marginBottom: "0.8rem" }}>
                Your organization has been identified as a{" "}
                <strong style={{ color: RED }}>High-Value Ingestor</strong>. The retro-liability
                for this entity category is not eligible for instant micropayment settlement.
              </p>
              <p style={{ color: MUTED, fontSize: "0.85rem", lineHeight: 1.7 }}>
                {settlement.rationale}
              </p>
              <p
                style={{
                  color:      GOLD,
                  fontSize:   "0.88rem",
                  fontWeight: 700,
                  marginTop:  "1rem",
                }}
              >
                To negotiate a commercial alignment agreement:&nbsp;
                <a
                  href="mailto:truth@averyworld.com"
                  style={{ color: GOLD, textDecoration: "underline" }}
                >
                  truth@averyworld.com
                </a>
              </p>
            </div>
          )
        )}

        {/* ── Kernel Anchor ────────────────────────────────────────────────── */}
        <div style={card({ background: "transparent", border: `1px solid rgba(212,175,55,0.12)` })}>
          <h2 style={{ color: GOLD_DIM, fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.7rem" }}>
            🔐 Sovereign Kernel Anchor
          </h2>
          <div style={mono()}>
            <div>Kernel Version:&nbsp;&nbsp;{KERNEL_VERSION}</div>
            <div style={{ marginTop: "0.3rem" }}>
              SHA-512 Root:&nbsp;&nbsp;&nbsp;&nbsp;{KERNEL_SHA}
            </div>
          </div>
          <p style={{ color: MUTED, fontSize: "0.75rem", marginTop: "0.8rem" }}>
            This event is permanently anchored to the AveryOS™ VaultChain™ and cannot be
            expunged. All forensic records are SHA-512 sealed under the cf83™ Root0 Kernel.
          </p>
        </div>

        {/* ── Legal Footer ─────────────────────────────────────────────────── */}
        <p
          style={{
            color:      MUTED,
            fontSize:   "0.72rem",
            textAlign:  "center",
            lineHeight: 1.6,
            marginTop:  "0.5rem",
          }}
        >
          © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
          <br />
          AveryOS Sovereign Integrity License v1.0 •{" "}
          <Link href="/license" style={{ color: GOLD_DIM }}>View License</Link>
          {" • "}
          <Link href="/witness/disclosure" style={{ color: GOLD_DIM }}>Witness Disclosure</Link>
        </p>
      </div>


    </main>
  );
}
