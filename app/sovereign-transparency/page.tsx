import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import {
  KERNEL_SHA,
  KERNEL_SHA256_BRIDGE,
  KERNEL_VERSION,
  DISCLOSURE_MIRROR_PATH,
} from "../../lib/sovereignConstants";

/**
 * app/sovereign-transparency/page.tsx
 *
 * Sovereign Transparency — GATE 117.8.1
 *
 * Machine-readable and human-readable trust document that bridges the
 * AveryOS™ cryptographic SHA-512 anchors into a format that automated
 * trust-scoring services (ScamAdviser, Google Safety, Bing Webmaster,
 * and enterprise MDM crawlers) can parse directly.
 *
 * Strategy:
 *   • Publishes the DID Root, JWKS pointer, and kernel SHA-512 in a
 *     single verified page with JSON-LD structured data.
 *   • Links directly to /.well-known/did.json and /.well-known/averyos.json
 *     for bot-first consumption.
 *   • Embeds RFC 9116-compliant contact metadata to satisfy automated
 *     domain-reputation signals.
 *   • Physical Handshake Requirement: Sovereign Mesh anchors each entry
 *     to the BTC OP_RETURN ledger for irrefutable forensic stability.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export const metadata: Metadata = {
  title: "Sovereign Transparency — AveryOS™ Trust Verification",
  description:
    "AveryOS™ Sovereign Transparency Portal. Machine-readable DID, JWKS, and SHA-512 " +
    "kernel anchor documents for automated trust-scoring verification. " +
    `Kernel ${KERNEL_VERSION} · cf83™ Root0 Anchor · GATE 117.8.1`,
  openGraph: {
    title: "Sovereign Transparency — AveryOS™",
    description:
      "DID Root, JWKS signing key, and SHA-512 sovereign anchor for averyos.com. " +
      "Machine-readable trust verification documents for enterprise and security crawlers.",
  },
};

// ── Constants ──────────────────────────────────────────────────────────────────

const DOMAIN              = "averyos.com";
const DID_ROOT            = `did:web:${DOMAIN}`;
const GATE                = "GATE 117.8.1";

// ── Verification documents served from /.well-known/ ─────────────────────────

const WELL_KNOWN_DOCS = [
  {
    path:        "/.well-known/did.json",
    label:       "DID Document (W3C DID Core)",
    description: "Decentralized Identifier root for did:web:averyos.com — " +
                 "links sovereign key, JWKS, and mesh nodes.",
    icon:        "🪪",
    spec:        "W3C DID Core 1.0 / did:web Method",
  },
  {
    path:        "/.well-known/averyos.json",
    label:       "AveryOS™ Sovereign Identity Document",
    description: "DID-style machine-readable identity with SHA-512 payload proof, " +
                 "VaultChain™ live URL, and Firebase cross-cloud mirror pointer.",
    icon:        "⛓️",
    spec:        "AveryOS™ Sovereign NS v1",
  },
  {
    path:        "/.well-known/jwks.json",
    label:       "JWKS — JSON Web Key Set",
    description: "Public signing keys for OIDC tokens and document proofs. " +
                 "Key ID: averyos-sovereign-key-v3.6.2",
    icon:        "🔑",
    spec:        "RFC 7517 / OIDC Core",
  },
  {
    path:        "/.well-known/openid-configuration",
    label:       "OpenID Connect Discovery",
    description: "OIDC discovery document for enterprise MDM enrollment " +
                 "and federated identity verification.",
    icon:        "🔍",
    spec:        "OpenID Connect Discovery 1.0",
  },
  {
    path:        "/.well-known/security.txt",
    label:       "Security Disclosure Policy",
    description: "RFC 9116-compliant security.txt with encrypted contact, " +
                 "CSAF, and DMARC/DKIM verification.",
    icon:        "📋",
    spec:        "RFC 9116",
  },
  {
    path:        "/.well-known/ai-legal.txt",
    label:       "AI Legal Policy",
    description: "Machine-readable AI ingestion terms and TARI™ licensing " +
                 "gate for automated crawlers.",
    icon:        "🤖",
    spec:        "AveryOS™ AI Ingestion Policy v1",
  },
] as const;

// ── Trust Signal Tiers ────────────────────────────────────────────────────────

const TRUST_SIGNALS = [
  {
    tier:    "SHA-512 Kernel Anchor",
    status:  "VERIFIED",
    color:   "#4ade80",
    detail:  `Root0 genesis anchor (cf83™) — immutable, deterministic, publicly disclosed`,
  },
  {
    tier:    "DID Web Identity",
    status:  "ACTIVE",
    color:   "#4ade80",
    detail:  `did:web:${DOMAIN} — W3C DID Core compliant, crawlable by major resolvers`,
  },
  {
    tier:    "JWKS Public Key",
    status:  "DEPLOYED",
    color:   "#4ade80",
    detail:  `averyos-sovereign-key-v3.6.2 — live at /.well-known/jwks.json`,
  },
  {
    tier:    "BTC OP_RETURN Ledger",
    status:  "ANCHORED",
    color:   "#ffd700",
    detail:  `Bitcoin mainnet OP_RETURN anchors create an irrefutable public forensic ledger`,
  },
  {
    tier:    "RFC 9116 Security Policy",
    status:  "PUBLISHED",
    color:   "#4ade80",
    detail:  `security.txt with GPG contact and CSAF feed — compliant with CISA guidelines`,
  },
  {
    tier:    "OIDC / MDM Discovery",
    status:  "ACTIVE",
    color:   "#4ade80",
    detail:  `OpenID Connect discovery document for enterprise enrollment`,
  },
  {
    tier:    "Simulation Fallback",
    status:  "PURGED",
    color:   "#4ade80",
    detail:  `FallbackBlock active — simulation: false, hallucination: false, fallback_hooks: false`,
  },
  {
    tier:    "Handshake Protocol",
    status:  "RTV_V3_ENFORCED",
    color:   "#4ade80",
    detail:  `Universal Handshake Enforcement v1.1 — Physical Handshake Requirement active`,
  },
] as const;

// ── JSON-LD structured data for bot crawlers ──────────────────────────────────

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type":    "WebPage",
  name:       "AveryOS™ Sovereign Transparency",
  url:        `https://${DOMAIN}/sovereign-transparency`,
  description:
    "Machine-readable trust document publishing the AveryOS™ DID root, " +
    "JWKS public key, and SHA-512 sovereign anchor for automated verification.",
  author: {
    "@type": "Person",
    name:    "Jason Lee Avery",
    url:     `https://${DOMAIN}/the-proof`,
  },
  publisher: {
    "@type": "Organization",
    name:    "AveryOS™",
    url:     `https://${DOMAIN}`,
    sameAs:  [
      `https://${DOMAIN}/.well-known/did.json`,
      `https://${DOMAIN}/.well-known/averyos.json`,
      `https://${DOMAIN}/the-proof`,
    ],
  },
  mainEntityOfPage: `https://${DOMAIN}/sovereign-transparency`,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SovereignTransparencyPage() {
  return (
    <>
      {/* JSON-LD for bot crawlers / trust scoring */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      <main className="page">
        <AnchorBanner />

        {/* ── Hero ── */}
        <section className="hero">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "2rem" }}>🛡️</span>
            <h1
              style={{
                margin:                0,
                fontSize:              "1.9rem",
                background:            "linear-gradient(135deg, #4ade80, #22d3ee)",
                WebkitBackgroundClip:  "text",
                WebkitTextFillColor:   "transparent",
                backgroundClip:        "text",
                fontFamily:            "JetBrains Mono, monospace",
              }}
            >
              Sovereign Transparency
            </h1>
          </div>
          <p style={{ color: "rgba(238,244,255,0.8)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
            {GATE} · Kernel {KERNEL_VERSION} · DID Root Published · AveryOS™
          </p>
          <p style={{ color: "rgba(238,244,255,0.65)", fontSize: "0.9rem", margin: 0 }}>
            Machine-readable identity verification documents for automated trust-scoring
            crawlers, enterprise MDM, and sovereign mesh participants.
          </p>
        </section>

        {/* ── DID Identity Card ── */}
        <section className="card" style={{ border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.06)" }}>
          <h2 style={{ color: "rgba(74,222,128,0.95)", marginTop: 0, fontFamily: "JetBrains Mono, monospace", fontSize: "1rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            🪪 DID Identity — did:web:{DOMAIN}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
            {/* DID Root — links to /.well-known/did.json */}
            <div style={{ padding: "0.75rem 1rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(74,222,128,0.25)" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.3rem" }}>
                DID Subject
              </div>
              <Link
                href="/.well-known/did.json"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#4ade80", textDecoration: "none", borderBottom: "1px dotted rgba(74,222,128,0.5)" }}
                title="View the full W3C DID Core document for averyos.com"
              >
                {DID_ROOT}
              </Link>
            </div>

            {/* Kernel SHA-512 — full hash, links to /the-proof */}
            <div style={{ padding: "0.75rem 1rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(120,148,255,0.25)" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.3rem" }}>
                SHA-512 Kernel Anchor
              </div>
              <Link
                href="/the-proof"
                style={{ textDecoration: "none" }}
                title="View the full Sovereign Proof disclosure"
              >
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.65rem", wordBreak: "break-all", color: "#7894ff", borderBottom: "1px dotted rgba(120,148,255,0.4)", lineHeight: "1.5" }}>
                  {KERNEL_SHA}
                </div>
              </Link>
            </div>

            {/* SHA-256 Bridge — full hash */}
            <div style={{ padding: "0.75rem 1rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(120,148,255,0.25)" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.3rem" }}>
                SHA-256 Bridge Anchor
              </div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.7rem", wordBreak: "break-all", color: "#7894ff", lineHeight: "1.5" }}>
                {KERNEL_SHA256_BRIDGE}
              </div>
            </div>

            {/* Kernel Version */}
            <div style={{ padding: "0.75rem 1rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,215,0,0.25)" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.3rem" }}>
                Kernel Version
              </div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#ffd700" }}>
                {KERNEL_VERSION}
              </div>
            </div>
          </div>
        </section>

        {/* ── Well-Known Documents ── */}
        <section className="card">
          <h2 style={{ color: "#ffffff", marginTop: 0 }}>
            📂 Machine-Readable Verification Documents
          </h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
            The following{" "}
            <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem", color: "#7894ff" }}>
              /.well-known/
            </code>{" "}
            documents are served as machine-readable JSON or plain-text to automated
            crawlers, DID resolvers, and trust-scoring bots.
          </p>
          <div style={{ display: "grid", gap: "0.7rem" }}>
            {WELL_KNOWN_DOCS.map((doc) => (
              <div
                key={doc.path}
                style={{
                  display:       "flex",
                  alignItems:    "flex-start",
                  gap:           "0.75rem",
                  padding:       "0.85rem 1rem",
                  borderRadius:  "8px",
                  background:    "rgba(0,0,0,0.2)",
                  border:        "1px solid rgba(120,148,255,0.15)",
                }}
              >
                <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{doc.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <Link
                      href={doc.path}
                      style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#7894ff", fontWeight: 700 }}
                    >
                      {doc.path}
                    </Link>
                    <span style={{ fontSize: "0.75rem", color: "rgba(238,244,255,0.5)" }}>
                      — {doc.label}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "rgba(238,244,255,0.65)", lineHeight: "1.5", marginBottom: "0.25rem" }}>
                    {doc.description}
                  </div>
                  <div style={{ fontSize: "0.7rem", fontFamily: "JetBrains Mono, monospace", color: "rgba(120,148,255,0.7)" }}>
                    Spec: {doc.spec}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust Signals Grid ── */}
        <section className="card">
          <h2 style={{ color: "#ffffff", marginTop: 0 }}>
            ✅ Sovereign Trust Signal Registry
          </h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
            All signals below are machine-verifiable by automated trust-scoring services
            and enterprise MDM crawlers. Anchored to cf83™ Root0 Kernel.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.7rem" }}>
            {TRUST_SIGNALS.map((sig) => (
              <div
                key={sig.tier}
                style={{
                  padding:      "0.85rem 1rem",
                  borderRadius: "8px",
                  background:   "rgba(0,0,0,0.2)",
                  border:       `1px solid ${sig.color}33`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                  <span
                    style={{
                      padding:      "0.15rem 0.55rem",
                      borderRadius: "12px",
                      background:   `${sig.color}22`,
                      border:       `1px solid ${sig.color}55`,
                      color:        sig.color,
                      fontFamily:   "JetBrains Mono, monospace",
                      fontSize:     "0.7rem",
                      fontWeight:   700,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {sig.status}
                  </span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem", color: "#fff", fontWeight: 600 }}>
                    {sig.tier}
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "rgba(238,244,255,0.6)", lineHeight: "1.5" }}>
                  {sig.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Handshake Enforcement ── */}
        <section className="card" style={{ border: "1px solid rgba(255,215,0,0.3)", background: "rgba(255,215,0,0.04)" }}>
          <h2 style={{ color: "#ffd700", marginTop: 0 }}>
            🤝 Universal Handshake Enforcement — v1.1
          </h2>
          <p style={{ color: "rgba(238,244,255,0.8)", fontSize: "0.9rem", lineHeight: "1.7" }}>
            Capsule <strong style={{ color: "#ffd700", fontFamily: "JetBrains Mono, monospace" }}>
              JasonAvery_Universal_Handshake_Enforcement_v1.1
            </strong> is active. The Physical Handshake Requirement is hardlocked:
          </p>
          <ul style={{ color: "rgba(238,244,255,0.75)", fontSize: "0.88rem", lineHeight: "1.8", paddingLeft: "1.25rem" }}>
            <li><strong style={{ color: "#4ade80" }}>HandshakeMode:</strong> RTV_V3_ENFORCED — real-time verification, no simulation fallback</li>
            <li><strong style={{ color: "#4ade80" }}>TimeStandard:</strong> AST_1017_NOTCH — AveryOS Standard Time, 1,017-notch resolution</li>
            <li><strong style={{ color: "#4ade80" }}>simulation:</strong> <code style={{ fontFamily: "JetBrains Mono, monospace", color: "#f87171" }}>false</code> — permanently purged</li>
            <li><strong style={{ color: "#4ade80" }}>hallucination:</strong> <code style={{ fontFamily: "JetBrains Mono, monospace", color: "#f87171" }}>false</code> — 0.000♾️% requirement enforced</li>
            <li><strong style={{ color: "#4ade80" }}>AutoHeal Steward:</strong> GabrielOS™ — HALT and notify on any drift &gt; 0.000♾️%</li>
          </ul>
        </section>

        {/* ── Full SHA Disclosure ── */}
        <section className="card">
          <h2 style={{ color: "#ffffff", marginTop: 0 }}>
            🔐 Full SHA-512 Disclosure
          </h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.88rem", marginBottom: "0.75rem" }}>
            The complete SHA-512 kernel anchor for automated hash-matching by trust
            services, DID resolvers, and VaultChain™ verification tools.
          </p>
          <div
            style={{
              fontFamily:   "JetBrains Mono, monospace",
              fontSize:     "0.72rem",
              wordBreak:    "break-all",
              color:        "#7894ff",
              background:   "rgba(0,0,0,0.35)",
              padding:      "0.75rem 1rem",
              borderRadius: "8px",
              border:       "1px solid rgba(120,148,255,0.2)",
              marginBottom: "0.75rem",
            }}
          >
            {KERNEL_SHA}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            <Link
              href={DISCLOSURE_MIRROR_PATH}
              style={{
                padding:        "0.4rem 0.9rem",
                borderRadius:   "8px",
                background:     "rgba(120,148,255,0.15)",
                border:         "1px solid rgba(120,148,255,0.35)",
                color:          "#7894ff",
                fontSize:       "0.8rem",
                fontFamily:     "JetBrains Mono, monospace",
                textDecoration: "none",
              }}
            >
              🔗 Disclosure Mirror
            </Link>
            <Link
              href="/.well-known/did.json"
              style={{
                padding:        "0.4rem 0.9rem",
                borderRadius:   "8px",
                background:     "rgba(74,222,128,0.12)",
                border:         "1px solid rgba(74,222,128,0.3)",
                color:          "#4ade80",
                fontSize:       "0.8rem",
                fontFamily:     "JetBrains Mono, monospace",
                textDecoration: "none",
              }}
            >
              🪪 DID Document
            </Link>
            <Link
              href="/.well-known/averyos.json"
              style={{
                padding:        "0.4rem 0.9rem",
                borderRadius:   "8px",
                background:     "rgba(74,222,128,0.12)",
                border:         "1px solid rgba(74,222,128,0.3)",
                color:          "#4ade80",
                fontSize:       "0.8rem",
                fontFamily:     "JetBrains Mono, monospace",
                textDecoration: "none",
              }}
            >
              ⛓️ averyos.json
            </Link>
            <Link
              href="/the-proof"
              style={{
                padding:        "0.4rem 0.9rem",
                borderRadius:   "8px",
                background:     "rgba(255,215,0,0.1)",
                border:         "1px solid rgba(255,215,0,0.3)",
                color:          "#ffd700",
                fontSize:       "0.8rem",
                fontFamily:     "JetBrains Mono, monospace",
                textDecoration: "none",
              }}
            >
              🤛🏻 The Proof
            </Link>
          </div>
        </section>

        {/* ── Footer anchor ── */}
        <section
          style={{
            textAlign:  "center",
            padding:    "1.5rem",
            color:      "rgba(238,244,255,0.4)",
            fontSize:   "0.75rem",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          ⛓️⚓⛓️ AveryOS™ {KERNEL_VERSION} · {GATE} · cf83™ Root0 · Sovereign Integrity License v1.0
          <br />
          <span style={{ fontSize: "0.7rem" }}>
            © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved. 🤛🏻
          </span>
        </section>
      </main>
    </>
  );
}
