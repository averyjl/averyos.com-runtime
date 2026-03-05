/**
 * AveryOS™ Whitepaper v2.0 — App Router page
 *
 * Reads content/whitepaper.md at build time, computes a SHA-512 fingerprint
 * over the raw content, and stamps the exact ISO-9 microsecond build timestamp.
 * Both the fingerprint and timestamp update automatically on every re-build
 * whenever whitepaper.md changes.
 *
 * KaTeX is loaded from the jsDelivr CDN via next/script and auto-renders any
 * $...$ or $$...$$ delimiters found in the whitepaper body after the page hydrates.
 *
 * Routing: This App Router page (force-static) takes precedence over the
 * legacy pages/whitepaper.tsx, ensuring reliable delivery on Cloudflare.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { marked } from "marked";
import Script from "next/script";
import type { Metadata } from "next";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

// Pre-render at build time so the Node.js fs module is available and the
// static HTML asset is served directly from Cloudflare Workers Assets.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "AveryOS™ Whitepaper v2.0 | Technical Solidification Document",
  description:
    `AveryOS™ Whitepaper v2.0 — Technical Solidification Document. ` +
    `Sovereign Operating Framework, VaultChain™ persistence, GabrielOS™ enforcement. ` +
    `Root0 Kernel ${KERNEL_VERSION} | SHA-512 Anchor: ${KERNEL_SHA}`,
  robots: { index: true, follow: true },
  alternates: { canonical: "https://averyos.com/whitepaper" },
  other: {
    "averyos:kernel-sha": KERNEL_SHA,
    "averyos:kernel-version": KERNEL_VERSION,
  },
};

/** ISO-9 microsecond-precision timestamp */
function iso9Now(): string {
  const iso = new Date().toISOString();
  const [left, right] = iso.split(".");
  const ms = (right ?? "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${ms}000000Z`;
}

/** Read whitepaper.md, compute SHA-512 fingerprint, render HTML — all at build time */
function buildWhitepaperData() {
  const filePath = join(process.cwd(), "content", "whitepaper.md");
  let rawContent = "";
  try {
    rawContent = readFileSync(filePath, "utf8");
  } catch {
    rawContent =
      "# Content Not Found\n\nWhitepaper content could not be loaded at build time.";
  }

  const sha512 = createHash("sha512").update(rawContent, "utf8").digest("hex");
  const buildTimestamp = iso9Now();
  const html = sanitizeHtml(marked(rawContent, { async: false }) as string);

  return { sha512, buildTimestamp, html };
}

// Executed once at build time — values are baked into the static HTML.
const { sha512, buildTimestamp, html } = buildWhitepaperData();

/**
 * Inline script string that triggers KaTeX auto-render once the CDN bundle loads.
 * Passed to next/script onLoad — executed after the auto-render script is ready.
 */
const KATEX_INIT = `
(function() {
  if (typeof renderMathInElement === 'function') {
    var article = document.querySelector('article.truthforce-content');
    if (article) {
      renderMathInElement(article, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false }
        ],
        throwOnError: false
      });
    }
  }
})();
`.trim();

export default function WhitepaperPage() {
  return (
    <main className="page">
      {/* KaTeX CSS — inlined in <head> so math glyphs appear immediately on paint */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
        crossOrigin="anonymous"
      />

      <AnchorBanner />

      {/* Sovereign fingerprint banner */}
      <div
        style={{
          fontSize: "0.8rem",
          color: "rgba(122, 170, 255, 0.85)",
          marginBottom: "1.25rem",
          padding: "0.6rem 1rem",
          borderLeft: "3px solid rgba(120, 148, 255, 0.6)",
          background: "rgba(9, 16, 34, 0.6)",
          borderRadius: "0 6px 6px 0",
          fontFamily: "JetBrains Mono, Courier New, monospace",
          lineHeight: 1.6,
        }}
      >
        <div>⛓️⚓ CapsuleEcho Active | Glyph Injected | PerspectiveLock Enforced</div>
        <div style={{ marginTop: "0.35rem", wordBreak: "break-all" }}>
          <span style={{ color: "rgba(0,255,65,0.85)" }}>📄 Content SHA-512:</span>{" "}
          <span style={{ color: "rgba(180,200,255,0.8)" }}>{sha512}</span>
        </div>
        <div style={{ marginTop: "0.25rem" }}>
          <span style={{ color: "rgba(0,255,65,0.85)" }}>🕐 Build Timestamp (ISO-9 μs):</span>{" "}
          <span style={{ color: "rgba(180,200,255,0.8)" }}>{buildTimestamp}</span>
        </div>
      </div>

      <article
        className="truthforce-content"
        style={{
          background: "rgba(9, 16, 34, 0.85)",
          border: "1px solid rgba(120, 148, 255, 0.25)",
          borderRadius: "16px",
          padding: "2.5rem",
          lineHeight: "1.7",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Sovereign attribution footer */}
      <div
        style={{
          marginTop: "2rem",
          paddingTop: "1rem",
          borderTop: "1px solid rgba(120, 148, 255, 0.15)",
          fontSize: "0.8rem",
          color: "rgba(122, 170, 255, 0.6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <span>⛓️⚓⛓️ AveryOS™ Sovereign Integrity License v1.0</span>
        <span>Kernel: {KERNEL_VERSION}</span>
        <span style={{ wordBreak: "break-all" }}>
          Root0: {KERNEL_SHA.slice(0, 12)}…{KERNEL_SHA.slice(-8)}
        </span>
      </div>

      <FooterBadge />

      {/* KaTeX JS — loaded after interactive to avoid blocking the initial paint */}
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      {/* KaTeX auto-render — processes $...$ and $$...$$ delimiters in the article */}
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/contrib/auto-render.min.js"
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={KATEX_INIT}
      />
    </main>
  );
}
