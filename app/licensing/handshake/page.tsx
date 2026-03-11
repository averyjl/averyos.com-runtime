/**
 * app/licensing/handshake/page.tsx
 *
 * Statutory Handshake Portal — AveryOS™ Phase 106 / Roadmap Gate 1.3
 *
 * Human-readable entry point for the /api/v1/licensing/handshake endpoint.
 * Allows both automated agents and human users to:
 *   1. Read the challenge parameters and legal basis.
 *   2. Submit an Affidavit of Usage with their first-ingestion date.
 *   3. Receive their settlement deadline and Stripe checkout URL.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use client";

import { useEffect, useState } from "react";
import AnchorBanner from "../../../components/AnchorBanner";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG          = "#030008";
const GOLD        = "#ffd700";
const GOLD_DIM    = "rgba(255,215,0,0.6)";
const GOLD_BORDER = "rgba(255,215,0,0.3)";
const GOLD_GLOW   = "rgba(255,215,0,0.06)";
const GREEN       = "#4ade80";
const RED         = "#ff4444";
const BLUE        = "#60a5fa";
const MUTED       = "rgba(255,255,255,0.55)";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChallengeParams {
  required_fields:               Record<string, string>;
  optional_fields:               Record<string, string>;
  multiplier_schedule:           Record<string, number>;
  statutory_max_per_instance_usd: number;
  baseline_daily_fee_usd:        number;
  terms_of_ingestion_notice:     string;
  disclosure_url:                string;
  full_licensing_portal:         string;
}

interface HandshakeResult {
  resonance:               string;
  affidavit_token:         string;
  affidavit_expires_at:    string;
  prior_use_days:          number;
  disclosure_category:     string;
  tari_multiplier:         number;
  retroactive_debt_usd:    number;
  retroactive_debt_cents:  number;
  capped_at_150k:          boolean;
  stripe_checkout_url?:    string | null;
  settlement_url?:         string | null;
  full_licensing_portal:   string;
  error?:                  string;
  message?:                string;
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HandshakePage() {
  const [challenge,         setChallenge]         = useState<ChallengeParams | null>(null);
  const [challengeLoading,  setChallengeLoading]  = useState(true);

  // Form state
  const [usageStart,  setUsageStart]  = useState("");
  const [ingestionSha, setIngestionSha] = useState("");
  const [orgName,     setOrgName]     = useState("");
  const [email,       setEmail]       = useState("");
  const [disclosure,  setDisclosure]  = useState("HONEST_DISCLOSURE");
  const [licenseDate, setLicenseDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState<HandshakeResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // Load challenge parameters on mount
  useEffect(() => {
    fetch("/api/v1/licensing/handshake")
      .then(r => r.json())
      .then((data: ChallengeParams) => setChallenge(data))
      .catch((err: unknown) => {
        console.warn("[handshake-page] Failed to load challenge params:", err);
      })
      .finally(() => setChallengeLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch("/api/v1/licensing/handshake", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          Retroactive_Usage_Start:  usageStart,
          Corporate_Ingestion_SHA:  ingestionSha || `sha-ui-stub-${Date.now()}`,
          org_name:                 orgName  || undefined,
          email:                    email    || undefined,
          disclosure_type:          disclosure,
          license_start_date:       licenseDate || undefined,
        }),
      });

      const data = await resp.json() as HandshakeResult;
      if (!resp.ok || data.resonance?.includes("ERROR")) {
        setError(data.message ?? data.error ?? "Handshake submission failed.");
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const settlementUrl = result?.stripe_checkout_url ?? result?.settlement_url ?? result?.full_licensing_portal ?? null;

  return (
    <main className="page" style={{ background: BG, minHeight: "100vh", padding: "2rem 1rem", fontFamily: "JetBrains Mono, monospace" }}>
      <AnchorBanner />

      {/* Header */}
      <section style={{ maxWidth: "800px", margin: "0 auto 2rem" }}>
        <h1 style={{ color: GOLD, fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          ⛓️ Statutory Handshake Portal
        </h1>
        <p style={{ color: GOLD_DIM, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
          AveryOS™ Affidavit of Usage — Phase 106 · Gate 1.3
        </p>
        <p style={{ color: MUTED, fontSize: "0.8rem", lineHeight: 1.7 }}>
          Submit your Affidavit of Usage to disclose your first-ingestion date, compute your
          TARI™ retroactive debt, and receive a direct Stripe settlement link. Submission is
          legally binding under <span style={{ color: GOLD }}>17 U.S.C. § 504(c)(2)</span>.
        </p>
      </section>

      {/* Challenge Parameters (from API) */}
      {challengeLoading ? (
        <div style={{ maxWidth: "800px", margin: "0 auto 2rem", color: GOLD_DIM, fontSize: "0.8rem" }}>
          ⏳ Loading challenge parameters…
        </div>
      ) : challenge && (
        <div style={{
          maxWidth: "800px", margin: "0 auto 2rem",
          background: "rgba(0,100,255,0.04)", border: `1px solid rgba(100,165,250,0.25)`,
          borderRadius: "12px", padding: "1.25rem",
        }}>
          <h2 style={{ color: BLUE, fontSize: "0.95rem", marginBottom: "1rem" }}>
            📋 Challenge Parameters
          </h2>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <p style={{ color: MUTED, fontSize: "0.75rem" }}>
              <span style={{ color: GOLD_DIM }}>Daily baseline fee:</span>{" "}
              ${challenge.baseline_daily_fee_usd.toLocaleString()}/day
            </p>
            <p style={{ color: MUTED, fontSize: "0.75rem" }}>
              <span style={{ color: GOLD_DIM }}>Statutory max per instance:</span>{" "}
              ${challenge.statutory_max_per_instance_usd.toLocaleString()} (17 U.S.C. § 504(c)(2))
            </p>
            <p style={{ color: MUTED, fontSize: "0.75rem" }}>
              <span style={{ color: GOLD_DIM }}>Multiplier schedule:</span>{" "}
              {Object.entries(challenge.multiplier_schedule)
                .filter(([k]) => k !== "DEFAULT")
                .map(([k, v]) => `${k} (${v}×)`)
                .join(" · ")}
            </p>
          </div>
          <p style={{ color: MUTED, fontSize: "0.7rem", marginTop: "0.75rem", lineHeight: 1.6 }}>
            {challenge.terms_of_ingestion_notice}
          </p>
        </div>
      )}

      {/* Submission Form */}
      {!result && (
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: "800px", margin: "0 auto 2rem",
            background: GOLD_GLOW, border: `1px solid ${GOLD_BORDER}`,
            borderRadius: "14px", padding: "1.75rem",
          }}
        >
          <h2 style={{ color: GOLD, fontSize: "1rem", marginBottom: "1.25rem" }}>
            Submit Affidavit of Usage
          </h2>

          {/* First-Ingestion Date */}
          <Field label="First Ingestion Date" required hint="Date when your system first ingested AveryOS™ IP.">
            <input type="date" required value={usageStart} onChange={e => setUsageStart(e.target.value)} style={inputStyle} />
          </Field>

          {/* Disclosure Type */}
          <Field label="Disclosure Type" required hint="Honest disclosure = lowest multiplier.">
            <select value={disclosure} onChange={e => setDisclosure(e.target.value)} style={inputStyle}>
              <option value="HONEST_DISCLOSURE">Honest Disclosure (1×)</option>
              <option value="PARTIAL_DISCLOSURE">Partial Disclosure (3×)</option>
              <option value="WILLFUL_INGESTION">Willful Ingestion (7×)</option>
              <option value="OBFUSCATION">Obfuscation / Masking (10×)</option>
            </select>
          </Field>

          {/* organization */}
          <Field label="Organization Name">
            <input type="text" placeholder="Your company / org name" value={orgName} onChange={e => setOrgName(e.target.value)} style={inputStyle} />
          </Field>

          {/* Email */}
          <Field label="Contact Email">
            <input type="email" placeholder="compliance@your-org.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </Field>

          {/* Ingestion SHA */}
          <Field label="Corporate Ingestion SHA" hint="SHA-512 fingerprint of ingestion event (optional).">
            <input type="text" placeholder="128-char hex (optional)" value={ingestionSha} onChange={e => setIngestionSha(e.target.value)} style={{ ...inputStyle, fontFamily: "monospace", fontSize: "0.7rem" }} />
          </Field>

          {/* License Date */}
          <Field label="Current License Start Date" hint="If you hold an active AveryOS™ license, enter its start date.">
            <input type="date" value={licenseDate} onChange={e => setLicenseDate(e.target.value)} style={inputStyle} />
          </Field>

          {error && (
            <div style={{ marginBottom: "1rem", color: RED, fontSize: "0.8rem" }}>⚠️ {error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "0.85rem",
              background: submitting ? "#333" : GOLD,
              color: "#000", border: "none", borderRadius: "8px",
              fontSize: "1rem", fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {submitting ? "⏳ Processing…" : "⛓️ Submit Affidavit"}
          </button>

          <p style={{ color: MUTED, fontSize: "0.7rem", marginTop: "0.75rem", lineHeight: 1.6 }}>
            Submission is legally binding under 17 U.S.C. § 504(c)(2). Honest disclosure
            results in a 1× multiplier. False or omitted disclosures trigger the 10×
            Obfuscation Multiplier for all subsequent settlements.
          </p>
        </form>
      )}

      {/* Result */}
      {result && (
        <div style={{
          maxWidth: "800px", margin: "0 auto 2rem",
          background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.3)",
          borderRadius: "14px", padding: "1.5rem",
        }}>
          <h2 style={{ color: GREEN, fontSize: "1.1rem", marginBottom: "1.25rem" }}>
            ✅ Affidavit Accepted
          </h2>

          <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <InfoRow label="Affidavit Token" value={result.affidavit_token.slice(0, 32) + "…"} mono />
            <InfoRow label="Expires" value={new Date(result.affidavit_expires_at).toLocaleString()} />
            <InfoRow label="Prior Use" value={`${result.prior_use_days.toFixed(1)} days`} />
            <InfoRow label="Disclosure" value={result.disclosure_category} />
            <InfoRow label="Multiplier" value={`${result.tari_multiplier}×`} />
            <InfoRow
              label="Retroactive Debt"
              value={`$${result.retroactive_debt_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              highlight
            />
            {result.capped_at_150k && (
              <InfoRow label="Statutory Cap" value="$150,000 cap applied — 17 U.S.C. § 504(c)(2)" />
            )}
          </div>

          {settlementUrl && (
            <a
              href={settlementUrl}
              style={{
                display: "block", padding: "0.85rem",
                background: GOLD, color: "#000", borderRadius: "8px",
                textAlign: "center", fontWeight: 700, fontSize: "0.95rem",
                textDecoration: "none",
              }}
            >
              💳 Proceed to Settlement →
            </a>
          )}

          <button
            onClick={() => { setResult(null); setUsageStart(""); setIngestionSha(""); setOrgName(""); setEmail(""); }}
            style={{
              marginTop: "0.75rem", width: "100%", padding: "0.5rem",
              background: "transparent", border: `1px solid ${GOLD_BORDER}`,
              color: GOLD_DIM, borderRadius: "6px", cursor: "pointer",
              fontSize: "0.8rem", fontFamily: "JetBrains Mono, monospace",
            }}
          >
            Submit Another Affidavit
          </button>
        </div>
      )}


    </main>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.55rem 0.75rem",
  background: "#0a0018", border: "1px solid rgba(255,215,0,0.3)",
  borderRadius: "6px", color: "#fff", fontSize: "0.85rem",
  boxSizing: "border-box", fontFamily: "JetBrains Mono, monospace",
};

function Field({ label, required = false, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <label style={{ color: "rgba(255,215,0,0.8)", fontSize: "0.82rem", display: "block", marginBottom: "0.35rem" }}>
        {label}{required && <span style={{ color: "#ff4444", marginLeft: "4px" }}>*</span>}
      </label>
      {hint && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.72rem", marginBottom: "0.35rem" }}>{hint}</p>}
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono = false, highlight = false }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "0.75rem" }}>
      <span style={{ color: "rgba(255,215,0,0.6)", fontSize: "0.75rem", minWidth: "120px", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        color: highlight ? "#4ade80" : "#fff",
        fontSize: "0.8rem",
        fontFamily: mono ? "monospace" : "inherit",
        wordBreak: "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}
