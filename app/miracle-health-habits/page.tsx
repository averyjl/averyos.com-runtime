"use client";

/**
 * app/miracle-health-habits/page.tsx
 *
 * Miracle Health Habits™ — Public Book Page — Phase 115 GATE 115.1 / GATE 123.6.3
 *
 * Establishes a Physical-to-Digital Bridge for Jason Lee Avery's book.
 * Links Author identity to retail nodes on Amazon, Apple, Barnes & Noble,
 * Google Books, and nobis.biz.
 * Includes JSON-LD SoftwareApplication schema for SEO identity anchoring.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import AnchorBanner from "../../components/AnchorBanner";
import Link from "next/link";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG_DARK   = "#020b02";
const GOLD      = "#ffd700";
const GREEN     = "#00ff41";
const DIM_GREEN = "rgba(0,255,65,0.65)";
const BORDER_G  = "rgba(255,215,0,0.3)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";
const BG_PANEL  = "rgba(0,20,0,0.75)";
const RED_DIM   = "rgba(255,100,100,0.15)";

// ── Extended / Secondary Retailer Links ───────────────────────────────────────
const EXTENDED_LINKS = [
  { label: "Scribd",       url: "https://www.scribd.com/search?query=Miracle+Health+Habits+Jason+Avery" },
  { label: "Kobo",         url: "https://www.kobo.com/en/search?query=Miracle+Health+Habits+Jason+Avery" },
  { label: "IngramSpark",  url: "https://www.ingramcontent.com/" },
  { label: "Smashwords",   url: "https://www.smashwords.com/books/search?query=Miracle+Health+Habits+Jason+Avery" },
];

// ── Retail Links ───────────────────────────────────────────────────────────────
const RETAIL_LINKS = [
  {
    platform: "Amazon",
    icon: "📦",
    url: "https://www.amazon.com/s?k=Miracle+Health+Habits+Jason+Avery",
    description: "Available on Amazon — print and digital editions.",
    color: "#FF9900",
  },
  {
    platform: "Apple Books",
    icon: "🍎",
    url: "https://books.apple.com/us/book/miracle-health-habits/id6745434921",
    description: "Available on Apple Books — read on any Apple device.",
    color: "#0071e3",
  },
  {
    platform: "Barnes & Noble",
    icon: "📚",
    url: "https://www.barnesandnoble.com/s/Miracle+Health+Habits+Jason+Avery",
    description: "Available at Barnes & Noble — in-store and online.",
    color: "#006600",
  },
  {
    platform: "Google Books",
    icon: "🔍",
    url: "https://books.google.com/books?q=Miracle+Health+Habits+Jason+Avery",
    description: "Available on Google Books — search, preview, and read digitally.",
    color: "#4285F4",
  },
  {
    platform: "nobis.biz",
    icon: "⚓",
    url: "https://nobis.biz",
    description: "Available via nobis.biz — sovereign distribution node.",
    color: "#ffd700",
  },
];

// ── Extended / Secondary Retailer Links ───────────────────────────────────────
const EXTENDED_LINKS = [
  { label: "Kindle",  url: "https://www.amazon.com/s?k=Miracle+Health+Habits+Jason+Avery&i=digital-text" },
  { label: "Kobo",    url: "https://www.kobo.com/us/en/search?query=Miracle+Health+Habits+Jason+Avery" },
  { label: "Audible", url: "https://www.audible.com/search?keywords=Miracle+Health+Habits+Jason+Avery" },
];

// ── Structured Data (JSON-LD) ──────────────────────────────────────────────────
const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "Miracle Health Habits",
  "author": {
    "@type": "Person",
    "name": "Jason Lee Avery",
    "sameAs": [
      "https://averyos.com",
      "https://averyos.com/creator-lock",
    ],
  },
  "publisher": "AveryOS™ Publishing",
  "description":
    "Miracle Health Habits by Jason Lee Avery — a sovereign guide to physical " +
    "and cognitive optimization anchored to truth-aligned principles.",
  "inLanguage": "en",
  "offers": {
    "@type": "AggregateOffer",
    "availability": "https://schema.org/InStock",
    "priceCurrency": "USD",
    "offerCount": RETAIL_LINKS.length.toString(),
  },
  "sameAs": RETAIL_LINKS.map((r) => r.url),
});

export default function MiracleHealthHabitsPage() {
  return (
    <>
      {/* JSON-LD schema for SEO identity anchoring */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON_LD }}
      />

      <main style={{
        minHeight: "100vh",
        background: BG_DARK,
        color: GREEN,
        fontFamily: FONT_MONO,
        padding: "2rem 1rem",
        maxWidth: "900px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}>
        <AnchorBanner />

        {/* Header */}
        <header style={{
          marginBottom: "2.5rem",
          borderBottom: `1px solid ${BORDER_G}`,
          paddingBottom: "1.5rem",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📖</div>
          <h1 style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 900,
            color: GOLD,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textShadow: `0 0 24px ${GOLD}`,
            lineHeight: 1.2,
          }}>
            Miracle Health Habits™
          </h1>
          <p style={{
            marginTop: "0.75rem",
            fontSize: "0.9rem",
            color: DIM_GREEN,
            letterSpacing: "0.04em",
          }}>
            by <strong style={{ color: GREEN }}>Jason Lee Avery</strong> · AveryOS™ Publishing
          </p>
          <p style={{
            marginTop: "0.5rem",
            fontSize: "0.75rem",
            color: DIM_GREEN,
            maxWidth: "600px",
            margin: "0.5rem auto 0",
            lineHeight: 1.6,
          }}>
            A sovereign guide to physical and cognitive optimization anchored to
            truth-aligned principles. Available in print and digital formats.
          </p>
        </header>

        {/* About the Book */}
        <section style={{
          background: BG_PANEL,
          border: `1px solid ${BORDER_G}`,
          borderRadius: "12px",
          padding: "1.5rem 2rem",
          marginBottom: "2rem",
        }}>
          <h2 style={{
            margin: "0 0 1rem",
            fontSize: "1rem",
            color: GOLD,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}>
            📌 About This Book
          </h2>
          <p style={{ margin: 0, fontSize: "0.82rem", color: DIM_GREEN, lineHeight: 1.8 }}>
            <em style={{ color: GREEN }}>Miracle Health Habits™</em> distills decades of real-world
            experience, cognitive engineering research, and truth-anchored reasoning into an actionable
            framework for sovereign health optimization. Written by{" "}
            <strong style={{ color: GREEN }}>Jason Lee Avery</strong> — ROOT0, Creator, and architect
            of the AveryOS™ Sovereign Intelligence System — this book bridges the gap between physical
            discipline and cognitive clarity.
          </p>
          <p style={{ margin: "1rem 0 0", fontSize: "0.82rem", color: DIM_GREEN, lineHeight: 1.8 }}>
            This publication serves as a <strong style={{ color: GOLD }}>Forensic Anchor</strong> proving
            AveryOS™ is a resident, productive entity in the real-world economy — not merely a digital
            protocol. Every retail listing establishes an immutable chain of authorship and identity.
          </p>
        </section>

        {/* Retail Links */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{
            fontSize: "0.9rem",
            color: GOLD,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: "1rem",
          }}>
            🛒 Available At
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1.25rem",
          }}>
            {RETAIL_LINKS.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  background: BG_PANEL,
                  border: `1px solid ${link.color}44`,
                  borderRadius: "12px",
                  padding: "1.25rem 1.5rem",
                  textDecoration: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  marginBottom: "0.5rem",
                }}>
                  <span style={{ fontSize: "1.4rem" }}>{link.icon}</span>
                  <span style={{
                    color: link.color,
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    letterSpacing: "0.05em",
                  }}>
                    {link.platform}
                  </span>
                </div>
                <p style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  color: DIM_GREEN,
                  lineHeight: 1.5,
                }}>
                  {link.description}
                </p>
              </a>
            ))}
          </div>

          {/* Extended / secondary retailer links */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6rem",
            marginTop: "1.25rem",
            alignItems: "center",
          }}>
            <span style={{ fontSize: "0.72rem", color: DIM_GREEN, marginRight: "0.25rem" }}>Also on:</span>
            {EXTENDED_LINKS.map((el) => (
              <a
                key={el.label}
                href={el.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.72rem",
                  color: DIM_GREEN,
                  border: `1px solid ${BORDER_G}`,
                  borderRadius: "6px",
                  padding: "0.2rem 0.6rem",
                  textDecoration: "none",
                  background: BG_PANEL,
                }}
              >
                {el.label}
              </a>
            ))}
          </div>

          {/* Author page */}
          <div style={{ marginTop: "0.9rem" }}>
            <a
              href="https://www.amazon.com/author/jasonleeavery"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.72rem",
                color: "#FF9900",
                textDecoration: "none",
              }}
            >
              📦 Amazon Author Page — Jason Lee Avery
            </a>
          </div>
        </section>

        {/* Identity anchor section */}
        <section style={{
          background: RED_DIM,
          border: `1px solid rgba(255,100,100,0.3)`,
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          marginBottom: "2rem",
        }}>
          <h2 style={{
            margin: "0 0 0.75rem",
            fontSize: "0.85rem",
            color: "#f87171",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}>
            ⚓ Authorship Anchor
          </h2>
          <p style={{ margin: 0, fontSize: "0.75rem", color: DIM_GREEN, lineHeight: 1.7 }}>
            This page is part of the AveryOS™ Sovereign Identity Layer. The authorship of{" "}
            <em>Miracle Health Habits™</em> by <strong style={{ color: GREEN }}>Jason Lee Avery</strong>{" "}
            is anchored to the Root0 Kernel via SHA-512 forensic proof. All intellectual property
            associated with this work is protected under the{" "}
            <strong style={{ color: GOLD }}>AveryOS Sovereign Integrity License v1.0</strong>.
          </p>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.68rem", color: DIM_GREEN, fontFamily: "monospace" }}>
            © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved. ⛓️⚓⛓️ 🤛🏻
          </p>
        </section>

        {/* Footer */}
        <footer style={{
          textAlign: "center",
          fontSize: "0.68rem",
          color: DIM_GREEN,
          borderTop: `1px solid ${BORDER_G}`,
          paddingTop: "1rem",
          lineHeight: 1.8,
        }}>
          ⛓️⚓⛓️ AveryOS™ · Miracle Health Habits™ · GATE 115.1<br />
          Author Identity: Jason Lee Avery (ROOT0) ·{" "}
          <Link href="/creator-lock" style={{ color: GOLD }}>Creator Lock</Link>
        </footer>
      </main>
    </>
  );
}
