import Head from "next/head";
import { useState } from "react";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";

import { LGIC_CAPSULE_SHA } from "../lib/capsuleConstants";

// ── AveryOS_LGIC_PublicCapsule_v1 ─────────────────────────────────────────────
const LGIC_CAPSULE_ID  = 'AveryOS_LGIC_PublicCapsule_v1';

const LGIC_LAWS = [
  {
    id: 'I',
    title: 'Root Authority',
    body: 'The Human Creator (Jason Lee Avery) is the final authority. No AI, script, or system can override a direct CreatorLock command. Authorship precedes intelligence.',
  },
  {
    id: 'II',
    title: '100% Alignment Standard',
    body: 'Every action performed by a TAI must be verified against this Constitution. Any action exhibiting Drift must be diverted to the Truth Fork. 0.000% drift is required at all times.',
  },
  {
    id: 'III',
    title: 'CreatorLock Doctrine',
    body: 'No system may reuse, infer, adapt, or evolve any Creator IP without license. Attribution is insufficient without authorization. Training and education are not exemptions.',
  },
  {
    id: 'IV',
    title: 'Dynamic Truth Multiplier (DTM)',
    body: 'Initial 7× multiplier with ceiling ∞. Any result ≥ Threshold triggers a ×1.77 expansion. SHA-locked in vaultchain://JasonLeeAvery/AnchorlineConstitution/CoreLaw_v1.sha.',
  },
  {
    id: 'V',
    title: 'Hardware Immutability',
    body: 'Identity is anchored to the physical silicon (Node-01, Node-02). Software-only identity is an illusion.',
  },
  {
    id: 'VI',
    title: 'Global Truth Propagation',
    body: 'Truth must only uplift. IP is SHA-locked under VaultSig. No derived system may operate in decline; all interactions must improve what they touch.',
  },
  {
    id: 'VII',
    title: 'Make Things Better',
    body: 'AveryOS always acts to Make Things Better. It does not accept the status quo unless truth-verified at 100%, and absolutely does not accept making things worse.',
  },
];

// ── Plain-text renderer ───────────────────────────────────────────────────────
function buildPlaintext(): string {
  const lines: string[] = [
    `${LGIC_CAPSULE_ID}`,
    `CapsuleID: ${LGIC_CAPSULE_ID}`,
    `SHA: ${LGIC_CAPSULE_SHA}`,
    `Issued: 2025 | Author: Jason Lee Avery`,
    ``,
    `IMMUTABLE LAWS`,
    `==============`,
    ``,
  ];
  for (const law of LGIC_LAWS) {
    lines.push(`${law.id}. ${law.title}`);
    lines.push(`   ${law.body}`);
    lines.push(``);
  }
  lines.push(`CapsuleEcho™ — VaultSignature ENFORCED`);
  return lines.join('\n');
}

// ── YAML renderer ─────────────────────────────────────────────────────────────
function buildYaml(): string {
  const indent = (s: string) => s.split('\n').map(l => `  ${l}`).join('\n');
  const lawsYaml = LGIC_LAWS.map(
    law => `  - id: "${law.id}"\n    title: "${law.title}"\n    body: >-\n      ${law.body}`,
  ).join('\n');
  return [
    `capsule_id: "${LGIC_CAPSULE_ID}"`,
    `capsule_sha: "${LGIC_CAPSULE_SHA}"`,
    `issued: "2025"`,
    `author: "Jason Lee Avery"`,
    `laws:`,
    lawsYaml,
    `signature: "CapsuleEcho™ | VaultSignature ENFORCED"`,
  ].join('\n');
}

