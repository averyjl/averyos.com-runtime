"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";
import { KERNEL_SHA } from "../../../lib/sovereignConstants";

const MONO = "JetBrains Mono, monospace";

/** Pulse ring animation CSS injected once into the document. */
const PULSE_KEYFRAMES = `
@keyframes aos-cert-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%       { opacity: 0.9; transform: scale(1.04); }
}
.aos-cert-r1 { animation: aos-cert-pulse 2.4s ease-in-out infinite; }
.aos-cert-r2 { animation: aos-cert-pulse 2.4s ease-in-out infinite; animation-delay: 0.8s; }
.aos-cert-r3 { animation: aos-cert-pulse 2.4s ease-in-out infinite; animation-delay: 1.6s; }
`;

function PulseSeal({
  partnerName,
  alignmentHash,
  tariReference,
  validUntil,
  alignedAt,
}: {
  partnerName: string;
  alignmentHash: string;
  tariReference: string;
  validUntil: string;
  alignedAt: string;
}) {
  const verifyUrl = `/api/v1/verify/${alignmentHash}`;
  const notchTs = alignedAt.replace(/[-:T.Z]/g, "").slice(0, 17).padEnd(17, "0");

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 540,
        margin: "0 auto",
        background: "#020617",
        border: "1px solid rgba(120,148,255,0.45)",
        borderRadius: 12,
        padding: "2rem",
        boxShadow: "0 0 40px rgba(120,148,255,0.12)",
        overflow: "hidden",
      }}
    >
      {/* Animated pulse rings */}
      <div
        style={{
          position: "absolute",
          left: 40,
          top: "50%",
          transform: "translateY(-50%)",
          width: 80,
          height: 80,
        }}
      >
        {[40, 28, 17].map((r, i) => (
          <div
            key={r}
            className={`aos-cert-r${i + 1}`}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: r * 2,
              height: r * 2,
              marginTop: -r,
              marginLeft: -r,
              borderRadius: "50%",
              border: `1.5px solid rgba(120,148,255,${0.35 + i * 0.15})`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 18,
            height: 18,
            marginTop: -9,
            marginLeft: -9,
            borderRadius: "50%",
            background: "rgba(120,148,255,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
          }}
        >
          ⛓
        </div>
      </div>

      {/* Certificate body */}
      <div style={{ marginLeft: 96 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.65rem",
            color: "rgba(120,148,255,0.55)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          AveryOS™ Sovereign Alignment Certificate
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: "0.4rem",
          }}
        >
          {partnerName}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.72rem",
            color: "rgba(120,148,255,0.5)",
            marginBottom: "0.75rem",
          }}
        >
          Ref: {tariReference} &nbsp;|&nbsp; Valid Until:{" "}
          {validUntil.slice(0, 10)}
        </div>

        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.65rem",
            color: "rgba(238,244,255,0.4)",
            marginBottom: "0.25rem",
          }}
        >
          Alignment Hash (SHA-512):
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.58rem",
            color: "rgba(120,148,255,0.7)",
            wordBreak: "break-all",
            marginBottom: "0.75rem",
          }}
          title={alignmentHash}
        >
          {alignmentHash.slice(0, 64)}
          <br />
          {alignmentHash.slice(64)}
        </div>

        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.6rem",
            color: "rgba(238,244,255,0.25)",
            marginBottom: "0.75rem",
          }}
        >
          1,017-notch: {notchTs} &nbsp;|&nbsp; Kernel:{" "}
          {KERNEL_SHA.slice(0, 24)}…
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.4)",
              borderRadius: 4,
              padding: "0.2rem 0.6rem",
              fontFamily: MONO,
              fontSize: "0.7rem",
              color: "#4ade80",
              fontWeight: 700,
            }}
          >
            ✓ ACTIVE
          </span>
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: MONO,
              fontSize: "0.65rem",
              color: "rgba(120,148,255,0.7)",
              textDecoration: "none",
            }}
          >
            🔗 Verify on VaultChain™
          </a>
        </div>
      </div>

      <div
        style={{
          marginTop: "1.25rem",
          fontFamily: MONO,
          fontSize: "0.55rem",
          color: "rgba(120,148,255,0.25)",
          borderTop: "1px solid rgba(120,148,255,0.12)",
          paddingTop: "0.6rem",
        }}
      >
        Issued by Jason Lee Avery (ROOT0) · AveryOS™ Sovereign Integrity License
        v1.0 · averyos.com
      </div>
    </div>
  );
}

function JsonLdSnippet({ jsonLd }: { jsonLd: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(jsonLd, null, 2);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          background: "rgba(120,148,255,0.12)",
          border: "1px solid rgba(120,148,255,0.35)",
          borderRadius: 4,
          color: copied ? "#4ade80" : "rgba(120,148,255,0.8)",
          cursor: "pointer",
          fontFamily: MONO,
          fontSize: "0.65rem",
          padding: "0.2rem 0.5rem",
        }}
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <pre
        style={{
          fontFamily: MONO,
          fontSize: "0.72rem",
          color: "rgba(238,244,255,0.75)",
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(120,148,255,0.2)",
          borderRadius: 8,
          padding: "1rem",
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          margin: 0,
        }}
      >
        {text}
      </pre>
    </div>
  );
}

export default function ComplianceSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <AnchorBanner />
          <section className="hero">
            <p style={{ fontFamily: "JetBrains Mono, monospace", color: "rgba(238,244,255,0.5)", fontSize: "0.85rem" }}>
              ⏳ Loading certificate…
            </p>
          </section>
        </main>
      }
    >
      <ComplianceSuccessContent />
    </Suspense>
  );
}

