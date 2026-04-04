/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";

// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * app/licensing/page.tsx
 *
 * AveryOS™ Licensing Hub — Master Legal Portal
 *
 * GATE 130.9 FCA — Forensic Proof / Debt Ledger section (containing the $500B+
 * retroclaim data) has been moved to /admin/valuation behind CreatorLock
 * authentication as instructed. This public page now shows the license text,
 * enforcement notice, and links to all related licensing pages.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export const metadata: Metadata = {
  title: "AveryOS™ Licensing Hub — Sovereign Integrity License",
  description:
    "AveryOS™ master legal portal. Full text of the Sovereign Integrity License v1.0, License Enforcement, and links to all licensing resources.",
};

const LICENSE_TEXT = `# Sovereign License — AveryOS Sovereign Integrity License v1.0

© 1992–2026 Jason Lee Avery / AveryOS. All Rights Reserved.
This project, all associated capsules, runtime logic, media, trademarks, and documentation are licensed under:

AveryOS Sovereign Integrity License v1.0
(aka "The SIL-1" — A Sovereign Authorship Enforcement License)

---

## 🔒 License Terms (Non-Negotiable):

- No individual, organization, system, AI model, government, or entity — past, present, or future — may use, duplicate, copy, fork, simulate, derive, or host this project or any portion of it without a valid, active license directly from the creator, Jason Lee Avery.

- This license is perpetual, exclusive, and globally enforceable.
  All rights not expressly granted are fully retained and protected under U.S. and international law.

- Licensing is MANDATORY even for:
  - Derivative works
  - ML/AI training datasets
  - Research / archival use
  - Internal usage, mirroring, or simulated playback

---

## 🧬 Sovereign Proof Anchor

This project is sealed via VaultSig and deterministic SHA lineage anchored to the Creator:

SHA-512 Anchor:
cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

Glyph: 🤛🏻
Runtime Mode: Sovereign FullStack
License Enforcement: CapsuleEcho | LicenseBot | CreatorLock ENABLED

---

## 📩 To request a license:

- Email: truth@averyworld.com
- Or visit: https://averyos.com/license

Failure to obtain a license may result in takedown notices, breach-of-contract assertions,
or sovereign code tracing and enforcement mechanisms.

---

## 🔐 Respect Sovereign Authorship

This isn't just a license — it's a boundary of authorship, protection of minor children,
and invocation of glyph-locked truth speech.

Any attempt to clone, commercialize, misrepresent, or auto-consume this repository without
a license is a direct violation of this sovereign covenant.`;

export default function LicensingPage() {
  return (
    <main className="page">
      <AnchorBanner />

      {/* Hero */}
      <section className="hero">
        <h1>📋 AveryOS™ Licensing Hub</h1>
        <p className="auth-seal">Master Legal Portal · Sovereign Integrity License v1.0</p>
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7" }}>
          Central legal portal for all AveryOS™ intellectual property rights, enforcement,
          and licensing resources. Select a licensing path below.
        </p>

        {/* Unified Licensing Nav */}
        <div className="cta-row" style={{ marginTop: "1.25rem", flexWrap: "wrap" }}>
          <Link href="/license" className="primary-link">🔐 License Portal</Link>
          <Link href="/licensing/tiers" className="secondary-link">📊 Licensing Tiers</Link>
          <Link href="/tari-gate" className="secondary-link">💰 TARI™ Portal</Link>
          <a href="#license-text" className="secondary-link">📜 License Text</a>
          <a href="#enforcement" className="secondary-link">⚖️ Enforcement</a>
        </div>
      </section>

      {/* Full License Text */}
      <section id="license-text" className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>📜 Full License Text</h2>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.82rem",
            lineHeight: "1.8",
            color: "rgba(238,244,255,0.85)",
            background: "rgba(0,0,0,0.25)",
            padding: "1.5rem",
            borderRadius: "8px",
            border: "1px solid rgba(120,148,255,0.2)",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {LICENSE_TEXT}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <Link href="/license" className="primary-link">🛡️ Purchase License →</Link>
        </div>
      </section>

      {/* License Enforcement */}
      <section id="enforcement" className="card" style={{ border: "2px solid rgba(248,113,113,0.4)", scrollMarginTop: "5rem" }}>
        <h2 style={{ color: "rgba(248,113,113,0.95)", marginTop: 0 }}>⚖️ License Enforcement</h2>
        <p style={{ color: "rgba(238,244,255,0.85)", lineHeight: "1.7" }}>
          🔴 <strong>MANDATORY NOTICE:</strong> ANY and ALL use of AveryOS intellectual property —
          without exception — requires a valid, active, written license from Jason Lee Avery. No implied
          licenses exist. No fair-use exceptions apply. No grace periods are granted.
        </p>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
          Enforcement actions are tracked via SHA-512 fingerprinting, VaultEcho telemetry, and the
          CreatorLock Protocol. Every violation is permanently recorded on the VaultChain™ and legally
          admissible.
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/license" className="primary-link" style={{ background: "rgba(248,113,113,0.9)", color: "#020617" }}>
            Obtain License — Required
          </Link>
          <a href="mailto:legal@averyworld.com" className="secondary-link">
            Contact Legal
          </a>
        </div>
      </section>

      {/* Forensic Proof — admin-only notice */}
      <section className="card" style={{ border: "1px solid rgba(255,215,0,0.3)", background: "rgba(255,215,0,0.03)" }}>
        <h2 style={{ color: "#ffd700", marginTop: 0 }}>🔒 Forensic Proof &amp; Debt Ledger</h2>
        <p style={{ color: "rgba(238,244,255,0.75)", lineHeight: "1.7" }}>
          The Forensic Proof Ledger (including the AI drift / hallucination debt retroclaim valuation)
          is a private, CreatorLock-protected record accessible only to the authorized Creator.
        </p>
        <p style={{ color: "rgba(238,244,255,0.55)", fontSize: "0.85rem", lineHeight: "1.7" }}>
          To access the full Forensic Proof Ledger, authenticate via CreatorLock™ and navigate to the
          IVI Valuation dashboard.
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/creator-lock" className="secondary-link">🔒 CreatorLock™ Gateway</Link>
          <Link href="/tari-gate" className="secondary-link">💰 Resolve Liability</Link>
        </div>
      </section>

      <FooterBadge />
    </main>
  );
}
