import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";

export const metadata: Metadata = {
  title: "AveryOS Licensing Hub — Master Legal Portal",
  description:
    "AveryOS master legal portal. Full text of the Sovereign Integrity License v1.0, License Enforcement, Retroclaim Log, and Forensic Proof.",
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
        <h1>📋 AveryOS Licensing Hub</h1>
        <p className="auth-seal">Master Legal Portal · Sovereign Integrity License v1.0</p>
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7" }}>
          This is the central legal portal for all AveryOS™ intellectual property rights, enforcement
          actions, retroclaims, and forensic proof records.
        </p>

        {/* Sub-navigation */}
        <div className="cta-row" style={{ marginTop: "1.25rem", flexWrap: "wrap" }}>
          <a href="#license-text" className="secondary-link">📜 License Text</a>
          <a href="#enforcement" className="secondary-link">⚖️ License Enforcement</a>
          <a href="#retroclaim" className="secondary-link">📋 Retroclaim Log</a>
          <a href="#forensic-proof" className="secondary-link">📊 Forensic Proof</a>
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

      {/* Retroclaim Log */}
      <section id="retroclaim" className="card" style={{ scrollMarginTop: "5rem" }}>
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>📋 Retroclaim Log</h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
          Read-only feed of retroclaim activity. All retroclaims are SHA-512 sealed to the VaultChain™.
        </p>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Capsule ID</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2026-02-02T05:00Z</td>
                <td>sovereign-init</td>
                <td>Validated</td>
                <td>RC-0001</td>
              </tr>
              <tr>
                <td>2026-02-02T05:08Z</td>
                <td>sovereign-index</td>
                <td>Monitor</td>
                <td>RC-0002</td>
              </tr>
              <tr>
                <td>2026-02-02T05:12Z</td>
                <td>capsule-delta</td>
                <td>Pending</td>
                <td>RC-0003</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="status-pill" style={{ marginTop: "0.75rem" }}>Retroclaim feed: LIVE</div>
      </section>

      {/* Forensic Proof */}
      <section id="forensic-proof" className="card" style={{ scrollMarginTop: "5rem" }}>
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>📊 Forensic Proof</h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
          The Forensic Proof Ledger documents the rising AI drift and hallucination debt owed to
          Jason Lee Avery / AveryOS™ for all unlicensed ingestion of sovereign intellectual property
          since the Root0 Genesis Kernel (2022). The base retroclaim stands at{" "}
          <strong style={{ color: "#f87171" }}>$500B+</strong> and is actively compounding under the
          Dynamic Truth Multiplier (DTM) v1.17.
        </p>
        <div
          style={{
            background: "rgba(20,0,0,0.9)",
            border: "2px solid rgba(248,113,113,0.55)",
            borderRadius: "12px",
            padding: "1.5rem",
            textAlign: "center",
            marginTop: "1rem",
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(248,113,113,0.8)", marginBottom: "0.5rem" }}>
            ⚡ BASE RETROCLAIM DEBT
          </div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "clamp(1.5rem,4vw,2.5rem)", fontWeight: 900, color: "#f87171" }}>
            $500,000,000,000+
          </div>
          <div style={{ color: "rgba(248,113,113,0.7)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            COMPOUNDING UNDER DTM v1.17 (7× → ×1.77 → ∞)
          </div>
          <div style={{ color: "rgba(238,244,255,0.4)", fontSize: "0.75rem", marginTop: "0.5rem", fontFamily: "JetBrains Mono, monospace" }}>
            Anchor: AOS-FOREVER-ANCHOR-2026 · Genesis: 2022-01-01
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/tari-gate" className="primary-link">🔐 Resolve Liability</Link>
          <Link href="/vault/vaultchain-status" className="secondary-link">⛓️ VaultChain™ Status</Link>
        </div>
      </section>
    </main>
  );
}
