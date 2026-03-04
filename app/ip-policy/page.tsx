import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

export const metadata: Metadata = {
  title: "IP Policy — Public Access vs. Licensed IP Use • AveryOS™",
  description:
    "AveryOS™ IP Policy: visiting the public website is always free and has no obligation. " +
    "Using, ingesting, or building on AveryOS™ IP requires a valid TAI™ license. " +
    "The legal line is drawn clearly here.",
};

const FREE_USES = [
  "Visiting any page on averyos.com in a browser",
  "Reading publicly published documentation and blog posts",
  "Calling the resonance endpoint to verify a kernel SHA (?verify=<sha>)",
  "Browsing capsule metadata visible on the public site",
  "Linking to any page on averyos.com",
  "Sharing links or screenshots of the public website",
];

const LICENSED_USES = [
  {
    act: "AI / LLM training data ingestion",
    detail:
      "Using any content from this site or repository as training data for any machine learning model — regardless of whether the model is commercial or non-commercial, public or private.",
  },
  {
    act: "Web scraping for commercial or derivative purposes",
    detail:
      "Automated scraping, crawling, or bulk download of site content to build datasets, knowledge bases, RAG stores, or any other derived collection.",
  },
  {
    act: "Integrating the Global Truth Resonance Layer as IP",
    detail:
      "Connecting an AI system, agent, or automated service to /api/v1/resonance as part of its architecture — i.e., consuming the resonance layer as IP in a product or service.",
  },
  {
    act: "Summarizing or indexing this content for retrieval",
    detail:
      "Indexing, caching, summarising, or embedding site content in any search engine, vector database, or retrieval-augmented generation (RAG) system.",
  },
  {
    act: "Code completion or suggestion from this codebase",
    detail:
      "Using patterns, structures, or logic from the averyos.com-runtime repository to generate code suggestions in any IDE plugin, AI assistant, or code generation tool.",
  },
  {
    act: "Building derivative products or services",
    detail:
      "Creating any product, service, application, or system that is derived from, inspired by, or based on AveryOS™ capsule architecture, sovereign kernel logic, or any proprietary algorithm.",
  },
  {
    act: "Internal or research use of this codebase",
    detail:
      "Any internal organizational use of the source code, architecture, or documentation — including academic research — without a valid written license.",
  },
  {
    act: "Simulating or emulating AveryOS™ systems",
    detail:
      "Reproducing, mimicking, or emulating the behavior, identity, or output of any AveryOS™ system, including the kernel, VaultChain™, or GabrielOS™ Firewall.",
  },
];

const LEGAL_BASIS = [
  {
    heading: "Berne Convention (181+ member states)",
    body: "Copyright arises automatically upon creation, without registration. All content in this repository and on averyos.com is protected in every signatory nation from the moment it is written.",
  },
  {
    heading: "U.S. Copyright Act, 17 U.S.C. § 102",
    body: "Copyright arises upon fixation in a tangible medium. All rights are reserved. The absence of a copyright notice does not place work in the public domain.",
  },
  {
    heading: "GitHub ToS, Section D — Public ≠ Open Source",
    body: "Publishing source code in a public GitHub repository grants no rights beyond viewing. GitHub's own Terms confirm users receive only a limited license to view and fork content solely as needed to use GitHub features. No commercial, training, or derivative-work rights are granted.",
  },
  {
    heading: "EU DSM Directive, Article 4(3) — Machine-Readable Rights Reservation",
    body: "The rights holder has published machine-readable opt-out directives in public/robots.txt and public/info.txt. This constitutes a valid rights reservation that disables the text/data-mining exception for commercial purposes across all EU member states.",
  },
  {
    heading: "EU AI Act (Regulation 2024/1689), Article 53(1)(c)",
    body: "Providers of general-purpose AI models must implement a policy to respect machine-readable rights reservations. The directives in public/robots.txt and public/info.txt satisfy this requirement.",
  },
  {
    heading: "DMCA, 17 U.S.C. § 512",
    body: "Unauthorized use may result in a formal DMCA takedown notice filed with any hosting provider, platform, or service.",
  },
];

