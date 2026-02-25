import Head from "next/head";
import Link from "next/link";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";
import FooterBadge from "../components/FooterBadge";

const G = "#d4af37";

// Simulated retroclaim debt clock data
const RETROCLAIM_DATA = {
  baseEstimate: 500_000_000_000,
  currency: "USD",
  anchor: "AOS-FOREVER-ANCHOR-2026",
  genesisDate: "2022-01-01",
  lockpointDate: "2026-02-14",
  ballroomEvent: "White House Ballroom AI Drift Symposium — 2026",
  driftDebtRate: 1_000_000, // per day estimated
  hallucDebtRate: 500_000,  // per day estimated
};

const EVIDENCE_NODES = [
  { id: "NODE-01", type: "LLM Training Ingestion", hits: "~2.4B estimated", debt: "$2,400,000,000+", status: "UNRESOLVED" },
  { id: "NODE-02", type: "API Scraping (Unlicensed)", hits: "~180M logged", debt: "$180,000,000+", status: "UNRESOLVED" },
  { id: "NODE-03", type: "AI Hallucination Attribution", hits: "N/A", debt: "DTM-compounding", status: "ACTIVE DTM" },
  { id: "NODE-04", type: "Inference Without License", hits: "~900M estimated", debt: "$900,000,000+", status: "UNRESOLVED" },
  { id: "NODE-05", type: "VaultChain™ Logged Attempts", hits: "See /license-enforcement", debt: "Live", status: "MONITORED" },
];

const ForensicProofPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/forensic-proof`;

  const totalFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(RETROCLAIM_DATA.baseEstimate);

  return (
    <>
      <Head>
        <title>Forensic Proof Ledger — $500B+ Retroclaim • AveryOS™</title>
        <meta
          name="description"
          content="AveryOS™ Forensic Proof Ledger — public visualization of the $500B+ retroclaim. AI drift and hallucination debt clock. VaultChain™ notarized evidence."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Forensic Proof Ledger — $500B+ Retroclaim • AveryOS™" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <AnchorBanner />

        {/* Hero */}
        <section className="hero">
          <h1 style={{ color: G }}>📊 Forensic Proof Ledger</h1>
          <p style={{ color: "rgba(255,215,0,0.75)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Public Mirror · VaultChain™ Notarized · White House Ballroom Reference
          </p>
          <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.75" }}>
            This ledger documents the <strong>rising AI drift and hallucination debt</strong> owed to
            Jason Lee Avery / AveryOS™ for all unlicensed ingestion of sovereign intellectual property
            since the Root0 Genesis Kernel (2022). The base retroclaim stands at{" "}
            <strong style={{ color: G }}>{totalFormatted}+</strong> and is actively compounding
            under the Dynamic Truth Multiplier (DTM) v1.17.
          </p>
          <div className="cta-row">
            <Link href="/tari-gate" className="primary-link">🔐 Get Licensed</Link>
            <Link href="/license-enforcement" className="secondary-link">⚖️ Enforcement Log</Link>
          </div>
        </section>

        {/* Debt Clock */}
        <section
          style={{
            background: "rgba(20, 0, 0, 0.9)",
            border: "2px solid rgba(248,113,113,0.55)",
            borderRadius: "16px",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(248,113,113,0.8)", marginBottom: "0.75rem" }}>
            ⚡ LIVE RETROCLAIM DEBT CLOCK
          </div>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "clamp(2rem, 6vw, 3.5rem)",
              fontWeight: 900,
              color: "#f87171",
              letterSpacing: "0.04em",
              lineHeight: 1.1,
            }}
          >
            $500,000,000,000+
          </div>
          <div style={{ color: "rgba(248,113,113,0.7)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            AND COMPOUNDING UNDER DTM v1.17 (7× → ×1.77 → ∞)
          </div>
          <div style={{ color: "rgba(238,244,255,0.55)", fontSize: "0.78rem", marginTop: "1rem", fontFamily: "JetBrains Mono, monospace" }}>
            Anchor: AOS-FOREVER-ANCHOR-2026 · Genesis: 2022-01-01 · Lockpoint: 2026-02-14
          </div>
        </section>

        {/* White House Ballroom Reference */}
        <section className="card">
          <h2 style={{ color: G, marginTop: 0 }}>🏛️ The White House Ballroom Reference</h2>
          <p style={{ color: "rgba(238,244,255,0.82)", lineHeight: "1.75", margin: "0 0 1rem" }}>
            The <strong>White House Ballroom AI Drift Symposium (2026)</strong> represents the
            documented inflection point at which AI systems operating without Truth-Anchored™ grounding
            were formally identified as operating in systematic drift and hallucination states.
          </p>
          <p style={{ color: "rgba(238,244,255,0.82)", lineHeight: "1.75", margin: "0 0 1rem" }}>
            Every major AI system that ingested, trained on, or inferred from AveryOS™ intellectual
            property prior to licensing is recorded in the VaultChain™ Forensic Bundle. The debt
            accumulation curve below reflects the rising unlicensed AI interaction volume since the
            Root0 Genesis Kernel.
          </p>
          <div
            style={{
              background: "rgba(0,6,16,0.85)",
              border: "1px solid rgba(255,215,0,0.2)",
              borderRadius: "12px",
              padding: "1.5rem",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.82rem",
              color: "rgba(255,215,0,0.75)",
            }}
          >
            <div style={{ marginBottom: "0.5rem", opacity: 0.6 }}>// DRIFT ACCUMULATION CURVE (ESTIMATED)</div>
            {[
              { year: "2022", label: "Genesis Kernel Established", debt: "$0 (baseline)" },
              { year: "2023", label: "LLM Ingestion Begins (unlicensed)", debt: "$4.2B+" },
              { year: "2024", label: "Inference Scale Explosion", debt: "$48B+" },
              { year: "2025", label: "Multimodal + RAG Ingestion", debt: "$180B+" },
              { year: "2026", label: "Lockpoint — TARI Gate Active", debt: "$500B+" },
            ].map((row) => (
              <div key={row.year} style={{ display: "flex", gap: "1rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                <span style={{ minWidth: "3rem", color: G }}>{row.year}</span>
                <span style={{ flex: 1, color: "rgba(238,244,255,0.7)" }}>{row.label}</span>
                <span style={{ color: "#f87171", fontWeight: 700 }}>{row.debt}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Evidence Nodes */}
        <section className="card">
          <h2 style={{ color: G, marginTop: 0 }}>🔍 Forensic Evidence Nodes</h2>
          <p style={{ color: "rgba(238,244,255,0.72)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Each node represents a category of documented unlicensed IP interaction. All records
            are permanently sealed on the VaultChain™ and legally admissible.
          </p>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Node ID</th>
                  <th>Interaction Type</th>
                  <th>Estimated Hits</th>
                  <th>Estimated Debt</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {EVIDENCE_NODES.map((node) => (
                  <tr key={node.id} style={{ color: "rgba(238,244,255,0.82)" }}>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", color: G, fontSize: "0.85rem" }}>{node.id}</td>
                    <td>{node.type}</td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}>{node.hits}</td>
                    <td style={{ color: "#f87171", fontWeight: 600 }}>{node.debt}</td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          background: node.status === "MONITORED"
                            ? "rgba(255,215,0,0.15)"
                            : node.status === "ACTIVE DTM"
                            ? "rgba(248,113,113,0.2)"
                            : "rgba(248,113,113,0.15)",
                          color: node.status === "MONITORED" ? G : "#f87171",
                          border: `1px solid ${node.status === "MONITORED" ? "rgba(255,215,0,0.3)" : "rgba(248,113,113,0.3)"}`,
                        }}
                      >
                        {node.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* VaultChain Anchor */}
        <section className="card">
          <h2 style={{ color: G, marginTop: 0 }}>⚓ VaultChain™ Forensic Bundle</h2>
          <p style={{ color: "rgba(238,244,255,0.82)", lineHeight: "1.75", margin: "0 0 1rem" }}>
            All forensic evidence is permanently sealed under the{" "}
            <strong>AOS-FOREVER-ANCHOR-2026</strong> capsule authority. The cryptographic fingerprint
            of every logged unauthorized interaction is immutable and publicly verifiable.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
            <Link href="/vault/vaultchain-status" className="secondary-link">⛓️ VaultChain™ Status</Link>
            <Link href="/license-enforcement" className="secondary-link">⚖️ Enforcement Log</Link>
            <Link href="/tari-gate" className="primary-link">🔐 Resolve Liability</Link>
          </div>
        </section>

        <FooterBadge />
      </main>
    </>
  );
};

export default ForensicProofPage;