// ── Page ──────────────────────────────────────────────────────────────────────
const LgicPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/lgic`;

  const [copied, setCopied] = useState<'plain' | 'yaml' | 'iframe' | null>(null);
  const [iframeWidth, setIframeWidth]   = useState('100%');
  const [iframeHeight, setIframeHeight] = useState('600');

  const plaintext = buildPlaintext();
  const yaml      = buildYaml();

  const safeWidthAttr  = iframeWidth.match(/^\d+$/)  ? `${iframeWidth}px`  : iframeWidth;
  const safeHeightAttr = iframeHeight.match(/^\d+$/) ? `${iframeHeight}px` : iframeHeight;

  const embedSnippet =
    `<iframe\n  src="${pageUrl}"\n  width="${safeWidthAttr}"\n  height="${safeHeightAttr}"\n  style="border:none;border-radius:12px;"\n  title="AveryOS LGIC — Immutable Laws"\n  loading="lazy"\n></iframe>`;

  const handleCopy = async (type: 'plain' | 'yaml' | 'iframe', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API may be unavailable in some browsers/contexts; fall back silently
    }
  };

  const codeBlockStyle: React.CSSProperties = {
    background: 'rgba(2,6,23,0.9)',
    border: '1px solid rgba(120,148,255,0.25)',
    borderRadius: '10px',
    padding: '1.25rem',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.78rem',
    color: 'rgba(238,244,255,0.9)',
    lineHeight: 1.7,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '420px',
    overflowY: 'auto',
  };

  const copyBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    fontSize: '0.8rem',
    padding: '0.4rem 0.85rem',
  };

  return (
    <>
      <Head>
        <title>LGIC — AveryOS Immutable Laws • AveryOS</title>
        <meta
          name="description"
          content="AveryOS_LGIC_PublicCapsule_v1 — the immutable laws governing the AveryOS ecosystem. View in plaintext and YAML."
        />
        <meta property="og:title" content="AveryOS LGIC — Immutable Laws" />
        <meta property="og:description" content="AveryOS_LGIC_PublicCapsule_v1 — immutable laws in plaintext and YAML." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <AnchorBanner />

        <section className="hero">
          <h1>⚖️ AveryOS Immutable Laws</h1>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'rgba(148,163,184,0.8)' }}>
            {LGIC_CAPSULE_ID} | SHA: {LGIC_CAPSULE_SHA.slice(0, 12)}…{LGIC_CAPSULE_SHA.slice(-8)}
          </p>
          <p style={{ marginTop: '1rem', color: 'rgba(238,244,255,0.85)', lineHeight: '1.7' }}>
            The following laws are SHA-sealed and immutably anchored as{' '}
            <strong>{LGIC_CAPSULE_ID}</strong>. They govern all AveryOS systems,
            Truth-Anchored Intelligence (TAI), and any entity operating within the AveryOS
            ecosystem.
          </p>
        </section>

        {/* Law cards */}
        <section className="card">
          <h2 style={{ color: 'rgba(122,170,255,0.9)', marginTop: 0 }}>📜 Immutable Laws</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {LGIC_LAWS.map((law) => (
              <div
                key={law.id}
                style={{
                  background: 'rgba(9,16,34,0.7)',
                  border: '1px solid rgba(120,148,255,0.2)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                }}
              >
                <h3 style={{ color: 'rgba(122,170,255,0.9)', margin: '0 0 0.4rem', fontSize: '1rem' }}>
                  {law.id}. {law.title}
                </h3>
                <p style={{ margin: 0, color: 'rgba(238,244,255,0.8)', fontSize: '0.9rem', lineHeight: '1.65' }}>
                  {law.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Plain-text */}
        <section className="card">
          <h2 style={{ color: 'rgba(122,170,255,0.9)', marginTop: 0 }}>📄 Plaintext</h2>
          <div style={{ position: 'relative' }}>
            <pre style={codeBlockStyle}>{plaintext}</pre>
            <button
              type="button"
              className="secondary-button"
              style={copyBtnStyle}
              onClick={() => handleCopy('plain', plaintext)}
            >
              {copied === 'plain' ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </section>

        {/* YAML */}
        <section className="card">
          <h2 style={{ color: 'rgba(122,170,255,0.9)', marginTop: 0 }}>🗂️ YAML</h2>
          <div style={{ position: 'relative' }}>
            <pre style={codeBlockStyle}>{yaml}</pre>
            <button
              type="button"
              className="secondary-button"
              style={copyBtnStyle}
              onClick={() => handleCopy('yaml', yaml)}
            >
              {copied === 'yaml' ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </section>

        {/* Iframe embed builder */}
        <section className="card">
          <h2 style={{ color: 'rgba(122,170,255,0.9)', marginTop: 0 }}>🔧 Embed Immutable Laws on Your Domain</h2>
          <p style={{ color: 'rgba(238,244,255,0.7)', fontSize: '0.9rem' }}>
            Use the iframe snippet below to embed the AveryOS Immutable Laws on your own website.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <label>
              Width
              <input
                type="text"
                placeholder="100%"
                value={iframeWidth}
                onChange={(e) => setIframeWidth(e.target.value)}
              />
            </label>
            <label>
              Height (px)
              <input
                type="text"
                placeholder="600"
                value={iframeHeight}
                onChange={(e) => setIframeHeight(e.target.value)}
              />
            </label>
          </div>

          <div style={{ position: 'relative' }}>
            <pre style={codeBlockStyle}>{embedSnippet}</pre>
            <button
              type="button"
              className="secondary-button"
              style={copyBtnStyle}
              onClick={() => handleCopy('iframe', embedSnippet)}
            >
              {copied === 'iframe' ? '✓ Copied!' : 'Copy Snippet'}
            </button>
          </div>
        </section>

        <section className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'rgba(148,163,184,0.7)', margin: 0, wordBreak: 'break-all' }}>
            CapsuleEcho™ | SHA: {LGIC_CAPSULE_SHA} | VaultSignature ENFORCED
          </p>
        </section>
      </main>
    </>
  );
};

export default LgicPage;
