import Head from "next/head";
import { useState } from "react";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";

type TraceResult = {
  valid: boolean;
  capsuleId?: string;
  timestamp?: string;
  issuer?: string;
  leadDistance?: number;
  message: string;
};

const KNOWN_SIGS: Record<string, { capsuleId: string; issuer: string; timestamp: string; leadDistance: number }> = {
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e": {
    capsuleId: "root0-genesis-kernel",
    issuer: "Jason Lee Avery / AveryOS Root0 Authority",
    timestamp: "2022-01-01T00:00:00Z",
    leadDistance: 0,
  },
  "f8262358accd4985778431ddc3f57a8221230ecbead2a9776c79481800457ab5b42b00295ca14ee5db9d27245034eced9ac946d3b97824725c0f75d3c3c6490e": {
    capsuleId: "averyos-sovereign-manifest",
    issuer: "AveryOS VaultChain Authority",
    timestamp: "2026-02-15T06:12:29Z",
    leadDistance: 1,
  },
};

const SigTracePage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/sigtrace`;
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TraceResult | null>(null);
  const [tracing, setTracing] = useState(false);

  const runTrace = async () => {
    const hash = input.trim();
    if (!hash) {
      setResult({ valid: false, message: "Please enter a SHA-512 hash or capsule ID to trace." });
      return;
    }
    setTracing(true);
    setResult(null);

    await new Promise((r) => setTimeout(r, 400)); // Simulate async trace

    const known = KNOWN_SIGS[hash.toLowerCase()];
    if (known) {
      setResult({
        valid: true,
        capsuleId: known.capsuleId,
        issuer: known.issuer,
        timestamp: known.timestamp,
        leadDistance: known.leadDistance,
        message: "✅ Signature verified — anchored to AveryOS VaultChain genesis.",
      });
    } else if (hash.length === 128 && /^[0-9a-f]+$/i.test(hash)) {
      // Valid SHA-512 format but not in registry
      try {
        const res = await fetch(`/api/vaultecho?hash=${encodeURIComponent(hash)}`);
        const data = await res.json();
        if (data.hashMatch) {
          setResult({
            valid: true,
            capsuleId: data.capsuleId,
            message: `✅ Hash found in registry: ${data.capsuleId}`,
          });
        } else {
          setResult({
            valid: false,
            message: "⚠️ Valid SHA-512 format but not found in the VaultChain registry. This signature is unverified.",
          });
        }
      } catch {
        setResult({
          valid: false,
          message: "⚠️ Valid SHA-512 format but unable to verify against registry (network error).",
        });
      }
    } else if (hash.length < 128) {
      // Might be a capsule ID — look up by capsule ID
      const entry = Object.entries(KNOWN_SIGS).find(([, v]) => v.capsuleId === hash);
      if (entry) {
        const [sha, known2] = entry;
        setResult({
          valid: true,
          capsuleId: known2.capsuleId,
          issuer: known2.issuer,
          timestamp: known2.timestamp,
          leadDistance: known2.leadDistance,
          message: `✅ Capsule ID resolved. SHA-512: ${sha.substring(0, 24)}...`,
        });
      } else {
        setResult({
          valid: false,
          message: "❌ Capsule ID not found in the VaultChain signature registry.",
        });
      }
    } else {
      setResult({
        valid: false,
        message: "❌ Invalid input — provide a 128-character SHA-512 hex hash or a valid capsule ID.",
      });
    }
    setTracing(false);
  };

  const DEMO_SIGS = Object.entries(KNOWN_SIGS).map(([sha, info]) => ({
    sha,
    ...info,
  }));

  return (
    <>
      <Head>
        <title>Signature Trace • AveryOS Runtime</title>
        <meta
          name="description"
          content="Trace and audit cryptographic SHA-512 signatures across the AveryOS capsule chain."
        />
        <meta property="og:title" content="Signature Trace • AveryOS Runtime" />
        <meta property="og:description" content="Trace and audit cryptographic signatures across the capsule chain." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <AnchorBanner />

        <section className="hero">
          <h1>🔐 Signature Trace</h1>
          <p>
            Trace and audit cryptographic SHA-512 signatures across the AveryOS VaultChain.
            Enter a hash or capsule ID to verify its origin, issuer, timestamp, and chain position.
          </p>
        </section>

        {/* Trace Tool */}
        <section className="card">
          <h2>Trace a Signature</h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem" }}>
            Enter a SHA-512 hash (128 hex chars) or a capsule ID to trace its signature chain.
          </p>
          <div className="form-grid">
            <label>
              SHA-512 Hash or Capsule ID
              <input
                type="text"
                placeholder="Paste SHA-512 hash or capsule ID (e.g. root0-genesis-kernel)"
                value={input}
                onChange={(e) => { setInput(e.target.value); setResult(null); }}
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}
              />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={runTrace}
              disabled={tracing}
            >
              {tracing ? "Tracing..." : "Trace Signature"}
            </button>
          </div>

          {result && (
            <div style={{
              marginTop: "1.25rem",
              padding: "1.25rem",
              borderRadius: "10px",
              border: `1px solid ${result.valid ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`,
              background: result.valid ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
            }}>
              <p style={{ fontWeight: 700, color: result.valid ? "#4ade80" : "#f87171", margin: "0 0 0.75rem" }}>
                {result.message}
              </p>
              {result.capsuleId && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.25rem" }}>Capsule ID</div>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#60a5fa" }}>{result.capsuleId}</div>
                  </div>
                  {result.issuer && (
                    <div>
                      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.25rem" }}>Issuer</div>
                      <div style={{ fontSize: "0.9rem", color: "rgba(238,244,255,0.85)" }}>{result.issuer}</div>
                    </div>
                  )}
                  {result.timestamp && (
                    <div>
                      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.25rem" }}>Anchored</div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "rgba(238,244,255,0.75)" }}>{new Date(result.timestamp).toLocaleString()}</div>
                    </div>
                  )}
                  {result.leadDistance !== undefined && (
                    <div>
                      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.25rem" }}>Lead Distance</div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#a78bfa" }}>{result.leadDistance}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Known Anchored Signatures */}
        <section className="card">
          <h2>Anchored Signatures Registry</h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Known signatures anchored to the AveryOS VaultChain. Click any entry to trace it.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {DEMO_SIGS.map((sig) => (
              <div
                key={sig.sha}
                style={{
                  background: "rgba(9,16,34,0.7)",
                  border: "1px solid rgba(120,148,255,0.2)",
                  borderRadius: "10px",
                  padding: "1rem",
                  cursor: "pointer",
                }}
                onClick={() => { setInput(sig.sha); setResult(null); }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#60a5fa", fontWeight: 600 }}>
                    {sig.capsuleId}
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "rgba(238,244,255,0.4)", fontFamily: "JetBrains Mono, monospace" }}>
                      Lead: {sig.leadDistance}
                    </span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "4px", background: "rgba(74,222,128,0.2)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.4)" }}>
                      anchored
                    </span>
                  </div>
                </div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.7rem", color: "#94a3b8", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", padding: "0.4rem", borderRadius: "4px", border: "1px solid rgba(120,148,255,0.12)", marginBottom: "0.4rem" }}>
                  {sig.sha}
                </div>
                <div style={{ fontSize: "0.78rem", color: "rgba(238,244,255,0.5)" }}>
                  {sig.issuer} · {new Date(sig.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>How Signature Tracing Works</h2>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
            Every AveryOS capsule is assigned a deterministic SHA-512 signature at creation time.
            This signature is derived from the capsule content and anchored to the VaultChain genesis block,
            creating an immutable chain of provenance.
          </p>
          <ol style={{ lineHeight: "2", color: "rgba(238,244,255,0.8)", marginTop: "0.75rem" }}>
            <li><strong>Hash Generation:</strong> SHA-512(capsule content) → unique 128-char fingerprint</li>
            <li><strong>VaultChain Anchoring:</strong> Hash sealed to genesis kernel with timestamp</li>
            <li><strong>Lead Distance:</strong> Number of blocks from genesis to this capsule</li>
            <li><strong>Trace:</strong> Any hash can be verified against the VaultChain registry</li>
          </ol>
        </section>
      </main>
    </>
  );
};

export default SigTracePage;