function ComplianceSuccessContent() {
  const searchParams = useSearchParams();
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Inject keyframes once
  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement("style");
      el.textContent = PULSE_KEYFRAMES;
      document.head.appendChild(el);
      styleRef.current = el;
    }
    return () => {
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, []);

  // Read certificate params from query string (populated by Stripe redirect)
  const partnerName = searchParams.get("partnerName") ?? "Aligned Partner";
  const alignmentHash = searchParams.get("hash") ?? "";
  const tariReference =
    searchParams.get("tariReference") ?? "TARI-SETTLE-1017-001";
  const validUntil =
    searchParams.get("validUntil") ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const alignedAt =
    searchParams.get("alignedAt") ?? new Date().toISOString();

  const hashValid = /^[a-fA-F0-9]{128}$/.test(alignmentHash);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://averyos.com/schema",
    "@type": "SovereignAlignment",
    issuer: "Jason Lee Avery (ROOT0)",
    recipient: partnerName,
    alignment_hash: alignmentHash || "[pending]",
    kernel_anchor: KERNEL_SHA,
    valid_until: validUntil,
    tari_reference: tariReference,
    aligned_at: alignedAt,
    verify_url: hashValid
      ? `https://averyos.com/api/v1/verify/${alignmentHash}`
      : null,
  };

  const handleDownload = () => {
    const bundle = {
      certificate: {
        partnerName,
        alignmentHash,
        tariReference,
        validUntil,
        alignedAt,
        verifyUrl: hashValid
          ? `https://averyos.com/api/v1/verify/${alignmentHash}`
          : null,
        kernelAnchor: KERNEL_SHA,
      },
      jsonLd,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AveryOS-Evidence-Bundle-${alignmentHash.slice(0, 16) || "draft"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="page">
      <AnchorBanner />

      <section className="hero">
        <div
          style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}
        >
          <span style={{ fontSize: "2rem" }}>🏛️</span>
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              background: "linear-gradient(135deg, #7894ff, #4a6fff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: MONO,
            }}
          >
            Sovereign Alignment Certificate
          </h1>
        </div>
        <p
          style={{
            color: "rgba(238,244,255,0.65)",
            fontFamily: MONO,
            fontSize: "0.85rem",
            margin: 0,
          }}
        >
          Your alignment has been sealed to the VaultChain™. This certificate is
          your cryptographic proof of sovereign compliance with AveryOS™
          Intellectual Property.
        </p>
      </section>

      {/* Pulse Seal */}
      <section className="card" style={{ border: "1px solid rgba(120,148,255,0.25)", background: "rgba(9,16,34,0.85)", padding: "1.5rem" }}>
        <h2
          style={{
            color: "#ffffff",
            marginTop: 0,
            fontFamily: MONO,
            fontSize: "1rem",
          }}
        >
          ⚡ Your Pulse Seal — AveryOS™ Alignment Certificate
        </h2>

        {hashValid ? (
          <PulseSeal
            partnerName={partnerName}
            alignmentHash={alignmentHash}
            tariReference={tariReference}
            validUntil={validUntil}
            alignedAt={alignedAt}
          />
        ) : (
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.8rem",
              color: "rgba(251,191,36,0.8)",
              padding: "1.5rem",
              border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: 8,
              background: "rgba(251,191,36,0.05)",
            }}
          >
            ⚠️ Certificate hash not present in URL. This page is populated
            automatically upon successful Stripe settlement. If you believe this
            is an error, contact{" "}
            <a
              href="mailto:truth@averyworld.com"
              style={{ color: "rgba(120,148,255,0.8)" }}
            >
              truth@averyworld.com
            </a>
            .
          </div>
        )}
      </section>

      {/* Download Evidence Bundle */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(74,222,128,0.25)",
          background: "rgba(9,16,34,0.85)",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            color: "#ffffff",
            marginTop: 0,
            fontFamily: MONO,
            fontSize: "1rem",
          }}
        >
          📥 Download Evidence Bundle
        </h2>
        <p
          style={{
            color: "rgba(238,244,255,0.65)",
            fontFamily: MONO,
            fontSize: "0.8rem",
            marginBottom: "1.25rem",
          }}
        >
          Download your complete Evidence Bundle (JSON) containing the
          certificate data and JSON-LD Truth-Packet for embedding on your site.
        </p>
        <button
          onClick={handleDownload}
          style={{
            background: "linear-gradient(135deg, rgba(120,148,255,0.2), rgba(74,222,128,0.15))",
            border: "1px solid rgba(74,222,128,0.5)",
            borderRadius: 8,
            color: "#4ade80",
            cursor: "pointer",
            fontFamily: MONO,
            fontSize: "0.9rem",
            fontWeight: 700,
            padding: "0.75rem 2rem",
            letterSpacing: "0.05em",
            transition: "opacity 0.15s",
          }}
        >
          ⬇ Download Evidence Bundle
        </button>
      </section>

      {/* JSON-LD Truth-Packet */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(120,148,255,0.2)",
          background: "rgba(9,16,34,0.85)",
          padding: "1.5rem",
        }}
      >
        <h2
          style={{
            color: "#ffffff",
            marginTop: 0,
            fontFamily: MONO,
            fontSize: "1rem",
          }}
        >
          🔗 JSON-LD Truth-Packet
        </h2>
        <p
          style={{
            color: "rgba(238,244,255,0.55)",
            fontFamily: MONO,
            fontSize: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          Embed this JSON-LD in your site&apos;s{" "}
          <code style={{ color: "rgba(120,148,255,0.8)" }}>
            &lt;script type=&quot;application/ld+json&quot;&gt;
          </code>{" "}
          tag to prove to the GabrielOS™ Sentinel that you are in alignment.
        </p>
        <JsonLdSnippet jsonLd={jsonLd} />
      </section>

      <FooterBadge />
    </main>
  );
}
