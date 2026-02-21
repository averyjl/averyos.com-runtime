import Head from "next/head";
import { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "../layout/Layout";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";

type Capsule = {
  capsuleId: string;
  title?: string;
  summary?: string;
  sha?: string;
};

const DiscoverPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/discover`;
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [filtered, setFiltered] = useState<Capsule[]>([]);
  const [query, setQuery] = useState("");
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
        setCapsules(list);
        setFiltered(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setFiltered(capsules);
    } else {
      setFiltered(
        capsules.filter(
          (c) =>
            c.capsuleId.toLowerCase().includes(q) ||
            (c.title && c.title.toLowerCase().includes(q)) ||
            (c.summary && c.summary.toLowerCase().includes(q))
        )
      );
    }
  }, [query, capsules]);

  const featured = [
    { icon: "⚓", title: "VaultChain Status", href: "/vault/vaultchain-status", desc: "Live sovereign monitoring dashboard — capsule integrity, alignment, and transaction feed." },
    { icon: "📜", title: "License", href: "/license", desc: "AveryOS Sovereign Integrity License v1.0 terms and SHA-512 verification." },
    { icon: "🔐", title: "Signature Trace", href: "/sigtrace", desc: "Trace and audit cryptographic signature chains across all capsules." },
    { icon: "📊", title: "Capsule Diff", href: "/diff", desc: "Compare historical SHA-512 snapshots and visualize capsule changes over time." },
    { icon: "🧾", title: "Certificate Viewer", href: "/certificate", desc: "View VaultProof certificates and sovereign integrity certificates." },
    { icon: "🔧", title: "Embed Builder", href: "/embedbuilder", desc: "Generate iframe embed code for any AveryOS capsule or verification tool." },
  ];

  return (
    <Layout>
      <Head>
        <title>Discover • AveryOS Runtime</title>
        <meta name="description" content="Discover and explore capsules across the AveryOS sovereign ecosystem." />
        <meta property="og:title" content="Discover • AveryOS Runtime" />
        <meta property="og:description" content="Discover capsules and modules in the AveryOS ecosystem" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <AnchorBanner />

        <section className="hero">
          <h1>🔍 Discover</h1>
          <p>
            Explore and discover capsules across the AveryOS sovereign ecosystem. Search by capsule ID,
            title, or description, or browse featured modules below.
          </p>
        </section>

        {/* Search */}
        <section className="card">
          <h2>Search Capsules</h2>
          <div className="form-grid">
            <label>
              Search by capsule ID, title, or description
              <input
                type="text"
                placeholder="e.g. genesis, vault, retroclaim..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          {loading ? (
            <p style={{ color: "rgba(238,244,255,0.6)", marginTop: "1rem" }}>Loading capsule registry...</p>
          ) : (
            <div style={{ marginTop: "1rem" }}>
              <p style={{ color: "rgba(238,244,255,0.6)", fontSize: "0.85rem" }}>
                {filtered.length} result{filtered.length !== 1 ? "s" : ""} found
                {query && ` for "${query}"`}
              </p>
              {filtered.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
                  {filtered.map((capsule) => (
                    <Link
                      key={capsule.capsuleId}
                      href={`/${capsule.capsuleId}`}
                      style={{ display: "block", textDecoration: "none", background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1rem", transition: "border-color 0.2s ease" }}
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
              ) : (
                <p style={{ color: "rgba(238,244,255,0.5)" }}>No capsules match your search.</p>
              )}
            </div>
          )}
        </section>

        {/* Featured Modules */}
        <section className="card">
          <h2>Featured Modules</h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Core AveryOS tools and pages to explore:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "0.75rem" }}>
            {featured.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ display: "block", textDecoration: "none", background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1.25rem", transition: "border-color 0.2s ease" }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                <div style={{ color: "rgba(122,170,255,0.9)", fontWeight: 600, marginBottom: "0.25rem" }}>{item.title}</div>
                <div style={{ color: "rgba(238,244,255,0.65)", fontSize: "0.85rem", lineHeight: "1.5" }}>{item.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Category Browse */}
        <section className="card">
          <h2>Browse by Category</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: "0.75rem" }}>
            {[
              { label: "⛓️ VaultChain", href: "/vault/vaultchain-status" },
              { label: "📜 Licensing", href: "/license" },
              { label: "✅ Verification", href: "/verify" },
              { label: "📊 Audit Log", href: "/retroclaim-log" },
              { label: "🧾 Certificates", href: "/certificate" },
              { label: "🔐 Signatures", href: "/sigtrace" },
              { label: "📄 Whitepaper", href: "/whitepaper" },
              { label: "👁️ Witness", href: "/witness/register" },
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
    </Layout>
  );
};

export default DiscoverPage;

