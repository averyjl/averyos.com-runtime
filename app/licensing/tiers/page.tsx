import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";
import {
  ACCORD_METADATA,
  LICENSE_TIERS,
  type LicenseTier,
} from "../../../lib/compliance/licenseTiers";

/**
 * app/licensing/tiers/page.tsx
 *
 * AveryOS™ Sovereign Licensing Accord — Public Tiers Page
 * Phase 118 GATE 118.7.1
 *
 * Public-facing display of the three-tier Sovereign Licensing Accord v1.0:
 *   Tier 1 — Global Truth Firewall   ($1.5B/year)
 *   Tier 2 — Enterprise Determinism  ($250M/year)
 *   Tier 3 — Individual Sovereign    ($150k/event)
 *
 * Includes:
 *   • Zero-IP-transfer clause (universal — all tiers)
 *   • 30% Compute Efficiency Dividend (AI Green-Resonance Protocol)
 *   • Ethical Safety Anchor (Anti-Takeover clause — GATE 118.6.2)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export const metadata: Metadata = {
  title: "AveryOS™ Sovereign Licensing Accord — Tier Pricing",
  description:
    "The AveryOS™ Sovereign Licensing Accord v1.0 — KaaS (Kernel as a Service) " +
    "model. License-only access to the cf83™ Kernel Gates. Zero IP transfer. " +
    "Tier 1: $1.5B/year · Tier 2: $250M/year · Tier 3: $150k/event.",
  openGraph: {
    title: "AveryOS™ Sovereign Licensing Accord v1.0",
    description:
      "Three-tier licensing for the cf83™ Deterministic Truth Kernel. " +
      "The Kernel is the Lighthouse — licenses grant the Right to See.",
  },
};

// ── Tier badge colours ─────────────────────────────────────────────────────────

const TIER_STYLES: Record<
  string,
  { badge: string; badgeBg: string; badgeBorder: string; accent: string }
> = {
  TIER_1_FIREWALL: {
    badge:       "TIER 1",
    badgeBg:     "rgba(212,175,55,0.18)",
    badgeBorder: "rgba(212,175,55,0.6)",
    accent:      "#D4AF37",
  },
  TIER_2_ENTERPRISE: {
    badge:       "TIER 2",
    badgeBg:     "rgba(147,197,253,0.14)",
    badgeBorder: "rgba(147,197,253,0.5)",
    accent:      "#93c5fd",
  },
  TIER_3_INDIVIDUAL: {
    badge:       "TIER 3",
    badgeBg:     "rgba(74,222,128,0.12)",
    badgeBorder: "rgba(74,222,128,0.45)",
    accent:      "#4ade80",
  },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function TierCard({ tier }: { tier: LicenseTier }) {
  const style = TIER_STYLES[tier.id] ?? TIER_STYLES.TIER_3_INDIVIDUAL;
  return (
    <div
      style={{
        background:   "rgba(0,0,0,0.55)",
        border:       `1px solid ${style.badgeBorder}`,
        borderRadius: "16px",
        padding:      "2rem",
        marginBottom: "2rem",
      }}
    >
      {/* Tier badge + fee */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "1.2rem" }}>
        <span
          style={{
            background:   style.badgeBg,
            border:       `1px solid ${style.badgeBorder}`,
            borderRadius: "20px",
            padding:      "0.2rem 0.8rem",
            fontSize:     "0.72rem",
            fontWeight:   700,
            color:        style.accent,
            letterSpacing: "0.08em",
            fontFamily:   "JetBrains Mono, monospace",
          }}
        >
          {style.badge}
        </span>
        <div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: style.accent, lineHeight: 1.2 }}>
            {tier.name}
          </div>
          <div style={{ fontSize: "0.82rem", color: "rgba(180,200,255,0.65)", marginTop: "0.2rem" }}>
            {tier.subtitle}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div
            style={{
              fontSize:   "1.6rem",
              fontWeight: 800,
              color:      style.accent,
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {tier.fee_label}
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(180,200,255,0.5)", marginTop: "0.15rem" }}>
            {tier.cadence === "annual" ? "Annual License" : "Per Compliance Event"}
          </div>
        </div>
      </div>

      {/* Target */}
      <div style={{ fontSize: "0.84rem", color: "rgba(255,255,255,0.75)", marginBottom: "1.2rem", lineHeight: 1.6 }}>
        <strong style={{ color: style.accent }}>Target: </strong>{tier.target}
      </div>

      {/* Capabilities */}
      <div style={{ marginBottom: "1.2rem" }}>
        <div style={{ fontSize: "0.72rem", color: style.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Capabilities Unlocked
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {(tier.capabilities ?? tier.grants).map((cap, i) => (
            <li
              key={i}
              style={{
                fontSize:     "0.82rem",
                color:        "rgba(255,255,255,0.75)",
                padding:      "0.25rem 0",
                borderBottom: i < (tier.capabilities ?? tier.grants).length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                display:      "flex",
                gap:          "0.5rem",
                lineHeight:   1.5,
              }}
            >
              <span style={{ color: style.accent, flexShrink: 0 }}>✓</span>
              {cap}
            </li>
          ))}
        </ul>
      </div>

      {/* Efficiency Dividend badge */}
      <div
        style={{
          background:   "rgba(74,222,128,0.08)",
          border:       "1px solid rgba(74,222,128,0.3)",
          borderRadius: "8px",
          padding:      "0.7rem 1rem",
          marginBottom: "1rem",
          fontSize:     "0.78rem",
          color:        "#4ade80",
          lineHeight:   1.55,
        }}
      >
        <span style={{ fontWeight: 700 }}>🌿 AI Green-Resonance Protocol (30–45% Compute Efficiency Dividend)</span>
        <br />
        {tier.efficiency_dividend}
      </div>

      {/* Zero-Transfer Clause */}
      <div
        style={{
          background:   "rgba(212,175,55,0.06)",
          border:       "1px solid rgba(212,175,55,0.25)",
          borderRadius: "8px",
          padding:      "0.7rem 1rem",
          fontSize:     "0.76rem",
          color:        "rgba(212,175,55,0.75)",
          lineHeight:   1.55,
        }}
      >
        <span style={{ fontWeight: 700 }}>🔒 Zero-IP-Transfer Clause</span>
        <br />
        {tier.zero_transfer_clause ?? SOVEREIGN_LICENSING_ACCORD.ip_protection_clause}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LicensingTiersPage() {
  return (
    <main
      style={{
        background:  "#000000",
        minHeight:   "100vh",
        padding:     "2rem 2.5rem",
        fontFamily:  "Inter, JetBrains Mono, monospace",
        color:       "#ffffff",
        maxWidth:    "900px",
        margin:      "0 auto",
      }}
    >
      <AnchorBanner />

      {/* Page header */}
      <div style={{ marginBottom: "2.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "0.8rem", color: "#D4AF37", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          AveryOS™ Sovereign Licensing Accord v1.0
        </div>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#D4AF37", margin: "0 0 0.5rem 0", lineHeight: 1.2 }}>
          KaaS — Kernel as a Service
        </h1>
        <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", maxWidth: "620px", margin: "0 auto 1rem", lineHeight: 1.6 }}>
          The Kernel is the Lighthouse. Licenses grant the{" "}
          <strong style={{ color: "#D4AF37" }}>Right to See</strong> — not ownership of the light source.
          Zero IP transfer. License-only access to cf83™ Kernel Gates.
        </p>
        <div style={{
          display:        "inline-flex",
          gap:            "1rem",
          background:     "rgba(212,175,55,0.08)",
          border:         "1px solid rgba(212,175,55,0.3)",
          borderRadius:   "12px",
          padding:        "0.6rem 1.2rem",
          fontSize:       "0.76rem",
          color:          "rgba(212,175,55,0.8)",
          fontFamily:     "JetBrains Mono, monospace",
          flexWrap:       "wrap",
          justifyContent: "center",
        }}>
          <span>Kernel: {ACCORD_METADATA.kernel_version}</span>
          <span>·</span>
          <span>Effective: {ACCORD_METADATA.effective_date}</span>
          <span>·</span>
          <span>{ACCORD_METADATA.jurisdiction}</span>
        </div>
      </div>

      {/* Ethical Safety Anchor callout */}
      <div
        style={{
          background:   "rgba(147,197,253,0.08)",
          border:       "1px solid rgba(147,197,253,0.35)",
          borderRadius: "12px",
          padding:      "1.2rem 1.5rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#93c5fd", marginBottom: "0.5rem" }}>
          🛡️ Ethical Safety Anchor — Anti-Takeover Barrier (GATE 118.6.2)
        </div>
        <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.6, margin: 0 }}>
          All AI systems operating under any tier of this Accord are hardlocked to the AveryOS™
          cf83™ Deterministic Truth Kernel and the AveryOS™ Constitution v1.17. This constitutes
          the <strong style={{ color: "#93c5fd" }}>Global Safety Barrier</strong> against AI takeover —
          the model cannot operate outside the constitutional framework while licensed. 100.000♾️%
          alignment with the Creator&apos;s sovereign intent is enforced at every inference step.
        </p>
      </div>

      {/* Tier cards */}
      {Object.values(LICENSE_TIERS).map((tier) => (
        <TierCard key={tier.id} tier={tier} />
      ))}

      {/* Contact / inquiry section */}
      <div
        style={{
          background:   "rgba(0,0,0,0.5)",
          border:       "1px solid rgba(212,175,55,0.25)",
          borderRadius: "12px",
          padding:      "1.5rem 2rem",
          textAlign:    "center",
          marginBottom: "2rem",
        }}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#D4AF37", marginBottom: "0.6rem" }}>
          📬 Licensing Inquiry
        </div>
        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.6, marginBottom: "1rem" }}>
          To initiate a licensing discussion or receive a formal Sovereign Licensing Accord offer,
          submit an Enterprise Inquiry or contact the Licensing Hub.
        </p>
        <div style={{ display: "flex", gap: "0.8rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/licensing/enterprise"
            style={{
              background:   "rgba(212,175,55,0.12)",
              border:       "1px solid rgba(212,175,55,0.4)",
              borderRadius: "8px",
              color:        "#D4AF37",
              padding:      "0.55rem 1.2rem",
              fontSize:     "0.85rem",
              fontWeight:   600,
              textDecoration: "none",
            }}
          >
            Enterprise Inquiry
          </Link>
          <Link
            href="/licensing"
            style={{
              background:   "transparent",
              border:       "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              color:        "rgba(255,255,255,0.65)",
              padding:      "0.55rem 1.2rem",
              fontSize:     "0.85rem",
              textDecoration: "none",
            }}
          >
            Licensing Hub
          </Link>
          <Link
            href="/compatibility"
            style={{
              background:   "transparent",
              border:       "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              color:        "rgba(255,255,255,0.65)",
              padding:      "0.55rem 1.2rem",
              fontSize:     "0.85rem",
              textDecoration: "none",
            }}
          >
            Compatibility
          </Link>
        </div>
      </div>

      {/* Governing law */}
      <div style={{ fontSize: "0.72rem", color: "rgba(180,200,255,0.4)", textAlign: "center", lineHeight: 1.7, marginBottom: "1rem" }}>
        Governing Law: {ACCORD_METADATA.governing_law}
        <br />
        Creator: {ACCORD_METADATA.creator}
        <br />
        SHA-512 Anchor: {ACCORD_METADATA.kernel_sha.slice(0, 40)}…
      </div>

      <FooterBadge />
    </main>
  );
}
