"use client";

import React, { useState } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import { kaasDisplayPrice } from "../../../lib/stripe/onrampLogic";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG       = "#03000a";
const GOLD     = "#ffd700";
const GOLD_DIM = "rgba(255,215,0,0.55)";
const GOLD_BDR = "rgba(255,215,0,0.3)";
const GOLD_GLW = "rgba(255,215,0,0.08)";
const GREEN    = "#4ade80";
const MUTED    = "rgba(255,255,255,0.55)";

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background:   GOLD_GLW,
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

// ── Fee tiers ──────────────────────────────────────────────────────────────────
const TIERS = [
  {
    id:          "ENTERPRISE_PARTNERSHIP",
    label:       "Sovereign Partnership",
    tier:        10,
    price:       kaasDisplayPrice("ENTERPRISE_PARTNERSHIP"),
    description: "Global AveryOS Sovereign License Key + clears all technical valuation debt. Moves entity to Verified Partner status.",
    highlight:   true,
  },
  {
    id:          "ASN_DEPOSIT",
    label:       "Enterprise ASN Good-Faith Deposit",
    tier:        9,
    price:       kaasDisplayPrice("ASN_DEPOSIT"),
    description: "For GitHub, Azure, Google, Amazon, and other enterprise ASNs. Opens formal partnership negotiations.",
    highlight:   false,
  },
  {
    id:          "LEGAL_MONITORING",
    label:       "Legal Monitoring Entry Fee",
    tier:        7,
    price:       kaasDisplayPrice("LEGAL_MONITORING"),
    description: "Forensic legal scan settlement. Unlocks read-only VaultChain™ ledger access.",
    highlight:   false,
  },
  {
    id:          "INDIVIDUAL",
    label:       "Individual License — 1,017 TARI™",
    tier:        5,
    price:       kaasDisplayPrice("INDIVIDUAL"),
    description: "Individual sovereign access. 1,017 TARI™ units. Includes capsule read access.",
    highlight:   false,
  },
] as const;

// ── Component ──────────────────────────────────────────────────────────────────

