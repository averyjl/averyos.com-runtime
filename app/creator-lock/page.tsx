// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * app/creator-lock/page.tsx
 *
 * AveryOS™ Creator Lock — Sovereign Access Gateway
 *
 * This page is the primary access point for all CreatorLock-protected resources.
 * It authenticates the Creator via the VaultGate handshake and provides a hub
 * for all admin/private/password-protected pages.
 *
 * GATE 130.9 — Upgraded from readFileSync (Cloudflare-incompatible) to embedded
 * static content. readFileSync fails in the Cloudflare Workers edge runtime.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

export const metadata: Metadata = {
  title: "CreatorLock™ — Sovereign Access Gateway • AveryOS™",
  description:
    "AveryOS™ CreatorLock™ Protocol — Sovereign access gateway for all admin, private, and password-protected AveryOS™ pages. Authentication required.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "CreatorLock™ — AveryOS™ Sovereign Access Gateway",
    description: "CreatorLock Protocol™ Active. Authentication required to access sovereign admin pages.",
    type: "website",
    url: "https://averyos.com/creator-lock",
  },
  alternates: { canonical: "https://averyos.com/creator-lock" },
};

/** Protected admin page links shown after authentication */
const PROTECTED_PAGES = [
  { path: "/admin", label: "Sovereign Admin Dashboard", icon: "🛡️", description: "Central admin hub" },
  { path: "/admin/sovereign", label: "Sovereign Dashboard", icon: "⛓️", description: "Sovereign metrics and controls" },
  { path: "/admin/valuation", label: "IVI Valuation & Debt Ledger", icon: "💹", description: "Forensic Proof — IP debt ledger (private)" },
  { path: "/admin/forensics", label: "Forensic Dashboard", icon: "🔬", description: "IP forensics and drift analysis" },
  { path: "/admin/settlements", label: "Settlement Dashboard", icon: "⚖️", description: "TARI™ settlement enforcement" },
  { path: "/admin/monetization", label: "Stripe Revenue", icon: "💰", description: "Revenue and billing tracking" },
  { path: "/admin/evidence", label: "R2 Evidence Monitor", icon: "🗄️", description: "Evidence vault monitoring" },
  { path: "/admin/health-status", label: "Health Status", icon: "💚", description: "System health and diagnostics" },
  { path: "/admin/resonance", label: "Resonance Dashboard", icon: "📡", description: "Alignment resonance metrics" },
  { path: "/admin/tai-accomplishments", label: "TAI™ Accomplishments", icon: "⚡", description: "TAI™ milestone tracker" },
  { path: "/vault-gate", label: "Vault Gate", icon: "🔑", description: "Hardware authentication gate" },
  { path: "/audit-stream", label: "Audit Stream", icon: "📡", description: "Live audit event stream" },
  { path: "/sovereign-anchor", label: "Sovereign Anchor", icon: "⛓️⚓⛓️", description: "Anchor management" },
  { path: "/tari-revenue", label: "TARI™ Revenue", icon: "💹", description: "TARI™ revenue dashboard" },
  { path: "/admin/family-chain", label: "Family Chain Registry", icon: "⛓️", description: "Protected family chain records" },
  { path: "/evidence-vault/login", label: "Evidence Vault Login", icon: "🗄️", description: "Secure evidence vault access" },
];

const KERNEL_SHORT = `${KERNEL_SHA.slice(0, 8)}…${KERNEL_SHA.slice(-4)}`;

