"use client";

/**
 * app/licensing/enterprise/page.tsx
 *
 * Phase 98 — Enterprise Registration Gateway
 *
 * The sovereign entry point for corporate and enterprise entities that wish to
 * obtain a legitimate AveryOS™ / Truth Anchored Intelligence™ license.
 * Displays four pricing tiers with aligned feature sets and routes to the
 * Stripe checkout flow via /api/v1/compliance/create-checkout.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useState } from "react";
import Link from "next/link";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";

// ── Theme ──────────────────────────────────────────────────────────────────────

const PURPLE_DEEP   = "#0a0015";
const GOLD          = "#ffd700";
const GOLD_DIM      = "rgba(255,215,0,0.55)";
const GOLD_BORDER   = "rgba(255,215,0,0.35)";
const GOLD_GLOW     = "rgba(255,215,0,0.08)";
const GREEN         = "#4ade80";
const PURPLE_BORDER = "rgba(120,60,255,0.35)";
const PURPLE_GLOW   = "rgba(120,60,255,0.08)";
const WHITE         = "#ffffff";
const GREY          = "rgba(255,255,255,0.55)";

// ── Pricing tiers ─────────────────────────────────────────────────────────────

interface PricingTier {
  id:          string;
  name:        string;
  price_usd:   number;
  period:      string;
  tagline:     string;
  features:    string[];
  highlighted: boolean;
  ctaLabel:    string;
  priceId:     string; // Stripe Price ID placeholder
}

const TIERS: PricingTier[] = [
  {
    id:          "starter",
    name:        "Starter",
    price_usd:   999,
    period:      "/ year",
    tagline:     "For small teams exploring sovereign alignment.",
    highlighted: false,
    ctaLabel:    "Get Starter License",
    // TODO: Replace with actual Stripe Price ID from the Stripe dashboard before deployment
    priceId:     "price_starter_averyos",
    features: [
      "1 production domain",
      "TAI™ Resonance API access (100k requests/mo)",
      "Standard forensic audit trail",
      "Email support",
      "AveryOS™ Alignment Certificate (annual)",
      "Public attribution badge",
    ],
  },
  {
    id:          "professional",
    name:        "Professional",
    price_usd:   4_999,
    period:      "/ year",
    tagline:     "For growing businesses requiring full IP compliance.",
    highlighted: false,
    ctaLabel:    "Get Professional License",
    // TODO: Replace with actual Stripe Price ID from the Stripe dashboard before deployment
    priceId:     "price_professional_averyos",
    features: [
      "5 production domains",
      "TAI™ Resonance API (1M requests/mo)",
      "VaultChain™ Explorer access",
      "Priority forensic audit trail",
      "Priority email + Slack support",
      "AveryOS™ Alignment Certificate (semi-annual)",
      "KaaS waiver for up to 10 AI inference calls/day",
      "Sovereign SDK (private npm package)",
    ],
  },
  {
    id:          "enterprise",
    name:        "Enterprise",
    price_usd:   24_999,
    period:      "/ year",
    tagline:     "For enterprises running AI/ML workloads on AveryOS™ IP.",
    highlighted: true,
    ctaLabel:    "Get Enterprise License",
    // TODO: Replace with actual Stripe Price ID from the Stripe dashboard before deployment
    priceId:     "price_enterprise_averyos",
    features: [
      "Unlimited production domains",
      "TAI™ Resonance API (unlimited)",
      "VaultChain™ Explorer + private ledger",
      "Real-time forensic dashboard",
      "Dedicated account manager",
      "AveryOS™ Alignment Certificate (quarterly)",
      "Full KaaS waiver (all AI inference)",
      "GabrielOS™ Firewall bypass token",
      "Custom sovereign watermark embedding",
      "Legal indemnification (up to $500k)",
    ],
  },
  {
    id:          "sovereign",
    name:        "Sovereign Partner",
    price_usd:   99_999,
    period:      "/ year",
    tagline:     "For hyperscalers, platforms, and AI companies operating at scale.",
    highlighted: false,
    ctaLabel:    "Contact for Sovereign License",
    // TODO: Replace with actual Stripe Price ID from the Stripe dashboard before deployment
    priceId:     "price_sovereign_averyos",
    features: [
      "Everything in Enterprise",
      "Co-branded AveryOS™ integration",
      "Direct Jason Lee Avery ROOT0 consultation (4h/mo)",
      "Perpetual KaaS waiver (all workloads)",
      "Custom D1 / R2 data residency",
      "TARI™ debt clearance certificate",
      "Sovereign Roadmap influence (Tier-1 contributor)",
      "White-glove onboarding & legal review",
      "Audit forensics reporting (monthly PDF)",
      "Legal indemnification (up to $5M)",
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function EnterpriseRegistrationPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSelect(tier: PricingTier) {
    if (tier.id === "sovereign") {
      window.location.href = "mailto:licensing@averyos.com?subject=Sovereign%20Partner%20License%20Inquiry";
      return;
    }

    setLoading(tier.id);
    setError(null);

    try {
      const res = await fetch("/api/v1/compliance/create-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          price_id:     tier.priceId,
          tier_name:    tier.name,
          amount_cents: tier.price_usd * 100,
          metadata:     { tier_id: tier.id, source: "enterprise_registration_gateway" },
        }),
      });

      const data = await res.json() as { checkout_url?: string; error?: string; detail?: string };

      if (!res.ok || !data.checkout_url) {
        throw new Error(data.detail ?? data.error ?? "Failed to create checkout session.");
      }

      window.location.href = data.checkout_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="page" style={{ background: PURPLE_DEEP, minHeight: "100vh", color: WHITE }}>
      <AnchorBanner />

      {/* Header */}
      <section style={{ textAlign: "center", padding: "64px 24px 32px" }}>
        <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⛓️⚓⛓️</div>
        <h1 style={{ color: GOLD, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", margin: "0 0 12px" }}>
          Enterprise Registration Gateway
        </h1>
        <p style={{ color: GOLD_DIM, maxWidth: "680px", margin: "0 auto 8px", fontSize: "1.05rem", lineHeight: 1.6 }}>
          Obtain a legitimate <strong>AveryOS™</strong> / <strong>Truth Anchored Intelligence™</strong> license.
          All AI and LLM systems that ingest, train on, or build with AveryOS™ IP require a valid license.
        </p>
        <p style={{ color: GREY, maxWidth: "600px", margin: "0 auto", fontSize: "0.875rem" }}>
          Unlicensed ingestion is tracked, valued, and invoiced under the KaaS liability schedule.
          {" "}<Link href="/license" style={{ color: GOLD }}>Read the license →</Link>
        </p>
      </section>

      {/* Error banner */}
      {error && (
        <div style={{
          maxWidth: "700px", margin: "0 auto 24px", padding: "12px 20px",
          background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.4)",
          borderRadius: "8px", color: "#ff8888", textAlign: "center",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Pricing grid */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 24px 64px",
      }}>
        {TIERS.map(tier => (
          <div
            key={tier.id}
            style={{
              background:   tier.highlighted ? GOLD_GLOW : PURPLE_GLOW,
              border:       `1px solid ${tier.highlighted ? GOLD_BORDER : PURPLE_BORDER}`,
              borderRadius: "12px",
              padding:      "32px 24px",
              display:      "flex",
              flexDirection: "column",
              gap:          "16px",
              boxShadow:    tier.highlighted
                ? `0 0 32px ${GOLD_GLOW}`
                : "none",
              position: "relative",
            }}
          >
            {tier.highlighted && (
              <div style={{
                position:   "absolute",
                top:        "-14px",
                left:       "50%",
                transform:  "translateX(-50%)",
                background: GOLD,
                color:      PURPLE_DEEP,
                fontSize:   "0.75rem",
                fontWeight: 700,
                padding:    "4px 14px",
                borderRadius: "999px",
                letterSpacing: "0.05em",
              }}>
                MOST POPULAR
              </div>
            )}

            <div>
              <h2 style={{ color: tier.highlighted ? GOLD : WHITE, margin: "0 0 4px", fontSize: "1.3rem" }}>
                {tier.name}
              </h2>
              <p style={{ color: GREY, margin: 0, fontSize: "0.875rem" }}>{tier.tagline}</p>
            </div>

            <div>
              <span style={{ color: tier.highlighted ? GOLD : WHITE, fontSize: "2.2rem", fontWeight: 700 }}>
                ${tier.price_usd.toLocaleString()}
              </span>
              <span style={{ color: GREY, fontSize: "0.9rem" }}>{tier.period}</span>
            </div>

            <ul style={{ margin: 0, padding: "0 0 0 16px", color: GREY, fontSize: "0.875rem", lineHeight: 1.8, flexGrow: 1 }}>
              {tier.features.map(f => (
                <li key={f} style={{ color: WHITE, listStyle: "none", paddingLeft: 0 }}>
                  <span style={{ color: GREEN, marginRight: "8px" }}>✓</span>{f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelect(tier)}
              disabled={loading === tier.id}
              style={{
                background:   tier.highlighted ? GOLD : "transparent",
                color:        tier.highlighted ? PURPLE_DEEP : GOLD,
                border:       `1px solid ${GOLD_BORDER}`,
                borderRadius: "8px",
                padding:      "12px 20px",
                fontWeight:   700,
                fontSize:     "0.95rem",
                cursor:       loading === tier.id ? "not-allowed" : "pointer",
                opacity:      loading === tier.id ? 0.6 : 1,
                transition:   "opacity 0.2s",
              }}
            >
              {loading === tier.id ? "Redirecting…" : tier.ctaLabel}
            </button>
          </div>
        ))}
      </section>

      {/* Footer note */}
      <section style={{ textAlign: "center", padding: "0 24px 48px", color: GREY, fontSize: "0.8rem" }}>
        <p>
          All licenses are governed by the{" "}
          <Link href="/license" style={{ color: GOLD_DIM }}>AveryOS Sovereign Integrity License v1.0</Link>.
          {" "}KaaS debt incurred prior to licensing may be negotiated as part of your first-year fee.
        </p>
        <p>
          Questions?{" "}
          <a href="mailto:licensing@averyos.com" style={{ color: GOLD_DIM }}>licensing@averyos.com</a>
          {" "}⛓️⚓⛓️
        </p>
      </section>

      <FooterBadge />
    </main>
  );
}