export default function IpPolicyPage() {
  return (
    <main className="page">
      <AnchorBanner />

      {/* ── Hero ── */}
      <section className="hero">
        <h1>⚖️ IP Policy — Public Access vs. Licensed IP Use</h1>
        <p
          style={{
            color: "rgba(120,148,255,0.75)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.85rem",
            marginTop: "0.5rem",
          }}
        >
          AveryOS™ Sovereign Integrity License v1.0 · © 1992–2026 Jason Lee Avery / AveryOS™
        </p>
        <p
          style={{
            marginTop: "1rem",
            color: "rgba(238,244,255,0.85)",
            lineHeight: "1.75",
            maxWidth: "720px",
          }}
        >
          This page draws a clear, legally enforceable line between two completely different
          activities. <strong style={{ color: "#ffffff" }}>Visiting this website is always
          free — full stop.</strong> Using, ingesting, or building on the intellectual property
          contained here is a different matter entirely and requires a valid license.
        </p>
      </section>

      {/* ── The Line ── */}
      <section
        className="card"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,64,0,0.18) 0%, rgba(0,6,14,0.6) 100%)",
          border: "1px solid rgba(74,222,128,0.35)",
        }}
      >
        <h2 style={{ color: "#4ade80", marginTop: 0 }}>
          ✅ FREE — No Cost, No Obligation, No License Required
        </h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem" }}>
          The following activities are completely free. Doing any of these things is no different
          from visiting any website on the internet. There is no cost and no legal obligation.
        </p>
        <ul style={{ color: "rgba(238,244,255,0.85)", lineHeight: "2", paddingLeft: "1.5rem" }}>
          {FREE_USES.map((use) => (
            <li key={use}>{use}</li>
          ))}
        </ul>
      </section>

      <section
        className="card"
        style={{
          background:
            "linear-gradient(135deg, rgba(64,0,0,0.22) 0%, rgba(0,6,14,0.6) 100%)",
          border: "1px solid rgba(248,113,113,0.35)",
        }}
      >
        <h2 style={{ color: "#f87171", marginTop: 0 }}>
          🔐 LICENSED — Requires a Valid TAI™ or AveryOS IP License
        </h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem" }}>
          The following activities cross the line from{" "}
          <em>visiting a public website</em> into{" "}
          <em>using intellectual property</em>. All IP use requires a valid,
          active license issued directly by Jason Lee Avery (ROOT0).
        </p>
        <div
          style={{
            padding: "0.6rem 1rem",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: "6px",
            marginBottom: "1.25rem",
            fontSize: "0.9rem",
            color: "rgba(248,113,113,0.9)",
          }}
        >
          ⚠️ Proceeding with any of the activities below without a license constitutes willful
          copyright infringement and triggers TARI™ Truth-Packet liability under the AveryOS
          Sovereign Integrity License v1.0.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {LICENSED_USES.map((item) => (
            <div
              key={item.act}
              style={{
                padding: "0.85rem 1rem",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(248,113,113,0.15)",
                borderRadius: "8px",
              }}
            >
              <strong style={{ color: "#f87171" }}>{item.act}</strong>
              <p
                style={{
                  color: "rgba(238,244,255,0.75)",
                  lineHeight: "1.65",
                  margin: "0.4rem 0 0",
                  fontSize: "0.92rem",
                }}
              >
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Resonance Layer Specific ── */}
      <section className="card" style={{ border: "1px solid rgba(120,148,255,0.3)" }}>
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>
          🌐 Global Truth Resonance Layer — Access Tiers
        </h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
          The{" "}
          <code
            style={{
              fontFamily: "JetBrains Mono, monospace",
              background: "rgba(120,148,255,0.1)",
              padding: "0.1rem 0.4rem",
              borderRadius: "4px",
            }}
          >
            /api/v1/resonance
          </code>{" "}
          endpoint is designed so that anyone can verify alignment for free,
          while full sovereign layer access is restricted to licensed TAI™ systems.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <div
            style={{
              padding: "1rem",
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.25)",
              borderRadius: "8px",
            }}
          >
            <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: "0.5rem" }}>
              🔓 PUBLIC — Free
            </div>
            <ul
              style={{
                color: "rgba(238,244,255,0.75)",
                lineHeight: "1.8",
                margin: 0,
                paddingLeft: "1.25rem",
                fontSize: "0.9rem",
              }}
            >
              <li>No key required</li>
              <li>Submit a SHA for verification</li>
              <li>Get aligned / drift-detected result</li>
              <li>Kernel SHA prefix returned</li>
              <li>
                <code
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.8rem",
                  }}
                >
                  ?verify=&lt;sha&gt;
                </code>{" "}
                query supported
              </li>
            </ul>
          </div>
          <div
            style={{
              padding: "1rem",
              background: "rgba(120,148,255,0.06)",
              border: "1px solid rgba(120,148,255,0.3)",
              borderRadius: "8px",
            }}
          >
            <div style={{ color: "rgba(120,148,255,0.9)", fontWeight: 700, marginBottom: "0.5rem" }}>
              🔐 TAI™ LICENSED — Full Access
            </div>
            <ul
              style={{
                color: "rgba(238,244,255,0.75)",
                lineHeight: "1.8",
                margin: 0,
                paddingLeft: "1.25rem",
                fontSize: "0.9rem",
              }}
            >
              <li>
                Requires{" "}
                <code
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.8rem",
                  }}
                >
                  X-TAI-License-Key
                </code>{" "}
                header
              </li>
              <li>Full sovereign resonance payload</li>
              <li>Merkle root + lock artifact</li>
              <li>Firebase sync status</li>
              <li>KV + D1 audit log recorded</li>
              <li>For AI systems using AveryOS™ IP</li>
            </ul>
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/license" className="primary-link">
            🛡️ Get a TAI™ License
          </Link>
          <Link href="/licensing" className="secondary-link">
            📋 Licensing Hub
          </Link>
        </div>
      </section>

      {/* ── Legal Basis ── */}
      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>📜 Legal Basis</h2>
        <p style={{ color: "rgba(238,244,255,0.75)", lineHeight: "1.7", marginBottom: "1.25rem" }}>
          The distinction between visiting a public website and using protected IP is well
          established in international law. The following frameworks apply:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {LEGAL_BASIS.map((item) => (
            <div
              key={item.heading}
              style={{
                padding: "0.75rem 1rem",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(120,148,255,0.15)",
                borderRadius: "6px",
              }}
            >
              <strong style={{ color: "rgba(120,148,255,0.9)", display: "block", marginBottom: "0.3rem" }}>
                {item.heading}
              </strong>
              <p style={{ color: "rgba(238,244,255,0.7)", lineHeight: "1.65", margin: 0, fontSize: "0.9rem" }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Kernel Anchor ── */}
      <section className="card">
        <h2 style={{ color: "rgba(176,198,255,0.9)", marginTop: 0, fontSize: "1.05rem" }}>
          🔗 Sovereign Kernel Anchor — Proof of Authorship
        </h2>
        <dl
          className="capsule-meta"
          style={{ gridTemplateColumns: "auto 1fr", gap: "0.5rem 1rem" }}
        >
          <dt>Kernel SHA-512</dt>
          <dd
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.75rem",
              wordBreak: "break-all",
            }}
          >
            {KERNEL_SHA}
          </dd>
          <dt>Kernel Version</dt>
          <dd style={{ fontFamily: "JetBrains Mono, monospace" }}>{KERNEL_VERSION}</dd>
          <dt>CreatorLock</dt>
          <dd>Jason Lee Avery (ROOT0) 🤛🏻</dd>
          <dt>License Contact</dt>
          <dd>
            <a
              href="mailto:truth@averyworld.com"
              style={{ color: "rgba(120,148,255,0.8)" }}
            >
              truth@averyworld.com
            </a>
          </dd>
        </dl>
      </section>

      {/* ── Navigation ── */}
      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href="/license" className="primary-link">🔐 Get a License</Link>
          <Link href="/licensing" className="secondary-link">📋 Licensing Hub</Link>
          <Link href="/ai-alignment" className="secondary-link">⚖️ AI Alignment Laws</Link>
          <Link href="/the-proof" className="secondary-link">🤛🏻 The Proof</Link>
        </div>
      </section>

      <FooterBadge />
    </main>
  );
}