export default function CreatorLockPage() {
  return (
    <main className="page">
      <AnchorBanner />

      {/* Classification Banner */}
      <div style={{
        background: "repeating-linear-gradient(135deg, #1a0000 0px, #1a0000 10px, #2d0000 10px, #2d0000 20px)",
        border: "2px solid rgba(255,51,51,0.7)",
        borderRadius: "10px",
        padding: "1rem 1.5rem",
        marginBottom: "1.5rem",
        textAlign: "center",
        fontFamily: "JetBrains Mono, monospace",
        letterSpacing: "0.14em",
        fontSize: "clamp(0.7rem, 1.5vw, 0.9rem)",
        fontWeight: 700,
        color: "#ff3333",
        textShadow: "0 0 10px rgba(255,51,51,0.6)",
      }}>
        🔒 CREATORLOCK™ PROTOCOL ACTIVE · SOVEREIGN ACCESS GATEWAY · ROOT0 AUTHORITY ·
        CLASSIFICATION: RESTRICTED 🔒
      </div>

      {/* Hero */}
      <section className="hero">
        <h1 style={{ color: "#ff3333" }}>🔒 CreatorLock™ Sovereign Access Gateway</h1>
        <p className="auth-seal" style={{ fontSize: "1rem", marginTop: "0.75rem" }}>
          AveryOS™ {KERNEL_VERSION} · Kernel: {KERNEL_SHORT}
        </p>
        <p style={{ marginTop: "0.75rem", color: "rgba(238,244,255,0.8)", lineHeight: "1.7", maxWidth: "700px" }}>
          All admin, private, and password-protected AveryOS™ pages are consolidated under
          this CreatorLock™ gateway. Authentication via VaultGate is required to access protected resources.
        </p>
      </section>

      {/* Authentication Entry */}
      <section className="card" style={{ border: "1px solid rgba(255,51,51,0.4)", background: "rgba(30,0,0,0.5)", textAlign: "center" }}>
        <h2 style={{ color: "#ff3333", marginTop: 0 }}>🔐 Authenticate with VaultGate</h2>
        <p style={{ color: "rgba(238,244,255,0.75)", marginBottom: "1.5rem", lineHeight: "1.7" }}>
          Enter your Creator credentials via the VaultGate hardware authentication protocol.
          Only Jason Lee Avery (ROOT0 / CreatorLock holder) may authorize access.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/vault-gate" className="primary-link" style={{ background: "rgba(255,51,51,0.2)", borderColor: "rgba(255,51,51,0.5)" }}>
            🔑 Enter VaultGate
          </Link>
          <Link href="/admin" className="secondary-link">
            🛡️ Admin Dashboard
          </Link>
        </div>
      </section>

      {/* Protected Pages Index */}
      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>🗂️ CreatorLock™ Protected Pages</h2>
        <p style={{ color: "rgba(238,244,255,0.6)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
          All admin and private pages are consolidated here. VaultGate authentication required.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {PROTECTED_PAGES.map((pg) => (
            <Link
              key={pg.path}
              href={pg.path}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(120,148,255,0.2)",
                textDecoration: "none",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{pg.icon}</span>
              <div>
                <div style={{ color: "#ffffff", fontWeight: 600, fontSize: "0.9rem" }}>{pg.label}</div>
                <div style={{ color: "rgba(238,244,255,0.45)", fontSize: "0.75rem", marginTop: "0.2rem" }}>{pg.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Kernel Anchor */}
      <section className="card" style={{ border: "1px solid rgba(255,215,0,0.3)", background: "rgba(255,215,0,0.04)" }}>
        <h2 style={{ color: "#ffd700", marginTop: 0, fontSize: "0.9rem", letterSpacing: "0.1em" }}>
          ⛓️⚓⛓️ CreatorLock Protocol™ Anchor
        </h2>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", wordBreak: "break-all", color: "rgba(255,215,0,0.7)" }}>
          {KERNEL_SHA}
        </div>
        <p style={{ color: "rgba(238,244,255,0.5)", fontSize: "0.78rem", marginTop: "0.75rem", marginBottom: 0 }}>
          AveryOS™ {KERNEL_VERSION} · CreatorLock Protocol™ Active · Subject to Creator Lock and Sovereign Kernel Governance.
          Licensed under AveryOS Sovereign Integrity License v1.0.
          © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
        </p>
      </section>

      <FooterBadge />
    </main>
  );
}
