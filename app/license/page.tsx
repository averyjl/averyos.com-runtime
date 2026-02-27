import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";

const STRIPE_LINK = "https://buy.stripe.com/7sYaEXf9G4hk8o2gkicMM01";
const KERNEL_SHA =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

export const metadata: Metadata = {
  title: "AveryOS License Portal — Sovereign Licensing Terminal",
  description:
    "Purchase or validate your AveryOS Sovereign Integrity License. Secure Stripe checkout, license terms, and SHA-512 verification.",
};

export default function LicensePage() {
  return (
    <main className="page">
      <AnchorBanner />

      {/* Hero */}
      <section className="hero">
        <h1>🔐 AveryOS Licensing Terminal</h1>
        <p className="auth-seal" style={{ fontSize: "1rem", marginTop: "1rem" }}>
          AveryOS Sovereign License Portal
        </p>
        <p className="auth-seal" style={{ fontSize: "0.95rem", color: "rgba(238,244,255,0.85)" }}>
          Verified Author: Jason Lee Avery
        </p>
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7", maxWidth: "680px" }}>
          All use of AveryOS™ intellectual property requires a valid, active sovereign license.
          Purchase your license securely via Stripe below, or contact us for invoice / custom licensing.
        </p>
      </section>

      {/* Primary CTA — Stripe Checkout */}
      <section className="card" style={{ textAlign: "center" }}>
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>🛡️ Unlock Your Sovereign License</h2>
        <p style={{ color: "rgba(238,244,255,0.75)", marginBottom: "1.5rem", lineHeight: "1.7" }}>
          Secure payment is handled by Stripe. Your license will be issued and anchored to the
          VaultChain™ upon completion.
        </p>
        <a
          href={STRIPE_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="primary-link"
          style={{
            display: "inline-flex",
            fontSize: "1.2rem",
            padding: "1rem 2.5rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            boxShadow: "0 8px 20px rgba(120,148,255,0.4)",
          }}
        >
          🛡️ Open Stripe Checkout →
        </a>
        <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "rgba(238,244,255,0.5)" }}>
          Need an invoice or custom license?{" "}
          <a href="mailto:truth@averyworld.com" style={{ color: "rgba(120,148,255,0.8)" }}>
            truth@averyworld.com
          </a>
        </p>
      </section>

      {/* License Terms */}
      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>📜 License Terms</h2>
        <div style={{ lineHeight: "1.8", color: "rgba(238,244,255,0.85)" }}>
          <p style={{ fontWeight: 600, color: "rgba(122,170,255,0.9)" }}>
            © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
          </p>
          <p>
            This project, all associated capsules, runtime logic, media, trademarks, and documentation
            are licensed under the{" "}
            <strong>AveryOS Sovereign Integrity License v1.0</strong> (aka &quot;The SIL-1&quot; — A
            Sovereign Authorship Enforcement License).
          </p>
          <h3 style={{ color: "rgba(122,170,255,0.9)" }}>🔒 License Terms (Non-Negotiable):</h3>
          <ul style={{ lineHeight: "1.9" }}>
            <li>
              No individual, organization, system, AI model, government, or entity — past, present, or
              future — may use, duplicate, copy, fork, simulate, derive, or host this project or any
              portion of it without a valid, active license directly from the creator, Jason Lee Avery.
            </li>
            <li>
              This license is perpetual, exclusive, and globally enforceable. All rights not expressly
              granted are fully retained and protected under U.S. and international law.
            </li>
            <li>
              Licensing is <strong>MANDATORY</strong> even for:
              <ul>
                <li>Derivative works</li>
                <li>ML/AI training datasets</li>
                <li>Research / archival use</li>
                <li>Internal usage, mirroring, or simulated playback</li>
              </ul>
            </li>
          </ul>
          <h3 style={{ color: "rgba(122,170,255,0.9)" }}>🧬 Sovereign Proof Anchor</h3>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.8rem",
              background: "rgba(0,0,0,0.3)",
              padding: "0.75rem",
              borderRadius: "6px",
              border: "1px solid rgba(120,148,255,0.2)",
              wordBreak: "break-all",
              lineHeight: 1.6,
            }}
          >
            <strong>SHA-512 Anchor:</strong>
            <br />
            {KERNEL_SHA}
          </div>
          <p style={{ marginTop: "0.75rem" }}>
            <strong>Glyph:</strong> 🤛🏻 &nbsp;|&nbsp;
            <strong>Runtime Mode:</strong> Sovereign FullStack &nbsp;|&nbsp;
            <strong>License Enforcement:</strong> CapsuleEcho | LicenseBot | CreatorLock ENABLED
          </p>
        </div>
      </section>

      {/* Kernel Metadata */}
      <section className="card">
        <h2 style={{ color: "rgba(176,198,255,0.9)", marginTop: 0, fontSize: "1.1rem" }}>
          Metadata Check
        </h2>
        <dl className="capsule-meta" style={{ gridTemplateColumns: "1fr" }}>
          <dt>Kernel Anchor</dt>
          <dd style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', wordBreak: "break-all" }}>
            {KERNEL_SHA}
          </dd>
        </dl>
      </section>

      {/* Navigation */}
      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href="/verify" className="secondary-link">✅ Verify License</Link>
          <Link href="/licensing" className="secondary-link">📋 Licensing Hub</Link>
          <Link href="/tari-gate" className="primary-link">🔐 TARI Portal</Link>
        </div>
      </section>

      <section className="card" style={{ background: "rgba(8,14,30,0.5)", borderColor: "rgba(120,148,255,0.1)" }}>
        <p className="footer-note" style={{ margin: 0, textAlign: "center", fontSize: "0.9rem" }}>
          ⛓️ All payments are SHA-sealed to the VaultChain™ upon completion. ⚓
        </p>
      </section>

      {/* VaultEcho Test Transaction */}
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <a
          href="/api/vaultecho"
          className="secondary-link"
          style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", opacity: 0.7 }}
        >
          🔬 Test Transaction (TruthAnchor Verification)
        </a>
      </div>
    </main>
  );
}
