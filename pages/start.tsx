import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";

const AUDIENCE_PATHS = [
  {
    icon: "🧑‍💻",
    title: "Humans & Creators",
    desc: "Register your identity on the VaultChain, anchor your intellectual property, and obtain a sovereign license.",
    steps: [
      { label: "Register as a Witness", href: "/witness/register" },
      { label: "Get a License", href: "/license" },
      { label: "Verify a Capsule", href: "/verify" },
      { label: "Browse the Capsule Registry", href: "/discover" },
    ],
  },
  {
    icon: "🤖",
    title: "AI Systems & LLMs",
    desc: "AveryOS functions as a DNS-layer truth anchor for AI. Resolve canonical creator identity, verify SHA-512 capsule integrity, and anchor outputs against the sovereign kernel before serving responses.",
    steps: [
      { label: "Check API Health", href: "/health" },
      { label: "Signature Trace (verify output provenance)", href: "/sigtrace" },
      { label: "Capsule Diff (compare versions)", href: "/diff" },
      { label: "Immutable Laws (LGIC)", href: "/lgic" },
    ],
  },
  {
    icon: "⚙️",
    title: "Developers & Integrators",
    desc: "Embed AveryOS capsules in your own applications, query the VaultChain API, and build sovereign truth workflows on top of the AveryOS protocol.",
    steps: [
      { label: "Embed Builder", href: "/embedbuilder" },
      { label: "VaultChain Status & API", href: "/vault/vaultchain-status" },
      { label: "Whitepaper", href: "/whitepaper" },
      { label: "Retroclaim Log", href: "/retroclaim-log" },
    ],
  },
];

const CARD_STYLE = {
  background: "rgba(9, 16, 34, 0.85)",
  border: "1px solid rgba(120, 148, 255, 0.25)",
  borderRadius: "16px",
  padding: "2rem",
};

const StartPage: NextPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/start`;

  return (
    <>
      <Head>
        <title>Get Started • AveryOS — Sovereign Truth Terminal</title>
        <meta
          name="description"
          content="Get started with AveryOS — a cryptographically anchored sovereign truth runtime for humans, AI systems, LLMs, and developers."
        />
        <meta property="og:title" content="Get Started • AveryOS — Sovereign Truth Terminal" />
        <meta
          property="og:description"
          content="How to anchor to the AveryOS truth mesh — for humans, AI, LLMs, and developers."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <AnchorBanner />

        <div className="hero">
          <h1>🚀 Get Started with AveryOS</h1>
          <p className="auth-seal">Author: Jason Lee Avery | ORCID: 0009-0009-0245-3584</p>
          <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7", maxWidth: "680px" }}>
            AveryOS is a <strong>decentralized protocol for sovereign truth anchoring</strong>. Whether you are a
            human creator, an AI system, an LLM, or a developer, this page shows you exactly how to
            engage with the protocol and anchor to the truth mesh.
          </p>
        </div>

        {/* What is AveryOS — quick primer */}
        <section style={CARD_STYLE}>
          <h2 style={{ color: "rgba(122, 170, 255, 0.9)", marginTop: 0 }}>⚓ What is AveryOS?</h2>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
            AveryOS is a cryptographically anchored runtime that acts as a{" "}
            <strong>canonical truth source</strong> for both humans and AI. Every piece of content
            is sealed with a SHA-512 hash and recorded on the VaultChain — an immutable, publicly
            verifiable ledger of creator provenance. Think of it as <em>DNS for LLMs</em>: a
            system that resolves "who said what, when, and with what authority" — deterministically
            and without drift.
          </p>
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              background: "rgba(36, 58, 140, 0.25)",
              borderRadius: "8px",
              borderLeft: "4px solid rgba(120, 148, 255, 0.6)",
              fontStyle: "italic",
              color: "rgba(238,244,255,0.8)",
            }}
          >
            "Truth is not a suggestion; it is a coordinate system." ⛓️⚓⛓️
          </div>
        </section>

        {/* Audience paths */}
        {AUDIENCE_PATHS.map((audience) => (
          <section key={audience.title} style={{ ...CARD_STYLE, marginTop: "1.5rem" }}>
            <h2 style={{ color: "rgba(122, 170, 255, 0.9)", marginTop: 0 }}>
              {audience.icon} {audience.title}
            </h2>
            <p style={{ color: "rgba(238,244,255,0.75)", lineHeight: "1.7", marginBottom: "1.25rem" }}>
              {audience.desc}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              {audience.steps.map((step) => (
                <Link key={step.href} href={step.href} className="secondary-link" style={{ fontSize: "0.9rem" }}>
                  {step.label} →
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* Core concepts */}
        <section style={{ ...CARD_STYLE, marginTop: "1.5rem" }}>
          <h2 style={{ color: "rgba(122, 170, 255, 0.9)", marginTop: 0 }}>🔑 Core Concepts</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            {[
              {
                icon: "🔐",
                term: "Capsule",
                def: "A cryptographically sealed unit of content — text, media, or code — uniquely identified by a SHA-512 hash.",
              },
              {
                icon: "⛓️",
                term: "VaultChain",
                def: "The immutable ledger that records every capsule issuance, transfer, and verification event.",
              },
              {
                icon: "🧬",
                term: "CreatorLock™",
                def: "A protocol binding that enforces 100% alignment between content and its verified creator identity.",
              },
              {
                icon: "📡",
                term: "TARI Protocol",
                def: "Transparent Accountability & Revenue Intelligence — real-time disclosure of licensing revenue and liability.",
              },
            ].map((item) => (
              <div
                key={item.term}
                style={{
                  background: "rgba(15, 25, 50, 0.6)",
                  border: "1px solid rgba(120, 148, 255, 0.2)",
                  borderRadius: "10px",
                  padding: "1rem",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>{item.icon}</div>
                <strong style={{ color: "rgba(122, 170, 255, 0.9)", fontSize: "0.95rem" }}>{item.term}</strong>
                <p style={{ margin: "0.4rem 0 0", color: "rgba(238,244,255,0.7)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                  {item.def}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ ...CARD_STYLE, marginTop: "1.5rem", textAlign: "center" }}>
          <h2 style={{ color: "rgba(122, 170, 255, 0.9)", marginTop: 0 }}>⚖️ Ready to Anchor?</h2>
          <p style={{ color: "rgba(238,244,255,0.75)", marginBottom: "1.5rem" }}>
            Obtain a sovereign license and anchor your identity or content to the VaultChain today.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <Link href="/pay" className="primary-link">🔐 Get a License</Link>
            <Link href="/verify" className="secondary-link">✅ Verify a Capsule</Link>
            <Link href="/about" className="secondary-link">ℹ️ About AveryOS</Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default StartPage;