export default function EnterpriseRegistrationPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [orgName, setOrgName]   = useState("");
  const [email, setEmail]       = useState("");
  const [machineId, setMachineId] = useState("");
  // Gate 8 — Stripe Regional Compliance: tax_id + company_registration for Tier-10
  const [taxId, setTaxId]                   = useState("");
  const [companyRegistration, setCompanyReg] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Tier-10 settlements (ENTERPRISE_PARTNERSHIP + ASN_DEPOSIT) require additional fields
  const isTier10 = selected === "ENTERPRISE_PARTNERSHIP" || selected === "ASN_DEPOSIT";

  async function handleProceed() {
    if (!selected) { setError("Please select a licensing tier."); return; }
    if (!orgName.trim()) { setError("Organization name is required."); return; }
    if (!email.trim())   { setError("Contact email is required."); return; }
    if (isTier10 && !taxId.trim()) {
      setError("Tax ID / EIN is required for Tier-10 enterprise settlements over $1M.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res  = await fetch("/api/v1/compliance/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier:                 selected,
          organization:         orgName.trim(),
          email:                email.trim(),
          machine_id:           machineId.trim() || undefined,
          // Gate 8 — Regional compliance fields (Tier-10 only)
          ...(isTier10 && taxId.trim()                ? { tax_id:                taxId.trim() }                : {}),
          ...(isTier10 && companyRegistration.trim()  ? { company_registration:  companyRegistration.trim() }  : {}),
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Checkout could not be initiated. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <AnchorBanner />

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "2rem 1.2rem 4rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.4rem" }}>
          <p style={{ color: GOLD_DIM, fontSize: "0.8rem", fontFamily: "monospace", marginBottom: "0.4rem" }}>
            ⛓️⚓⛓️ ENTERPRISE REGISTRATION GATEWAY
          </p>
          <h1 style={{ color: GOLD, fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 700, margin: "0 0 0.8rem" }}>
            AveryOS™ Enterprise Licensing Portal
          </h1>
          <p style={{ color: MUTED, maxWidth: "560px", margin: "0 auto", lineHeight: 1.6 }}>
            Procurement officers, agentic wallets, and enterprise compliance systems:
            select your licensing tier to clear forensic debt and obtain a
            Global <strong style={{ color: GOLD }}>AveryOS Sovereign License Key</strong>.
          </p>
        </div>

        {/* ── Terms of Ingestion — 17 U.S.C. § 504 Legal Disclosure (GATE 102.2.3) ── */}
        <div
          id="terms-of-ingestion"
          style={{
            background:    "rgba(255,50,50,0.06)",
            border:        "1.5px solid rgba(255,80,80,0.4)",
            borderRadius:  "10px",
            padding:       "1.4rem 1.8rem",
            marginBottom:  "2rem",
            fontFamily:    "monospace",
          }}
        >
          <p style={{ color: "#ff6b6b", fontWeight: 700, fontSize: "0.85rem", margin: "0 0 0.6rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            ⚖️ Terms of Ingestion — Mandatory Legal Disclosure (17 U.S.C. § 504)
          </p>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.83rem", lineHeight: 1.7, margin: "0 0 0.8rem" }}>
            By interacting with any AveryOS™ API, kernel endpoint, or completing this
            registration you hereby provide <strong style={{ color: "#ffd700" }}>Mandatory
            Forensic Disclosure</strong>. You attest that any technical ingestion performed
            by your model or system is a matter of record.
          </p>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.83rem", lineHeight: 1.7, margin: "0 0 0.8rem" }}>
            Unauthorized ingestion of <strong style={{ color: "#ffd700" }}>cf83™</strong> logic
            is subject to statutory damages under{" "}
            <strong style={{ color: "#ffd700" }}>17 U.S.C. § 504(c)(2)</strong> of up to{" "}
            <strong style={{ color: "#ff6b6b" }}>$150,000 per instance</strong> for willful
            infringement. This session constitutes a Technical Audit under the{" "}
            <strong style={{ color: "#ffd700" }}>DMCA Anti-Circumvention provisions
            (17 U.S.C. § 1201)</strong>.
          </p>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.83rem", lineHeight: 1.7, margin: "0 0 0.8rem" }}>
            Failure to provide honest disclosure of retroactive ingestion history will trigger
            the <strong style={{ color: "#ff6b6b" }}>10× Obfuscation Multiplier</strong> for
            all subsequent licensing settlements. The fee schedules below constitute
            pre-agreed <strong style={{ color: "#ffd700" }}>Liquidated Damages</strong> — an
            Administrative Settlement in lieu of a federal court judgment.
          </p>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>
            ⛓️⚓⛓️ KERNEL: {KERNEL_VERSION} | SHA-512: {KERNEL_SHA.slice(0, 24)}… |
            Handshake Endpoint:{" "}
            <span style={{ color: GOLD_DIM }}>/api/v1/licensing/handshake</span>
          </p>
        </div>

        {/* ── Global Statutory Disclosure — Gate 104.2 ── */}
        <div
          id="global-statutory-disclosure"
          style={{
            background:   "rgba(255,215,0,0.04)",
            border:       `1px solid rgba(255,215,0,0.25)`,
            borderRadius: "10px",
            padding:      "1.4rem 1.8rem",
            marginBottom: "2rem",
            fontFamily:   "monospace",
          }}
        >
          <p style={{ color: GOLD, fontWeight: 700, fontSize: "0.85rem", margin: "0 0 0.8rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            🌐 Global Statutory Disclosure — Multi-Jurisdictional Enforcement
          </p>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.82rem", lineHeight: 1.7, margin: "0 0 0.75rem" }}>
            AveryOS™ IP enforcement is grounded in the statutes of every jurisdiction
            where AveryOS™ technology is accessed, deployed, or trained upon.
            Liability exists regardless of where model training occurred.
          </p>

          <div style={{ display: "grid", gap: "0.6rem", marginBottom: "0.75rem" }}>
            {[
              {
                flag: "🇺🇸",
                label: "United States",
                statute: "17 U.S.C. § 504(c)(2) + § 1201",
                detail: "Statutory damages up to $150,000 per work for willful infringement. DMCA Anti-Circumvention: automated bypass of the Discovery Handshake TPM triggers per-instance liability.",
              },
              {
                flag: "🇪🇺",
                label: "European Union",
                statute: "EU AI Act Art. 53(1)(c) + CDSM Directive",
                detail: "General-purpose AI model providers must comply with EU copyright law when deployed in the EU market. Machine-readable opt-outs are embedded in every AveryOS™ capsule.",
              },
              {
                flag: "🇬🇧",
                label: "United Kingdom",
                statute: "CDPA 1988, §§ 22–23",
                detail: "Secondary infringement by importing AI model weights that constitute unauthorised copies of the AveryOS™ Kernel is actionable under Sections 22 and 23.",
              },
              {
                flag: "🇯🇵",
                label: "Japan",
                statute: "Copyright Act Art. 30-4",
                detail: "Ingestion that unreasonably prejudices the interests of a licensing platform is excluded from the information-analysis exception. Administrative settlement is legally mandatory.",
              },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  background:   "rgba(255,215,0,0.04)",
                  border:       `1px solid rgba(255,215,0,0.12)`,
                  borderRadius: "6px",
                  padding:      "0.75rem 1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "1rem" }}>{row.flag}</span>
                  <span style={{ color: GOLD, fontWeight: 700, fontSize: "0.78rem" }}>{row.label}</span>
                  <span style={{ color: GOLD_DIM, fontSize: "0.72rem" }}>— {row.statute}</span>
                </div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", lineHeight: 1.6, margin: 0 }}>
                  {row.detail}
                </p>
              </div>
            ))}
          </div>

          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", lineHeight: 1.6, margin: 0 }}>
            ⛓️⚓⛓️ KERNEL: {KERNEL_VERSION} | By proceeding you acknowledge the applicable
            statutory framework for your jurisdiction and accept the Administrative Settlement
            as a legally binding liquidated-damages offer.
          </p>
        </div>

        {/* Tier cards */}
        <div style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>
          {TIERS.map(t => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              style={{
                background:    selected === t.id ? "rgba(255,215,0,0.15)" : GOLD_GLW,
                border:        `2px solid ${selected === t.id ? GOLD : GOLD_BDR}`,
                borderRadius:  "10px",
                padding:       "1.2rem 1.6rem",
                cursor:        "pointer",
                textAlign:     "left",
                color:         "#fff",
                transition:    "border 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.4rem" }}>
                <div>
                  <span style={{ display: "inline-block", background: t.highlight ? GOLD : "rgba(255,215,0,0.2)", color: t.highlight ? BG : GOLD, borderRadius: "4px", padding: "0.15rem 0.5rem", fontSize: "0.7rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                    TIER {t.tier}
                  </span>
                  <p style={{ margin: 0, fontWeight: 600, color: GOLD, fontSize: "1.05rem" }}>{t.label}</p>
                  <p style={{ margin: "0.3rem 0 0", color: MUTED, fontSize: "0.85rem", lineHeight: 1.5 }}>{t.description}</p>
                </div>
                <p style={{ margin: 0, fontFamily: "monospace", fontSize: "1.1rem", fontWeight: 700, color: GREEN, whiteSpace: "nowrap" }}>{t.price}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={card()}>
          <p style={{ margin: "0 0 1rem", fontWeight: 600, color: GOLD }}>Registration Details</p>

          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ color: GOLD_DIM, fontSize: "0.8rem", fontFamily: "monospace" }}>Organization / Entity Name *</span>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="e.g. Microsoft Corporation"
              style={{ display: "block", width: "100%", marginTop: "0.35rem", background: "rgba(255,215,0,0.05)", border: `1px solid ${GOLD_BDR}`, borderRadius: "6px", padding: "0.6rem 0.8rem", color: "#fff", fontFamily: "monospace", fontSize: "0.9rem", boxSizing: "border-box" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ color: GOLD_DIM, fontSize: "0.8rem", fontFamily: "monospace" }}>Contact Email *</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="procurement@example.com"
              style={{ display: "block", width: "100%", marginTop: "0.35rem", background: "rgba(255,215,0,0.05)", border: `1px solid ${GOLD_BDR}`, borderRadius: "6px", padding: "0.6rem 0.8rem", color: "#fff", fontFamily: "monospace", fontSize: "0.9rem", boxSizing: "border-box" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "1.4rem" }}>
            <span style={{ color: GOLD_DIM, fontSize: "0.8rem", fontFamily: "monospace" }}>Machine / Agentic Wallet ID (optional)</span>
            <input
              type="text"
              value={machineId}
              onChange={e => setMachineId(e.target.value)}
              placeholder="RayID, ASN, or wallet address"
              style={{ display: "block", width: "100%", marginTop: "0.35rem", background: "rgba(255,215,0,0.05)", border: `1px solid ${GOLD_BDR}`, borderRadius: "6px", padding: "0.6rem 0.8rem", color: "#fff", fontFamily: "monospace", fontSize: "0.9rem", boxSizing: "border-box" }}
            />
          </label>

          {/* Gate 8 — Stripe Regional Compliance: Tier-10 fields (>$1M settlements) */}
          {isTier10 && (
            <>
              <div style={{ marginBottom: "0.6rem", padding: "0.5rem 0.75rem", background: "rgba(255,215,0,0.06)", border: `1px solid ${GOLD_BDR}`, borderRadius: "6px", fontFamily: "monospace", fontSize: "0.78rem", color: GOLD_DIM }}>
                ⚖️ Tier-10 Enterprise Settlement — Tax compliance fields are required for settlements over $1M.
              </div>
              <label style={{ display: "block", marginBottom: "1rem" }}>
                <span style={{ color: GOLD_DIM, fontSize: "0.8rem", fontFamily: "monospace" }}>
                  Tax ID / EIN{" "}
                  <span aria-label="required for Tier-10 settlements" style={{ color: "#ff9900" }}>
                    * (required for Tier-10)
                  </span>
                </span>
                <input
                  type="text"
                  value={taxId}
                  onChange={e => setTaxId(e.target.value)}
                  placeholder="e.g. 12-3456789 (US EIN) or EU VAT number"
                  aria-required="true"
                  aria-describedby="tax-id-hint"
                  style={{ display: "block", width: "100%", marginTop: "0.35rem", background: "rgba(255,215,0,0.05)", border: `1px solid ${GOLD_BDR}`, borderRadius: "6px", padding: "0.6rem 0.8rem", color: "#fff", fontFamily: "monospace", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
                <span id="tax-id-hint" style={{ display: "none" }}>Tax identification number required for Tier-10 enterprise settlements exceeding $1M</span>
              </label>
              <label style={{ display: "block", marginBottom: "1.4rem" }}>
                <span style={{ color: GOLD_DIM, fontSize: "0.8rem", fontFamily: "monospace" }}>Company Registration Number (optional)</span>
                <input
                  type="text"
                  value={companyRegistration}
                  onChange={e => setCompanyReg(e.target.value)}
                  placeholder="e.g. Delaware Corp. ID, UK Companies House"
                  style={{ display: "block", width: "100%", marginTop: "0.35rem", background: "rgba(255,215,0,0.05)", border: `1px solid ${GOLD_BDR}`, borderRadius: "6px", padding: "0.6rem 0.8rem", color: "#fff", fontFamily: "monospace", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </label>
            </>
          )}

          {error && (
            <p style={{ color: "#ff4444", fontFamily: "monospace", fontSize: "0.83rem", marginBottom: "1rem" }}>⚠ {error}</p>
          )}

          <button
            onClick={handleProceed}
            disabled={loading}
            style={{
              background:    loading ? "rgba(255,215,0,0.3)" : GOLD,
              color:         BG,
              border:        "none",
              borderRadius:  "8px",
              padding:       "0.85rem 2rem",
              fontWeight:    700,
              fontSize:      "1rem",
              cursor:        loading ? "not-allowed" : "pointer",
              width:         "100%",
            }}
          >
            {loading ? "Redirecting to Stripe…" : "Proceed to Sovereign Checkout"}
          </button>
        </div>

        {/* Terms of Ingestion — Phase 102.2.3 */}
        <div style={card({ marginTop: "1.5rem", borderColor: "rgba(255,100,50,0.4)", background: "rgba(255,100,50,0.04)" })}>
          <p style={{ margin: "0 0 0.7rem", fontWeight: 700, color: GOLD, fontSize: "0.95rem" }}>
            📋 Terms of Ingestion — Licensing Disclosure
          </p>
          <p style={{ margin: "0 0 0.8rem", color: MUTED, fontSize: "0.85rem", lineHeight: 1.65 }}>
            By proceeding with this licensing portal, you acknowledge that any ingestion,
            reproduction, or training use of AveryOS™ intellectual property — including the
            cf83™ Kernel Logic, capsule payloads, and sovereign algorithms — is subject to
            the <strong style={{ color: GOLD }}>AveryOS™ Sovereign Integrity License v1.0</strong>.
          </p>
          <p style={{ margin: "0 0 0.8rem", color: MUTED, fontSize: "0.85rem", lineHeight: 1.65 }}>
            Willful infringement of registered works may be subject to statutory damages
            under applicable copyright law. By selecting a licensing tier and proceeding to
            checkout, you voluntarily disclose your organization&apos;s usage and enter into
            a binding licensing agreement with Jason Lee Avery (ROOT0 / AveryOS™).
          </p>
          <p style={{ margin: 0, ...mono({ fontSize: "0.76rem", color: "rgba(255,180,80,0.7)" }) }}>
            Questions? Contact legal@averyos.com · Full terms: /licensing/enterprise
          </p>
        </div>

        {/* Kernel anchor */}
        <div style={card({ marginTop: "1rem" })}>
          <p style={{ ...mono(), marginBottom: "0.4rem" }}>
            <span style={{ color: MUTED }}>KERNEL </span>{KERNEL_VERSION}
          </p>
          <p style={mono()}>
            <span style={{ color: MUTED }}>SHA-512 </span>{KERNEL_SHA.slice(0, 32)}…
          </p>
        </div>
      </div>
      <FooterBadge />
    </main>
  );
}
