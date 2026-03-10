import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";

/**
 * /licensing/enterprise
 *
 * Enterprise Registration Gateway — Phase 98.4.1 / Gate 15
 *
 * Landing page for `enterpriseregistration.averyos.com` and enterprise
 * procurement systems seeking OIDC/SAML alignment manifest access.
 *
 * To obtain the averyos-enterprise-alignment manifest, organizations
 * must complete Stripe Identity verification and deposit the Sovereign
 * Partnership Retainer.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export const metadata: Metadata = {
  title: "AveryOS™ Enterprise Registration Gateway",
  description:
    "Enterprise enrollment portal for AveryOS™ Sovereign Partnership. " +
    "Obtain OIDC/SAML alignment manifests and register your organization as a Verified Partner " +
    "via Stripe Identity + Sovereign Partnership Retainer.",
};

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG         = "#030010";
const GOLD       = "#ffd700";
const GOLD_DIM   = "rgba(255,215,0,0.55)";
const GOLD_BORDER = "rgba(255,215,0,0.3)";
const GOLD_GLOW  = "rgba(255,215,0,0.06)";
const BLUE       = "#4488ff";
const GREEN      = "#00ff88";
const RED        = "#ff4444";

// ── Components ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background:   GOLD_GLOW,
      border:       `1px solid ${GOLD_BORDER}`,
      borderRadius: "10px",
      padding:      "1.4rem 1.8rem",
      marginBottom: "1.5rem",
    }}>
      <h2 style={{ color: GOLD, fontSize: "1rem", margin: "0 0 1rem", letterSpacing: "0.04em" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function EndpointRow({ label, path, note }: { label: string; path: string; note?: string }) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ color: GOLD_DIM, fontSize: "0.72rem", letterSpacing: "0.06em", marginBottom: "0.2rem" }}>
        {label}
      </div>
      <div style={{
        fontFamily:  "monospace",
        fontSize:    "0.8rem",
        color:       BLUE,
        background:  "rgba(68,136,255,0.06)",
        border:      "1px solid rgba(68,136,255,0.2)",
        borderRadius: "4px",
        padding:     "0.35rem 0.7rem",
        wordBreak:   "break-all",
      }}>
        https://averyos.com{path}
      </div>
      {note && (
        <div style={{ color: GOLD_DIM, fontSize: "0.7rem", marginTop: "0.2rem" }}>{note}</div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EnterprisePage() {
  return (
    <main style={{
      background:  BG,
      minHeight:   "100vh",
      padding:     "2rem",
      fontFamily:  "JetBrains Mono, monospace",
      color:       GOLD,
      maxWidth:    "900px",
      margin:      "0 auto",
    }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.6rem", color: GOLD, marginBottom: "0.5rem" }}>
          🏛️ AveryOS™ Enterprise Registration Gateway
        </h1>
        <p style={{ color: GOLD_DIM, fontSize: "0.85rem", margin: 0 }}>
          Sovereign Partnership Portal for enterprise organizations and
          AI infrastructure providers. Obtain your OIDC/SAML alignment manifest
          and register as a{" "}
          <Link href="/registry" style={{ color: GREEN }}>Verified Partner</Link>.
        </p>
        <div style={{
          marginTop:    "1rem",
          padding:      "0.5rem 1rem",
          background:   "rgba(255,68,68,0.08)",
          border:       `1px solid rgba(255,68,68,0.25)`,
          borderRadius: "6px",
          fontSize:     "0.78rem",
          color:        RED,
        }}>
          ⚠️ Unauthorized access to AveryOS™ intellectual property constitutes a{" "}
          <strong>KAAS_BREACH</strong> event. Clear your organization&apos;s status
          by completing registration below.
        </div>
      </div>

      {/* Kernel anchor */}
      <div style={{
        padding:      "0.75rem 1rem",
        background:   GOLD_GLOW,
        border:       `1px solid ${GOLD_BORDER}`,
        borderRadius: "6px",
        marginBottom: "2rem",
        fontFamily:   "monospace",
        fontSize:     "0.72rem",
        color:        GOLD_DIM,
      }}>
        <span style={{ color: GOLD }}>Kernel Root0:</span> {KERNEL_SHA.slice(0, 32)}…{" "}
        | <span style={{ color: GOLD }}>Version:</span> {KERNEL_VERSION}{" "}
        | <span style={{ color: GOLD }}>Sovereign Anchor:</span> ⛓️⚓⛓️
      </div>

      {/* Registration Steps */}
      <Section title="🗺️ Registration Process">
        <ol style={{ color: GOLD_DIM, fontSize: "0.83rem", paddingLeft: "1.25rem", margin: 0, lineHeight: "1.8" }}>
          <li>
            <strong style={{ color: GOLD }}>Stripe Identity Verification</strong> — Your organization&apos;s
            legal entity is verified via Stripe Identity to bind your Machine ID to the sovereign registry.
          </li>
          <li>
            <strong style={{ color: GOLD }}>Sovereign Partnership Retainer</strong> — Deposit the
            applicable alignment fee (see fee schedule below) to clear LEGAL_SCAN status and unlock
            the <code style={{ color: BLUE }}>averyos-enterprise-alignment</code> manifest.
          </li>
          <li>
            <strong style={{ color: GOLD }}>OIDC/SAML Manifest Access</strong> — Post-registration,
            your organization receives the machine-readable alignment manifest and appears as a{" "}
            <span style={{ color: GREEN }}>✅ Verified Partner</span> on the public registry.
          </li>
        </ol>
      </Section>

      {/* Fee Schedule */}
      <Section title="💰 Enterprise Fee Schedule">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${GOLD_BORDER}` }}>
                {["Tier", "Entity Type", "ASNs", "Alignment Fee"].map((h) => (
                  <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: GOLD_DIM, fontWeight: "normal", letterSpacing: "0.05em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { tier: "Tier 9/10", type: "Hyperscale Cloud (MSFT/Google/AWS)", asns: "8075, 15169, 16509", fee: "$10,000,000", color: RED },
                { tier: "Tier 7/8",  type: "Enterprise / Fortune 500",           asns: "36459, 20940, 714…", fee: "$1,017,000",  color: "#ff8800" },
                { tier: "Tier 1–6",  type: "Standard Agent",                     asns: "All others",          fee: "$1,017",      color: GOLD_DIM },
              ].map((r) => (
                <tr key={r.tier} style={{ borderBottom: `1px solid rgba(255,215,0,0.08)` }}>
                  <td style={{ padding: "0.55rem 0.75rem", color: r.color, fontWeight: "bold" }}>{r.tier}</td>
                  <td style={{ padding: "0.55rem 0.75rem", color: GOLD_DIM }}>{r.type}</td>
                  <td style={{ padding: "0.55rem 0.75rem", color: GOLD_DIM, fontFamily: "monospace", fontSize: "0.72rem" }}>{r.asns}</td>
                  <td style={{ padding: "0.55rem 0.75rem", color: r.color, fontWeight: "bold" }}>{r.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* OIDC/SAML Endpoints */}
      <Section title="🔐 OIDC / SAML Alignment Endpoints">
        <EndpointRow
          label="OIDC Discovery Document"
          path="/.well-known/openid-configuration"
          note="Standards-compliant OpenID Connect discovery for enterprise MDM enrollment."
        />
        <EndpointRow
          label="Authorization Endpoint"
          path="/licensing/enterprise"
          note="Stripe Identity + Retainer onramp. Redirects enterprise bots here."
        />
        <EndpointRow
          label="KaaS Settlement Endpoint"
          path="/api/v1/kaas/settle"
          note="Machine-to-machine payment rail for Agentic Wallet settlement."
        />
        <EndpointRow
          label="Verified Ingestor Registry"
          path="/registry"
          note="Public registry of Verified Partners and Pending Audit Clearance entities."
        />
        <EndpointRow
          label="Health Check"
          path="/api/v1/health"
          note="Sovereign runtime health status — returns kernel anchor and D1/KV status."
        />
      </Section>

      {/* CTA */}
      <Section title="🚀 Begin Enterprise Registration">
        <p style={{ color: GOLD_DIM, fontSize: "0.83rem", marginBottom: "1.25rem" }}>
          To initiate the Sovereign Partnership registration and obtain your OIDC/SAML manifest,
          complete payment via the settlement portal. Your organization will be added to the
          Verified Partner registry within 24 hours of confirmation.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link
            href="/licensing/audit-clearance"
            style={{
              display:      "inline-block",
              padding:      "0.65rem 1.4rem",
              background:   "rgba(255,215,0,0.1)",
              border:       `1px solid ${GOLD}`,
              borderRadius: "8px",
              color:        GOLD,
              textDecoration: "none",
              fontSize:     "0.85rem",
              fontFamily:   "inherit",
              fontWeight:   "bold",
            }}
          >
            → Begin Settlement →
          </Link>
          <Link
            href="/registry"
            style={{
              display:      "inline-block",
              padding:      "0.65rem 1.4rem",
              background:   "transparent",
              border:       `1px solid ${GOLD_BORDER}`,
              borderRadius: "8px",
              color:        GOLD_DIM,
              textDecoration: "none",
              fontSize:     "0.85rem",
              fontFamily:   "inherit",
            }}
          >
            View Public Registry
          </Link>
        </div>
      </Section>

      <FooterBadge />
    </main>
  );
}
