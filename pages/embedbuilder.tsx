import Head from "next/head";
import { useState } from "react";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";

const EmbedBuilderPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/embedbuilder`;

  const [capsuleId, setCapsuleId] = useState("");
  const [embedType, setEmbedType] = useState<"card" | "feed" | "verify">("card");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("400");
  const [copied, setCopied] = useState(false);

  const embedUrl = capsuleId
    ? `${siteUrl}/${capsuleId}?embed=1&type=${embedType}&theme=${theme}`
    : `${siteUrl}/verify?embed=1&theme=${theme}`;

  const embedCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  style="border:none;border-radius:12px;"
  title="AveryOS Capsule Embed"
  loading="lazy"
  allow="clipboard-read; clipboard-write"
></iframe>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Head>
        <title>Embed Capsule Builder • AveryOS</title>
        <meta
          name="description"
          content="Build and generate embed code for AveryOS capsule content. Copy iframe snippets for any capsule."
        />
        <meta property="og:title" content="Embed Capsule Builder • AveryOS" />
        <meta property="og:description" content="Generate embed code for AveryOS capsule content." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <AnchorBanner />

        <section className="hero">
          <h1>🔧 Embed Capsule Builder</h1>
          <p>
            Generate embeddable iframe snippets for any AveryOS capsule. Configure the capsule ID,
            embed type, theme, and dimensions — then copy the code directly into your site.
          </p>
        </section>

        <section className="card">
          <h2>Build Your Embed</h2>

          <div className="form-grid">
            <label>
              Capsule ID (leave blank to embed the Verify page)
              <input
                type="text"
                placeholder="e.g. root0-genesis-kernel"
                value={capsuleId}
                onChange={(e) => setCapsuleId(e.target.value)}
              />
            </label>

            <label>
              Embed Type
              <select
                value={embedType}
                onChange={(e) => setEmbedType(e.target.value as "card" | "feed" | "verify")}
                style={{ padding: "0.65rem 0.75rem", borderRadius: "10px", border: "1px solid rgba(120,148,255,0.25)", background: "rgba(2,6,23,0.8)", color: "inherit" }}
              >
                <option value="card">Card — Single capsule summary</option>
                <option value="feed">Feed — Transaction stream</option>
                <option value="verify">Verify — Hash verification tool</option>
              </select>
            </label>

            <label>
              Theme
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as "dark" | "light")}
                style={{ padding: "0.65rem 0.75rem", borderRadius: "10px", border: "1px solid rgba(120,148,255,0.25)", background: "rgba(2,6,23,0.8)", color: "inherit" }}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>
                Width
                <input
                  type="text"
                  placeholder="100%"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </label>
              <label>
                Height (px)
                <input
                  type="text"
                  placeholder="400"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Generated Embed Code</h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem" }}>
            Copy this code and paste it into your website&apos;s HTML.
          </p>
          <div style={{ position: "relative" }}>
            <pre style={{
              background: "rgba(2,6,23,0.9)",
              border: "1px solid rgba(120,148,255,0.25)",
              borderRadius: "10px",
              padding: "1.25rem",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.82rem",
              color: "rgba(238,244,255,0.9)",
              lineHeight: 1.7,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}>
              {embedCode}
            </pre>
            <button
              type="button"
              className="secondary-button"
              onClick={handleCopy}
              style={{ position: "absolute", top: "0.75rem", right: "0.75rem", fontSize: "0.8rem", padding: "0.4rem 0.85rem" }}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Preview</h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem" }}>
            Live preview of the embed at the configured dimensions.
          </p>
          <div style={{ border: "1px solid rgba(120,148,255,0.25)", borderRadius: "12px", overflow: "hidden", background: "rgba(2,6,23,0.5)" }}>
            <iframe
              src={embedUrl}
              width={width}
              height={`${height}px`}
              style={{ border: "none", display: "block" }}
              title="AveryOS Embed Preview"
              loading="lazy"
            />
          </div>
        </section>

        <section className="card">
          <h2>Embed Types</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            {[
              { type: "card", title: "Card Embed", desc: "Shows a single capsule summary with SHA-512 hash and metadata." },
              { type: "feed", title: "Feed Embed", desc: "Displays a live stream of capsule transactions and verification events." },
              { type: "verify", title: "Verify Embed", desc: "Embeds the SHA-512 hash verification tool for any capsule." },
            ].map((item) => (
              <div key={item.type} style={{ background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1rem" }}>
                <h3 style={{ color: "rgba(122,170,255,0.9)", margin: "0 0 0.5rem", fontSize: "1rem" }}>{item.title}</h3>
                <p style={{ margin: 0, color: "rgba(238,244,255,0.7)", fontSize: "0.875rem", lineHeight: "1.6" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Need Help?</h2>
          <p>
            For licensing inquiries or technical assistance with embedding AveryOS capsule content,
            contact{" "}
            <a href="mailto:truth@averyworld.com" style={{ color: "rgba(120,148,255,0.9)" }}>
              truth@averyworld.com
            </a>
            .
          </p>
        </section>
      </main>
    </>
  );
};

export default EmbedBuilderPage;

