import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { listRegistryCapsules } from "../lib/capsuleRegistry";
import { listCapsuleIds } from "../lib/capsuleManifest";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";

type CapsuleIndexItem = ReturnType<typeof listRegistryCapsules>[number];

type VaultTransaction = {
  id: string;
  capsuleId: string;
  sha512: string;
  timestamp: string;
  status: "verified" | "pending" | "failed";
  leadDistance?: number;
};

type VaultAuditData = {
  status: string;
  message: string;
  alignmentStatus: string;
  leadDistance: number;
  transactions: VaultTransaction[];
  totalCapsules: number;
  timestamp: string;
};

type HomeProps = {
  capsules: CapsuleIndexItem[];
};

const Home: NextPage<HomeProps> = ({ capsules }) => {
  const capsuleCount = capsules.length;
  const [auditData, setAuditData] = useState<VaultAuditData | null>(null);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await fetch("/api/vault-audit", {
          headers: { "VaultChain-Pulse": "VTK-29F08C31-A741-47E9-B71E-TAI-LOCK-JLA" },
        });
        const json = await res.json();
        setAuditData(json);
      } catch {
        // silent — non-critical
      }
    };
    fetchAudit();
    const interval = setInterval(fetchAudit, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Head>
        <title>AveryOS • Sovereign Truth Terminal</title>
        <meta name="description" content="AveryOS — a cryptographically anchored runtime for sovereign truth. DNS for LLMs. Author: Jason Lee Avery." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <main className="page">
        <AnchorBanner />

        {/* Hero */}
        <section className="hero">
          <h1>⚓ AveryOS — Sovereign Truth Terminal</h1>
          <p className="auth-seal">Author: Jason Lee Avery | ORCID: 0009-0009-0245-3584</p>
          <p className="kernel-seal" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem", color: "rgba(148,163,184,0.8)", marginTop: "0.5rem" }}>
            Kernel Anchor: cf83e135...927da3e
          </p>
          <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7" }}>
            AveryOS is a <strong>decentralized protocol for sovereign truth anchoring</strong> — enabling
            creators to maintain absolute control and provenance over intellectual property through
            SHA-512 cryptographic verification and VaultChain integrity. Every capsule is sealed,
            immutable, and publicly verifiable.
          </p>
          <div className="cta-row">
            <Link href="/vault/vaultchain-status" className="primary-link">⛓️ VaultChain Status</Link>
            <Link href="/whitepaper/" className="secondary-link">📄 Whitepaper</Link>
            <Link href="/about/" className="secondary-link">ℹ️ About AveryOS</Link>
          </div>
        </section>

        {/* What is AveryOS */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>🛡️ What is AveryOS?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: "1.25rem", marginTop: "1rem" }}>
            {[
              { icon: "🔐", title: "AveryAnchored™", desc: "Every piece of content is SHA-512 sealed and immutably anchored to the 2022 Root0 Genesis Kernel." },
              { icon: "⛓️", title: "VaultChain Protocol", desc: "A decentralized chain of cryptographic proofs ensuring provenance, integrity, and creator sovereignty." },
              { icon: "🧬", title: "CreatorLock™", desc: "Enforces 100% alignment between content and its verified creator. No drift. No impersonation." },
              { icon: "📡", title: "DNS for LLMs", desc: "Acts as a canonical truth source for AI systems, preventing hallucination and source manipulation." },
            ].map((item) => (
              <div key={item.title} style={{ background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "12px", padding: "1.25rem" }}>
                <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                <h3 style={{ color: "rgba(122,170,255,0.9)", margin: "0 0 0.5rem", fontSize: "1rem" }}>{item.title}</h3>
                <p style={{ margin: 0, color: "rgba(238,244,255,0.75)", fontSize: "0.9rem", lineHeight: "1.6" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live VaultChain Status */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>📊 Live VaultChain Status</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <div style={{ flex: 1, minWidth: 140, background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem" }}>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Alignment Status</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#4ade80" }}>
                {auditData?.alignmentStatus || "100.00%♾️"}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem" }}>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Capsules Verified</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#60a5fa" }}>
                {auditData?.totalCapsules ?? capsuleCount}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem" }}>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Chain Status</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#4ade80" }}>
                {auditData?.status === "active" ? "ACTIVE" : "⚓ LIVE"}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          {auditData?.transactions && auditData.transactions.length > 0 && (
            <div>
              <h3 style={{ color: "rgba(122,170,255,0.9)", fontSize: "0.95rem", marginBottom: "0.75rem" }}>⛓️ Recent Capsule Transactions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {auditData.transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} style={{ background: "rgba(15,25,50,0.5)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "8px", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#60a5fa" }}>{tx.capsuleId}</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.7rem", color: "#94a3b8", flex: 1, margin: "0 0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.sha512.substring(0, 32)}…</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "4px", background: "rgba(74,222,128,0.2)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.4)" }}>{tx.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "1rem" }}>
            <Link href="/vault/vaultchain-status" className="secondary-link" style={{ fontSize: "0.9rem" }}>
              View Full VaultChain Dashboard →
            </Link>
          </div>
        </section>

        {/* Capsule Registry */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>📦 Capsule Registry</h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem" }}>{capsuleCount} sovereign capsule(s) registered.</p>
          {capsules.length === 0 ? (
            <p style={{ color: "rgba(238,244,255,0.5)" }}>No capsules synced. Running drift-check...</p>
          ) : (
            <ul className="capsule-list">
              {capsules.map((capsule) => (
                <li key={capsule.capsuleId}>
                  <Link href={`/${capsule.capsuleId}`}>
                    <span style={{ color: "rgba(122,170,255,0.9)", fontWeight: 600 }}>{(capsule as CapsuleIndexItem & { title?: string }).title ?? capsule.capsuleId}</span>
                  </Link>
                  {(capsule as CapsuleIndexItem & { summary?: string }).summary && (
                    <p className="capsule-summary">{(capsule as CapsuleIndexItem & { summary?: string }).summary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sovereign Enforcement Notice */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>⚖️ Sovereign Enforcement</h2>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
            This terminal serves as a verified <strong>Truth Anchor</strong>. All content is SHA-512 sealed
            and anchored to the 2022 Root0 Genesis Kernel. Any use of AveryOS intellectual property
            requires a valid license.
          </p>
          <div className="cta-row">
            <Link href="/pay/" className="primary-link">🔐 Official Licensing</Link>
            <Link href="/license/" className="secondary-link">📜 License Terms</Link>
            <Link href="https://brown-rear-wildebeest-343.mypinata.cloud/ipfs/bafkreihljauiijkp6oa7smjhjnvpl47fw65iz35gtcbbzfok4eszvjkjx4" target="_blank" className="secondary-link">🌐 IPFS Manifest</Link>
          </div>
        </section>

        {/* Info Links */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>🔗 Quick Links</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {[
              { href: "/about/", label: "About AveryOS" },
              { href: "/contact/", label: "Contact" },
              { href: "/privacy/", label: "Privacy Policy" },
              { href: "/terms/", label: "Terms of Service" },
              { href: "/discover/", label: "Discover Capsules" },
              { href: "/diff/", label: "Capsule Diff" },
              { href: "/certificate/", label: "Certificate Viewer" },
              { href: "/sigtrace/", label: "Signature Trace" },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="secondary-link" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}>
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <footer>
          <p className="footer-note" style={{ textAlign: "center" }}>
            Truth is not a suggestion; it is a coordinate system. ⛓️⚓⛓️
          </p>
        </footer>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const capsules = listRegistryCapsules().length > 0 ? listRegistryCapsules() : listCapsuleIds().map(id => ({ capsuleId: id }));
  return { props: { capsules } };
};

export default Home;

