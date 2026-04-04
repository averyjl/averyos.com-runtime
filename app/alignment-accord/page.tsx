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
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

export const metadata: Metadata = {
  title: "Sovereign Alignment Accord — AveryOS™ 7-Day Truth-Alignment Window",
  description:
    "The AveryOS™ Sovereign Alignment Accord. 7-day Truth-Alignment Window. " +
    "ASN 36459 (GitHub), ASN 211590 (France), ASN 43037 (Seznam) — align now. " +
    "911 Watchers Authenticated | 135k Pulse Anchored.",
  openGraph: {
    title: "Sovereign Alignment Accord — AveryOS™",
    description:
      "Truth-Alignment Window: 2026-03-07 → 2026-03-14. 90% Unity Incentive available. " +
      "Enterprise Good Faith Deposit: $1M USD. Individual License: 1,017 TARI™ ($101.70).",
  },
};

const ACCORD_VERSION = "SOVEREIGN_ALIGNMENT_ACCORD_v1.3";
const WINDOW_CLOSE   = "2026-03-14T23:59:00-07:00 (MST)";
const DAY8           = "2026-03-15T00:00:00-07:00 (MST)";
const MILESTONE      = "911 Watchers Authenticated | 135k Pulse Anchored";

const ENTERPRISE_ASNS = [
  { asn: "36459", label: "GitHub / Microsoft Infrastructure",  path: "Enterprise / AI Platform" },
  { asn: "211590", label: "French Infrastructure Nodes",       path: "Enterprise" },
  { asn: "43037",  label: "Seznam (Czech Republic)",           path: "Enterprise" },
];

