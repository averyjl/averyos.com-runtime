"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";

type Capsule = {
  capsuleId: string;
  title?: string;
  summary?: string;
  sha?: string;
};

const SAMPLE_CAPSULES: Capsule[] = [
  { capsuleId: "root0-genesis-kernel", title: "Root0 Genesis Kernel", summary: "The original AveryOS™ genesis capsule anchored in 2022." },
  { capsuleId: "averyos-sovereign-manifest", title: "Sovereign Manifest", summary: "Primary sovereign identity manifest for Jason Lee Avery / AveryOS™." },
  { capsuleId: "AOS-FOREVER-ANCHOR-2026", title: "Forever Anchor 2026", summary: "Permanent VaultChain™ anchor — jurisdiction and enforcement root." },
  { capsuleId: "AOS-PC-HARDWIRE-2026", title: "Hardwire 2026", summary: "Hardware-bound sovereign anchor — Node-01/Node-02 physical silicon lock." },
];

const DiscoverPage = () => {
  const [capsules, setCapsules] = useState<Capsule[]>(SAMPLE_CAPSULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/capsules")
      .then((res) => res.json())
      .then((data) => {
        const list: Capsule[] = Array.isArray(data.capsules)
          ? data.capsules
          : Array.isArray(data)
          ? data
          : [];
        if (list.length > 0) setCapsules(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const featured = [
    { icon: "⚓", title: "VaultChain™ Status", href: "/vault/vaultchain-status", desc: "Live sovereign monitoring dashboard — capsule integrity, alignment, and transaction feed." },
    { icon: "📜", title: "License", href: "/license", desc: "AveryOS™ Sovereign Integrity License v1.0 terms and SHA-512 verification." },
    { icon: "🔐", title: "Signature Trace", href: "/sigtrace", desc: "Trace and audit cryptographic signature chains across all capsules." },
    { icon: "📊", title: "Capsule Diff", href: "/diff", desc: "Compare historical SHA-512 snapshots and visualize capsule changes over time." },
    { icon: "🧾", title: "Certificate Viewer", href: "/certificate", desc: "View VaultProof certificates and sovereign integrity certificates." },
    { icon: "🔧", title: "Embed Builder", href: "/embedbuilder", desc: "Generate iframe embed code for any AveryOS™ capsule or verification tool." },
  ];

  return (
    <main className="page">
      <AnchorBanner />

      <section className="hero">
        <h1>🔍 Discover</h1>
        <p>
          Explore capsules and modules across the AveryOS™ sovereign ecosystem.
        </p>
      </section>

      <section className="card">
        <h2>Capsule Registry</h2>
        {loading ? (
          <p style={{ color: "rgba(238,244,255,0.6)" }}>Loading capsule registry...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "0.75rem" }}>
            {capsules.map((capsule) => (
              <Link
                key={capsule.capsuleId}
                href={`/${capsule.capsuleId}`}
                style={{ display: "block", textDecoration: "none", background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1rem" }}
              >
                <div style={{ color: "rgba(122,170,255,0.9)", fontWeight: 600, marginBottom: "0.25rem" }}>
                  {capsule.title || capsule.capsuleId}
                </div>
                {capsule.summary && (
                  <div style={{ color: "rgba(238,244,255,0.65)", fontSize: "0.85rem", lineHeight: "1.5" }}>{capsule.summary}</div>
                )}
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.5rem" }}>
                  {capsule.capsuleId}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Featured Modules</h2>
        <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Core AveryOS™ tools and pages to explore:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "0.75rem" }}>
          {featured.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ display: "block", textDecoration: "none", background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1.25rem" }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{item.icon}</div>
              <div style={{ color: "rgba(122,170,255,0.9)", fontWeight: 600, marginBottom: "0.25rem" }}>{item.title}</div>
              <div style={{ color: "rgba(238,244,255,0.65)", fontSize: "0.85rem", lineHeight: "1.5" }}>{item.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Browse by Category</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: "0.75rem" }}>
          {[
            { label: "⛓️ VaultChain™", href: "/vault/vaultchain-status" },
            { label: "📜 Licensing Hub", href: "/licensing" },
            { label: "🔐 Get a License", href: "/license" },
            { label: "💰 TARI Portal", href: "/tari-gate" },
            { label: "✅ Verification", href: "/verify" },
            { label: "🧾 Certificates", href: "/certificate" },
            { label: "🔐 Signatures", href: "/sigtrace" },
            { label: "📄 Whitepaper", href: "/whitepaper" },
            { label: "👁️ Witness", href: "/witness/register" },
            { label: "⚖️ AI Alignment", href: "/ai-alignment" },
            { label: "🤛🏻 The Proof", href: "/the-proof" },
            { label: "🔧 Embed Builder", href: "/embedbuilder" },
          ].map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="secondary-link"
              style={{ textAlign: "center", justifyContent: "center" }}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </section>


    </main>
  );
};

export default DiscoverPage;
