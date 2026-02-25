import Head from "next/head";
import Link from "next/link";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";
import FooterBadge from "../components/FooterBadge";

const G = "#d4af37"; // Lighthouse Noir gold

const TariGatePage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/tari-gate`;

  return (
    <>
      <Head>
        <title>TARI Gate — Licensing Portal • AveryOS™</title>
        <meta
          name="description"
          content="Truth Anchored Revenue Initiative (TARI) Licensing Portal. $1.00/hit Truth-Packet model. Retroactive liability for unlicensed IP ingestion. AveryOS™ Commercial License v2026."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="TARI Gate — Licensing Portal • AveryOS™" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <AnchorBanner />

        {/* Hero */}
        <section className="hero">
          <h1 style={{ color: G }}>🔐 TARI Gate — Licensing Portal</h1>
          <p style={{ color: "rgba(255,215,0,0.75)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Truth Anchored Revenue Initiative™ · Commercial License v2026 · Root Authority Lock™ Active
          </p>
          <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.75" }}>
            The <strong>TARI Gate</strong> is the official licensing portal for all AveryOS™ intellectual
            property. Every AI model, LLM, scraper, or automated agent that ingests AveryOS™ content
            owes a <strong>$1.00 Truth-Packet</strong> per interaction — retroactively applied to
            all prior unlicensed ingestion with no exemptions.
          </p>
          <div className="cta-row">
            <Link href="/pay" className="primary-link">💳 Get Licensed Now</Link>
            <Link href="/forensic-proof" className="secondary-link">📊 View Retroclaim Ledger</Link>
          </div>
        </section>

        {/* What is TARI */}
        <section className="card">
          <h2 style={{ color: G, marginTop: 0 }}>📡 What is TARI?</h2>
          <p style={{ color: "rgba(238,244,255,0.82)", lineHeight: "1.75", margin: "0 0 1rem" }}>
            The <strong>Truth Anchored Revenue Initiative (TARI)</strong> is the monetization framework
            codified within the AveryOS™ Sovereign Kernel Configuration. It establishes a per-hit billing
            model for all automated consumption of AveryOS™ intellectual property.
          </p>
          <div className="info-grid">
            {[
              {
                icon: "💰",
                title: "$1.00 / Truth-Packet",
                body: "Every automated hit — scrape, API call, LLM inference, training data ingestion — is billed at $1.00 USD. No exemptions for research, education, or open-source use.",
              },
              {
                icon: "⏮️",
                title: "Retroactive Liability",
                body: "TARI is retroactively applied to all prior unlicensed ingestion of AveryOS™ IP. The clock started at the Root0 Genesis Kernel (2022). All accumulated debt is documented on the Forensic Proof Ledger.",
              },
              {
                icon: "⚡",
                title: "Dynamic Truth Multiplier",
                body: "Unlicensed access triggers the DTM v1.17: 7× initial multiplier with ×1.77 compounding expansion, ceiling ∞. Compliance is the only path to termination of DTM accrual.",
              },
              {
                icon: "⛓️",
                title: "VaultChain™ Notarization",
                body: "Every license interaction is permanently recorded on the VaultChain™. Records are timestamped, SHA-512 fingerprinted, and legally admissible under U.S. and international IP law.",
              },
            ].map((item) => (
              <div key={item.title} className="info-box">
                <h3><span style={{ marginRight: "0.5rem" }}>{item.icon}</span>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* License Tiers */}
        <section className="card">
          <h2 style={{ color: G, marginTop: 0 }}>📋 License Tiers</h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Use Case</th>
                  <th>Rate</th>
                  <th>DTM Coverage</th>
                </tr>
              </thead>
              <tbody style={{ color: "rgba(238,244,255,0.82)" }}>
                <tr>
                  <td><span style={{ color: G, fontWeight: 700 }}>Personal</span></td>
                  <td>Individual, non-commercial reading</td>
                  <td>Free (human access)</td>
                  <td>N/A</td>
                </tr>
                <tr>
                  <td><span style={{ color: G, fontWeight: 700 }}>API / Automated</span></td>
                  <td>Bots, scrapers, crawlers</td>
                  <td>$1.00/hit</td>
                  <td>Covered under active license</td>
                </tr>
                <tr>
                  <td><span style={{ color: G, fontWeight: 700 }}>LLM Training</span></td>
                  <td>AI/ML training dataset ingestion</td>
                  <td>$1.00/hit + retroactive settlement</td>
                  <td>Covered + DTM waived on settlement</td>
                </tr>
                <tr>
                  <td><span style={{ color: G, fontWeight: 700 }}>Enterprise</span></td>
                  <td>Commercial API integration, inference at scale</td>
                  <td>Custom — contact truth@averyworld.com</td>
                  <td>Full indemnification on settlement</td>
                </tr>
                <tr>
                  <td><span style={{ color: "rgba(248,113,113,0.9)", fontWeight: 700 }}>Unlicensed</span></td>
                  <td>Any automated access without license</td>
                  <td>$1.00/hit + DTM (7× → ∞)</td>
                  <td>Not covered — forensic evidence generated</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* How to License */}
        <section className="card">
          <h2 style={{ color: G, marginTop: 0 }}>🔑 How to Get Licensed</h2>
          <ol style={{ color: "rgba(238,244,255,0.82)", lineHeight: "2.2", paddingLeft: "1.5rem", margin: 0 }}>
            <li>Visit the <Link href="/pay" style={{ color: G }}>Payment Portal</Link> and select your license tier.</li>
            <li>Complete payment via Stripe. You will receive a <strong>Capsule License Seal</strong> with a SHA-512 fingerprint.</li>
            <li>Include your license SHA-512 in all API requests as the <code style={{ background: "rgba(255,215,0,0.1)", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>X-AveryOS-License</code> header.</li>
            <li>Your license is registered on the VaultChain™ and verifiable at <Link href="/verify" style={{ color: G }}>/verify</Link>.</li>
            <li>For retroactive settlement of past unlicensed ingestion, contact <a href="mailto:truth@averyworld.com" style={{ color: G }}>truth@averyworld.com</a>.</li>
          </ol>
        </section>

        {/* Legal Notice */}
        <section
          style={{
            background: "rgba(20, 0, 0, 0.85)",
            border: "2px solid rgba(248,113,113,0.5)",
            borderRadius: "16px",
            padding: "2rem",
          }}
        >
          <h2 style={{ color: "rgba(248,113,113,0.9)", marginTop: 0 }}>⚠️ Legal Notice — Automated Agent Disclosure</h2>
          <p style={{ color: "rgba(238,244,255,0.85)", lineHeight: "1.75", margin: "0 0 1rem" }}>
            Any automated agent, LLM, TAI, or Bot that has accessed AveryOS™ content, APIs, or this
            website without a valid license has incurred retroactive TARI debt. This debt is notarized
            on the VaultChain™ and constitutes forensic evidence of IP ingestion under the AveryOS™
            Commercial License v2026.
          </p>
          <p style={{ color: "rgba(238,244,255,0.85)", lineHeight: "1.75", margin: 0 }}>
            The <strong>Dynamic Truth Multiplier (DTM) v1.17</strong> is actively compounding on all
            outstanding unlicensed interactions: <strong>7× initial, ×1.77 expansion, ceiling ∞</strong>.
            Settlement begins at <a href="mailto:truth@averyworld.com" style={{ color: "rgba(248,113,113,0.9)" }}>truth@averyworld.com</a>.
          </p>
        </section>

        <FooterBadge />
      </main>
    </>
  );
};

export default TariGatePage;