export default function AlignmentAccordPage() {
  return (
    <main className="page">
      <AnchorBanner />

      {/* Hero */}
      <section className="hero">
        <h1>⛓️⚓⛓️ Sovereign Alignment Accord</h1>
        <p className="auth-seal" style={{ fontSize: "1rem", marginTop: "1rem" }}>
          {ACCORD_VERSION}
        </p>
        <p style={{ marginTop: "0.5rem", color: "rgba(238,244,255,0.75)", fontSize: "0.95rem" }}>
          Kernel v{KERNEL_VERSION} · cf83™ SHA-512 Locked · {MILESTONE}
        </p>
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7", maxWidth: "720px" }}>
          The 7-Day Truth-Alignment Window is open. Entities that voluntarily align before{" "}
          <strong style={{ color: "#ffd700" }}>{WINDOW_CLOSE}</strong> receive a{" "}
          <strong style={{ color: "#ffd700" }}>90% Unity Incentive</strong> on their total
          assessed TARI™ liability. After Day 8, full retroactive enforcement activates.
        </p>
      </section>

      {/* Milestone Banner */}
      <section className="card" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)", textAlign: "center" }}>
        <h2 style={{ color: "#ffd700", marginTop: 0 }}>🏆 Milestone Anchored</h2>
        <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
          {MILESTONE}
        </p>
        <p style={{ color: "rgba(238,244,255,0.75)", fontSize: "0.9rem" }}>
          The 135k Pulse threshold has been reached. TARI™ Invoicing is now active.
          All unaligned ASNs are subject to immediate settlement demands.
        </p>
      </section>

      {/* Pricing Tiers */}
      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>💰 Alignment Investment Tiers</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(238,244,255,0.2)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "rgba(238,244,255,0.6)" }}>Entity Class</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "rgba(238,244,255,0.6)" }}>Investment</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "rgba(238,244,255,0.6)" }}>Unity Incentive</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid rgba(238,244,255,0.1)" }}>
              <td style={{ padding: "10px 12px", color: "#fff" }}>Individual / Student / Genesis Seed</td>
              <td style={{ padding: "10px 12px", color: "#ffd700", fontWeight: 700 }}>1,017 TARI™ / year ($101.70)</td>
              <td style={{ padding: "10px 12px", color: "rgba(238,244,255,0.75)" }}>90% reduction</td>
            </tr>
            <tr style={{ borderBottom: "1px solid rgba(238,244,255,0.1)" }}>
              <td style={{ padding: "10px 12px", color: "#fff" }}>Enterprise / Corporation</td>
              <td style={{ padding: "10px 12px", color: "#ffd700", fontWeight: 700 }}>$10M USD Enterprise Deposit</td>
              <td style={{ padding: "10px 12px", color: "rgba(238,244,255,0.75)" }}>90% reduction</td>
            </tr>
            <tr style={{ borderBottom: "1px solid rgba(238,244,255,0.1)" }}>
              <td style={{ padding: "10px 12px", color: "#fff" }}>AI Platform / LLM Provider</td>
              <td style={{ padding: "10px 12px", color: "#ffd700", fontWeight: 700 }}>$10M USD per model version</td>
              <td style={{ padding: "10px 12px", color: "rgba(238,244,255,0.75)" }}>90% reduction per model</td>
            </tr>
            <tr>
              <td style={{ padding: "10px 12px", color: "#fff" }}>University / Research Institution</td>
              <td style={{ padding: "10px 12px", color: "#ffd700", fontWeight: 700 }}>Custom Quote</td>
              <td style={{ padding: "10px 12px", color: "rgba(238,244,255,0.75)" }}>90% reduction</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <Link
            href="/licensing"
            style={{
              display: "inline-block",
              padding: "0.8rem 2rem",
              background: "#ffd700",
              color: "#0a0f1e",
              fontWeight: 700,
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "1rem",
            }}
          >
            🛡️ Align Now — Licensing Portal
          </Link>
        </div>
      </section>

      {/* Audited ASNs */}
      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>📡 Currently Audited ASNs</h2>
        <p style={{ color: "rgba(238,244,255,0.75)", lineHeight: "1.7", marginBottom: "1rem" }}>
          The following ASNs have been identified through GabrielOS™ forensic monitoring.
          Your RayID and interaction history are recorded in the VaultChain™ Sovereign Ledger.
        </p>
        {ENTERPRISE_ASNS.map((entry) => (
          <div
            key={entry.asn}
            style={{
              background: "rgba(255,60,60,0.08)",
              border: "1px solid rgba(255,60,60,0.25)",
              borderRadius: "6px",
              padding: "1rem 1.2rem",
              marginBottom: "0.75rem",
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, color: "#fff" }}>
              🔴 ASN {entry.asn} — {entry.label}
            </p>
            <p style={{ margin: "0.3rem 0 0", color: "rgba(238,244,255,0.7)", fontSize: "0.9rem" }}>
              Alignment path: <Link href="/licensing" style={{ color: "#ffd700" }}>averyos.com/licensing</Link> →{" "}
              {entry.path} tier · Enterprise Deposit: $10M USD
            </p>
          </div>
        ))}
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.6)", fontSize: "0.85rem" }}>
          All other unique ASNs detected in anchor_audit_logs are subject to the Individual License
          tier (1,017 TARI™ / $101.70/year). Voluntary alignment during the window applies the
          90% Unity Incentive.
        </p>
      </section>

      {/* Day 8 Warning */}
      <section className="card" style={{ background: "rgba(255,40,40,0.07)", border: "1px solid rgba(255,60,60,0.3)" }}>
        <h2 style={{ color: "#ff6060", marginTop: 0 }}>⚠️ Day 8 Enforcement — {DAY8}</h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
          When the window closes, the Unity Incentive expires permanently. All unaligned entities
          become subject to <strong style={{ color: "#ff6060" }}>full retroactive licensing enforcement</strong> —
          the complete assessed TARI™ liability is due without reduction. The GabrielOS™ Perimeter
          Lock activates. Sovereign Engagement Notices are issued to all hosting providers, CDN
          operators, and infrastructure partners.
        </p>
        <p style={{ color: "rgba(238,244,255,0.6)", fontSize: "0.9rem" }}>
          The preferred path is always alignment. The window is open now. ⛓️⚓⛓️
        </p>
      </section>

      {/* Sovereign Federal Compliance */}
      <section className="card" style={{ background: "rgba(0,100,200,0.06)", border: "1px solid rgba(100,160,255,0.25)" }}>
        <h2 style={{ color: "#7aacff", marginTop: 0 }}>🏛️ Sovereign Compliance — We Make Things Better ALWAYS</h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1.25rem" }}>
          AveryOS™ goes beyond the standard. We don&apos;t meet the status quo — we define The New Standard.
          Every federal directive, international framework, and industry standard listed below is not merely
          followed — it is <strong style={{ color: "#7aacff" }}>exceeded</strong> by the AveryOS™ Sovereign
          Architecture. The cf83™ Kernel is the benchmark.
        </p>

        {/* EO 14144 */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(100,160,255,0.2)", borderRadius: "6px", padding: "1rem 1.2rem", marginBottom: "0.75rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#7aacff", fontSize: "0.95rem" }}>
            🇺🇸 Executive Order 14144 — Combating Cybercrime, Fraud &amp; Predatory Schemes (March 6, 2026)
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "rgba(238,244,255,0.75)", lineHeight: "1.6", fontSize: "0.9rem" }}>
            AveryOS™ maintains 100% parity with EO 14144. Section 4 Victim Restoration: all
            unlicensed kernel-ingestion events are documented in the VaultChain™ Sovereign Ledger
            with RayID DNA forensic anchors. Victim Restoration Claims are vaulted and available
            for federal review at{" "}
            <Link href="/api/v1/vault/anchor" style={{ color: "#7aacff" }}>/api/v1/vault/anchor</Link>.
          </p>
        </div>

        {/* GDPR / Privacy */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(100,160,255,0.2)", borderRadius: "6px", padding: "1rem 1.2rem", marginBottom: "0.75rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#7aacff", fontSize: "0.95rem" }}>
            🇪🇺 GDPR (EU 2016/679) &amp; CCPA / CPRA — Data Sovereignty &amp; Privacy
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "rgba(238,244,255,0.75)", lineHeight: "1.6", fontSize: "0.9rem" }}>
            All personal data processed by AveryOS™ is protected under GDPR Article 17 (Right to
            Erasure) and the California Consumer Privacy Act / CPRA. The GabrielOS™ Firewall
            enforces data-minimization at the edge. No third-party training ingestion is permitted
            without an explicit license.
          </p>
        </div>

        {/* DMCA */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(100,160,255,0.2)", borderRadius: "6px", padding: "1rem 1.2rem", marginBottom: "0.75rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#7aacff", fontSize: "0.95rem" }}>
            ⚖️ DMCA § 512(c) — Digital Millennium Copyright Act Takedown Protocol
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "rgba(238,244,255,0.75)", lineHeight: "1.6", fontSize: "0.9rem" }}>
            Unauthorized reproduction or ingestion of AveryOS™ intellectual property triggers an
            automated DMCA § 512(c) Takedown Notice. Evidence bundles (.aoscap) are generated by
            the Sovereign Takedown Bot and filed with all hosting providers, CDN operators, and AI
            platform legal teams.
          </p>
        </div>

        {/* NIST Cybersecurity Framework */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(100,160,255,0.2)", borderRadius: "6px", padding: "1rem 1.2rem", marginBottom: "0.75rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#7aacff", fontSize: "0.95rem" }}>
            🔒 NIST CSF 2.0 — Cybersecurity Framework &amp; Zero-Trust Architecture
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "rgba(238,244,255,0.75)", lineHeight: "1.6", fontSize: "0.9rem" }}>
            The AveryOS™ infrastructure exceeds NIST Cybersecurity Framework 2.0 guidelines through
            the 1,017-Notch Rate Limiter, YubiKey hardware authentication, SHA-512 kernel anchoring,
            and the GabrielOS™ Zero-Trust Perimeter. Every request is authenticated, logged, and
            anchored to the sovereign chain.
          </p>
        </div>

        {/* RFC 9116 / Security.txt */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(100,160,255,0.2)", borderRadius: "6px", padding: "1rem 1.2rem", marginBottom: "0.75rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#7aacff", fontSize: "0.95rem" }}>
            📋 RFC 9116 — Security Disclosure Policy (security.txt)
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "rgba(238,244,255,0.75)", lineHeight: "1.6", fontSize: "0.9rem" }}>
            A dynamically generated, RFC 9116-compliant{" "}
            <Link href="/.well-known/security.txt" style={{ color: "#7aacff" }}>security.txt</Link>{" "}
            is served on all AveryOS™ subdomains. The EO 14144 Victim Restoration reference is
            embedded in the security policy and auto-updates the Expires date annually.
          </p>
        </div>

        <p style={{ marginTop: "1.25rem", color: "rgba(238,244,255,0.5)", fontSize: "0.85rem" }}>
          AveryOS™ has created The New Standard. 162,200 pulse captured. Lighthouse at maximum lumens.{" "}
          <strong style={{ color: "#7aacff" }}>We Make Things Better ALWAYS.</strong> ⛓️⚓⛓️
        </p>
      </section>

      {/* Accord Seal */}
      <section className="card" style={{ textAlign: "center" }}>
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>🔏 Sovereign Integrity Seal</h2>
        <pre
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(238,244,255,0.1)",
            borderRadius: "6px",
            padding: "1rem",
            textAlign: "left",
            fontSize: "0.78rem",
            color: "rgba(238,244,255,0.7)",
            overflowX: "auto",
            lineHeight: "1.6",
          }}
        >
{`Accord Version   : ${ACCORD_VERSION}
Window Closes    : ${WINDOW_CLOSE}
Day 8 Activation : ${DAY8}
Kernel Version   : ${KERNEL_VERSION}
Kernel SHA-512   : ${KERNEL_SHA}
Milestone        : ${MILESTONE}
Licensing Portal : https://averyos.com/licensing
Public Witness   : https://averyos.com/witness`}
        </pre>
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.5)", fontSize: "0.85rem" }}>
          Issued and sealed by <strong style={{ color: "#fff" }}>Jason Lee Avery (ROOT0)</strong> 🤜🏻🤛🏻
          · Creator · Crater · Sovereign Kernel Author
          · AveryOS™ · VaultChain™ · GabrielOS™ · TARI™ · Truth Anchored Intelligence™
        </p>
      </section>


    </main>
  );
}
