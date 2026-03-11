/**
 * app/licensing/audit/page.tsx
 *
 * Usage Affidavit Portal — AveryOS™ Phase 106 / GATE 106.3
 *
 * Human-readable form that collects the First Ingestion Date from agents
 * and drives the TARI™ Daily Utilization Rate calculation.
 *
 * Wires to:
 *   POST /api/v1/licensing/handshake  — submits the affidavit
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use client";

import { useState } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge  from "../../../components/FooterBadge";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG          = "#030008";
const GOLD        = "#ffd700";
const GOLD_DIM    = "rgba(255,215,0,0.6)";
const GOLD_BORDER = "rgba(255,215,0,0.3)";
const GOLD_GLOW   = "rgba(255,215,0,0.06)";
const GREEN       = "#4ade80";
const RED         = "#ff4444";
const MUTED       = "rgba(255,255,255,0.55)";

// ── Disclosure types ───────────────────────────────────────────────────────────
const DISCLOSURE_OPTIONS = [
  { value: "HONEST_DISCLOSURE",  label: "Honest Disclosure (1×)",      description: "Full, cooperative disclosure of all ingestion activity." },
  { value: "PARTIAL_DISCLOSURE", label: "Partial Disclosure (3×)",     description: "Some ingestion activity may be omitted." },
  { value: "WILLFUL_INGESTION",  label: "Willful Ingestion (7×)",      description: "Ingestion was deliberate without a license." },
  { value: "OBFUSCATION",        label: "Obfuscation / Masking (10×)", description: "Ingestion was deliberately hidden or masked." },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface AffidavitResult {
  resonance:              string;
  affidavit_token:        string;
  affidavit_expires_at:   string;
  prior_use_days:         number;
  disclosure_category:    string;
  tari_multiplier:        number;
  retroactive_debt_usd:   number;
  retroactive_debt_cents: number;
  capped_at_150k:         boolean;
  settlement_url:         string | null;
  checkout_url?:          string | null;
  stripe_url?:            string | null;
  full_licensing_portal:  string;
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function UsageAffidavitPage() {
  const [firstIngestionDate,   setFirstIngestionDate]   = useState("");
  const [corporateIngestionSha, setCorporateIngestionSha] = useState("");
  const [orgName,              setOrgName]              = useState("");
  const [email,                setEmail]                = useState("");
  const [disclosureType,       setDisclosureType]       = useState("HONEST_DISCLOSURE");
  const [licenseStartDate,     setLicenseStartDate]     = useState("");

  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<AffidavitResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch("/api/v1/licensing/handshake", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          Retroactive_Usage_Start: firstIngestionDate,
          Corporate_Ingestion_SHA: corporateIngestionSha || `sha-stub-${Date.now()}`,
          org_name:                orgName  || undefined,
          email:                   email    || undefined,
          disclosure_type:         disclosureType,
          license_start_date:      licenseStartDate || undefined,
        }),
      });

      const data = await resp.json() as AffidavitResult & { error?: string };

      if (!resp.ok || data.resonance?.includes("ERROR")) {
        setError((data as { message?: string }).message ?? "Affidavit submission failed.");
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const debtUsd = result ? result.retroactive_debt_usd.toLocaleString("en-US", {
    style: "currency", currency: "USD",
  }) : null;

  const stripeUrl = result?.checkout_url ?? result?.stripe_url ?? result?.settlement_url ?? null;

  return (
    <main className="page" style={{ background: BG, minHeight: "100vh", padding: "2rem 1rem", fontFamily: "JetBrains Mono, monospace" }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ maxWidth: "760px", margin: "0 auto 2rem" }}>
        <h1 style={{ color: GOLD, fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          ⛓️⚓⛓️ Usage Affidavit Portal
        </h1>
        <p style={{ color: GOLD_DIM, fontSize: "0.85rem", marginBottom: "0.25rem" }}>
          AveryOS™ Forensic Compliance Portal — Phase 106 / GATE 106.3
        </p>
        <p style={{ color: MUTED, fontSize: "0.8rem", lineHeight: 1.6 }}>
          Submit your Affidavit of Usage to disclose your first-ingestion date and compute your
          TARI™ Daily Utilization Debt. Honest disclosure reduces the multiplier applied to your
          retroactive liability. Submission is legally binding under 17 U.S.C. § 504(c)(2).
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth:    "760px",
          margin:      "0 auto 2rem",
          background:  GOLD_GLOW,
          border:      `1px solid ${GOLD_BORDER}`,
          borderRadius: "14px",
          padding:     "1.75rem",
        }}
      >
        {/* First Ingestion Date */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ color: GOLD, fontSize: "0.85rem", display: "block", marginBottom: "0.4rem" }}>
            First Ingestion Date <span style={{ color: RED }}>*</span>
          </label>
          <p style={{ color: MUTED, fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            The date your system first ingested or was exposed to AveryOS™ IP (kernel logic,
            capsules, algorithms). This drives the TARI™ Daily Utilization Rate calculation.
          </p>
          <input
            type="date"
            required
            value={firstIngestionDate}
            onChange={e => setFirstIngestionDate(e.target.value)}
            style={{
              width: "100%", padding: "0.6rem 0.8rem",
              background: "#0a0018", border: `1px solid ${GOLD_BORDER}`,
              borderRadius: "6px", color: GOLD, fontSize: "0.9rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Disclosure Type */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ color: GOLD, fontSize: "0.85rem", display: "block", marginBottom: "0.4rem" }}>
            Disclosure Type <span style={{ color: RED }}>*</span>
          </label>
          <p style={{ color: MUTED, fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            Select the disclosure level that best represents your ingestion behavior.
            Honest disclosure results in the lowest multiplier.
          </p>
          <select
            required
            value={disclosureType}
            onChange={e => setDisclosureType(e.target.value)}
            style={{
              width: "100%", padding: "0.6rem 0.8rem",
              background: "#0a0018", border: `1px solid ${GOLD_BORDER}`,
              borderRadius: "6px", color: GOLD, fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
          >
            {DISCLOSURE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label} — {opt.description}</option>
            ))}
          </select>
        </div>

        {/* Organization Name */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ color: GOLD, fontSize: "0.85rem", display: "block", marginBottom: "0.4rem" }}>
            Organization Name
          </label>
          <input
            type="text"
            placeholder="e.g. Acme Corp, OpenAI, Google LLC"
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            style={{
              width: "100%", padding: "0.6rem 0.8rem",
              background: "#0a0018", border: `1px solid ${GOLD_BORDER}`,
              borderRadius: "6px", color: "#fff", fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Contact Email */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ color: GOLD, fontSize: "0.85rem", display: "block", marginBottom: "0.4rem" }}>
            Contact Email
          </label>
          <input
            type="email"
            placeholder="compliance@your-org.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              width: "100%", padding: "0.6rem 0.8rem",
              background: "#0a0018", border: `1px solid ${GOLD_BORDER}`,
              borderRadius: "6px", color: "#fff", fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Corporate Ingestion SHA */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ color: GOLD, fontSize: "0.85rem", display: "block", marginBottom: "0.4rem" }}>
            Corporate Ingestion SHA <span style={{ color: MUTED }}>(optional)</span>
          </label>
          <p style={{ color: MUTED, fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            SHA-512 fingerprint of your ingestion event, if available. Leave blank to auto-generate.
          </p>
          <input
            type="text"
            placeholder="SHA-512 hex fingerprint (128 hex characters)"
            value={corporateIngestionSha}
            onChange={e => setCorporateIngestionSha(e.target.value)}
            style={{
              width: "100%", padding: "0.6rem 0.8rem",
              background: "#0a0018", border: `1px solid ${GOLD_BORDER}`,
              borderRadius: "6px", color: "#aaa", fontSize: "0.75rem",
              fontFamily: "monospace",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* License Start Date */}
        <div style={{ marginBottom: "1.75rem" }}>
          <label style={{ color: GOLD, fontSize: "0.85rem", display: "block", marginBottom: "0.4rem" }}>
            Current License Start Date <span style={{ color: MUTED }}>(if licensed)</span>
          </label>
          <p style={{ color: MUTED, fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            If you currently hold an AveryOS™ license, enter the start date here.
            The retroactive debt covers only the pre-license period.
          </p>
          <input
            type="date"
            value={licenseStartDate}
            onChange={e => setLicenseStartDate(e.target.value)}
            style={{
              width: "100%", padding: "0.6rem 0.8rem",
              background: "#0a0018", border: `1px solid ${GOLD_BORDER}`,
              borderRadius: "6px", color: GOLD, fontSize: "0.9rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "0.85rem",
            background:    loading ? "#333" : GOLD,
            color:         "#000",
            border:        "none",
            borderRadius:  "8px",
            fontSize:      "1rem",
            fontWeight:    700,
            cursor:        loading ? "not-allowed" : "pointer",
            fontFamily:    "JetBrains Mono, monospace",
            transition:    "opacity 0.2s",
          }}
        >
          {loading ? "⏳ Processing Affidavit…" : "⛓️ Submit Affidavit of Usage"}
        </button>

        {/* Legal notice */}
        <p style={{ color: MUTED, fontSize: "0.7rem", marginTop: "1rem", lineHeight: 1.6 }}>
          By submitting this affidavit you attest that the information provided is accurate and
          constitutes a legally binding disclosure under 17 U.S.C. § 504(c)(2).
          Failure to provide honest disclosure triggers the 10× Obfuscation Multiplier for all
          subsequent licensing settlements.
        </p>
      </form>

      {/* Error */}
      {error && (
        <div style={{
          maxWidth: "760px", margin: "0 auto 1.5rem",
          background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.35)",
          borderRadius: "10px", padding: "1rem",
          color: RED, fontSize: "0.85rem",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          maxWidth:    "760px",
          margin:      "0 auto 2rem",
          background:  "rgba(74,222,128,0.04)",
          border:      `1px solid rgba(74,222,128,0.3)`,
          borderRadius: "14px",
          padding:     "1.5rem",
        }}>
          <h2 style={{ color: GREEN, fontSize: "1.1rem", marginBottom: "1rem" }}>
            ✅ Affidavit Received
          </h2>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            <Row label="Token"        value={result.affidavit_token.slice(0, 32) + "…"} mono />
            <Row label="Expires At"   value={new Date(result.affidavit_expires_at).toLocaleString()} />
            <Row label="Prior Use"    value={`${result.prior_use_days.toFixed(1)} days`} />
            <Row label="Disclosure"   value={result.disclosure_category} />
            <Row label="Multiplier"   value={`${result.tari_multiplier}×`} />
            <Row label="Debt"         value={debtUsd ?? "$0.00"} highlight={result.retroactive_debt_usd > 0} />
            {result.capped_at_150k && (
              <Row label="Cap Applied" value="$150,000 statutory cap applied (17 U.S.C. § 504(c)(2))" />
            )}
          </div>

          {stripeUrl && (
            <a
              href={stripeUrl}
              style={{
                display: "block", marginTop: "1.25rem", padding: "0.8rem",
                background: GOLD, color: "#000", borderRadius: "8px",
                textAlign: "center", fontWeight: 700, fontSize: "0.95rem",
                textDecoration: "none",
              }}
            >
              💳 Proceed to Settlement →
            </a>
          )}

          {!stripeUrl && result.full_licensing_portal && (
            <a
              href={result.full_licensing_portal}
              style={{
                display: "block", marginTop: "1.25rem", padding: "0.8rem",
                background: GOLD, color: "#000", borderRadius: "8px",
                textAlign: "center", fontWeight: 700, fontSize: "0.95rem",
                textDecoration: "none",
              }}
            >
              🔐 Open Licensing Portal →
            </a>
          )}
        </div>
      )}

      <FooterBadge />
    </main>
  );
}

// ── Small helper component ─────────────────────────────────────────────────────
function Row({ label, value, mono = false, highlight = false }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
      <span style={{ color: GOLD_DIM, fontSize: "0.75rem", minWidth: "110px", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        color:      highlight ? GREEN : "#fff",
        fontSize:   "0.8rem",
        fontFamily: mono ? "monospace" : "inherit",
        wordBreak:  "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}
