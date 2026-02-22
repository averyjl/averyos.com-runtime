import Head from "next/head";
import AnchorBanner from "../components/AnchorBanner";

const CERTIFICATES = [
  {
    id: "VaultProof-DriftShield-v4",
    title: "VaultProof DriftShield Certificate v4",
    description: "Capsule lineage integrity certificate verifying SHA-512 anchoring through four consecutive drift-shield validations.",
    issued: "2026-02-15",
    issuer: "AveryOS Sovereign Integrity Authority",
    capsuleId: "root0-genesis-kernel",
    sha512: "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    status: "valid",
  },
  {
    id: "CreatorLock-Protocol-v1",
    title: "CreatorLock Protocol Certificate v1",
    description: "Sovereign authorship certificate establishing 100% alignment between AveryOS content and verified creator Jason Lee Avery.",
    issued: "2026-01-01",
    issuer: "AveryOS CreatorLock Authority",
    capsuleId: "averyos-sovereign-manifest",
    sha512: "f8262358accd4985778431ddc3f57a8221230ecbead2a9776c79481800457ab5b42b00295ca14ee5db9d27245034eced9ac946d3b97824725c0f75d3c3c6490e",
    status: "valid",
  },
  {
    id: "SIL-v1-License-Anchor",
    title: "Sovereign Integrity License v1.0 Anchor",
    description: "Cryptographic certificate anchoring the AveryOS Sovereign Integrity License v1.0 to the VaultChain genesis block.",
    issued: "2022-01-01",
    issuer: "AveryOS Root0 Authority",
    capsuleId: "root0-genesis-kernel",
    sha512: "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    status: "valid",
  },
];

export default function CertificateViewer() {
  return (
    <>
      <Head>
        <title>Certificate Viewer • AveryOS</title>
        <meta name="description" content="View AveryOS VaultProof certificates and sovereign integrity certificates." />
      </Head>

      <main className="page">
        <AnchorBanner />

        <section className="hero">
          <h1>🧾 Certificate Viewer</h1>
          <p>
            AveryOS sovereign integrity certificates — cryptographically signed proofs of capsule
            lineage, creator authenticity, and license anchoring. All certificates are SHA-512
            sealed and publicly verifiable on the VaultChain.
          </p>
        </section>

        {/* Certificate List */}
        {CERTIFICATES.map((cert) => (
          <section key={cert.id} className="card" style={{ border: "1px solid rgba(120,148,255,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ color: "rgba(122,170,255,0.9)", margin: "0 0 0.25rem", fontSize: "1.2rem" }}>
                  🧾 {cert.title}
                </h2>
                <span style={{
                  display: "inline-flex",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.2rem 0.6rem",
                  borderRadius: "4px",
                  background: "rgba(74,222,128,0.2)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.4)",
                  textTransform: "uppercase",
                }}>
                  ✓ {cert.status}
                </span>
              </div>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.78rem", color: "rgba(238,244,255,0.5)" }}>
                Issued: {cert.issued}
              </span>
            </div>

            <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem" }}>
              {cert.description}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ background: "rgba(9,16,34,0.5)", borderRadius: "8px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.25rem" }}>Issuer</div>
                <div style={{ fontSize: "0.9rem", color: "rgba(238,244,255,0.85)" }}>{cert.issuer}</div>
              </div>
              <div style={{ background: "rgba(9,16,34,0.5)", borderRadius: "8px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.25rem" }}>Capsule ID</div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#60a5fa" }}>{cert.capsuleId}</div>
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(238,244,255,0.5)", marginBottom: "0.4rem" }}>SHA-512 Fingerprint</div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "#94a3b8", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", padding: "0.6rem", borderRadius: "6px", border: "1px solid rgba(120,148,255,0.15)" }}>
                {cert.sha512}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <a
                href={`/verify?capsule=${encodeURIComponent(cert.capsuleId)}`}
                className="secondary-link"
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
              >
                🔍 Verify on VaultChain
              </a>
              <a
                href="/diff"
                className="secondary-link"
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
              >
                📊 Compare SHA Snapshot
              </a>
            </div>
          </section>
        ))}

        <section className="card">
          <h2>About Sovereign Certificates</h2>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
            AveryOS sovereign certificates are cryptographic proofs that a capsule, license, or
            protocol has been verified and anchored to the VaultChain. Each certificate contains:
          </p>
          <ul style={{ lineHeight: "2", color: "rgba(238,244,255,0.8)" }}>
            <li>A unique certificate ID tied to a specific capsule and event</li>
            <li>A SHA-512 fingerprint of the certified content</li>
            <li>The issuing authority and timestamp</li>
            <li>A VaultChain anchor linking it to the immutable genesis kernel</li>
          </ul>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem", marginTop: "0.75rem" }}>
            To verify a certificate, compare its SHA-512 hash using the{" "}
            <a href="/diff" style={{ color: "rgba(120,148,255,0.9)" }}>Capsule Diff tool</a> or the{" "}
            <a href="/verify" style={{ color: "rgba(120,148,255,0.9)" }}>Verify page</a>.
          </p>
        </section>
      </main>
    </>
  );
}

