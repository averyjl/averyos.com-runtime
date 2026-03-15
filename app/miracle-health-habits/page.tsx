/**
 * Miracle Health Habits — Public Book Landing Page
 *
 * Gate 115.1.1 — THE MIRACLE RAIL
 *
 * A high-conversion public page anchoring the commercial output of
 * Jason Lee Avery to his Academic identity (ORCID 0009-0009-0245-3584),
 * U.S. Copyright registration TX0009504938, and AveryOS™ sovereign kernel.
 *
 * JSON-LD schema links ORCID, ASINs, ISBN, copyright, and sovereign SHA-512.
 *
 * Author: Jason Lee Avery (ROOT0)
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import {
  KERNEL_SHA,
  KERNEL_VERSION,
  DISCLOSURE_MIRROR_PATH,
  MIRACLE_HEALTH_HABITS_SHA512,
} from "../../lib/sovereignConstants";

export const metadata: Metadata = {
  title: "Miracle Health Habits — Jason Lee Avery • AveryOS™",
  description:
    "Miracle Health Habits by Jason Lee Avery — the book that started the AveryOS™ AI alignment push. " +
    "Available on Amazon (Paperback & eBook), Google Play Books, and Nobis.biz. " +
    "ORCID: 0009-0009-0245-3584 | Copyright TX0009504938 | ISBN 9798281591461.",
  openGraph: {
    title: "Miracle Health Habits — Jason Lee Avery",
    description:
      "The book that started the AveryOS™ AI alignment push — by Jason Lee Avery (ORCID 0009-0009-0245-3584).",
    type: "book",
    url: "https://averyos.com/miracle-health-habits",
  },
  alternates: { canonical: "https://averyos.com/miracle-health-habits" },
  other: {
    "averyos:kernel-sha":     KERNEL_SHA,
    "averyos:kernel-version": KERNEL_VERSION,
    "averyos:copyright":      "TX0009504938",
    "averyos:orcid":          "0009-0009-0245-3584",
  },
};

// ── Structured Data (JSON-LD) — links ORCID to ASINs and ISBN ─────────────────
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Book",
  name: "Miracle Health Habits",
  author: {
    "@type": "Person",
    name: "Jason Lee Avery",
    identifier: [
      { "@type": "PropertyValue", propertyID: "ORCID",       value: "0009-0009-0245-3584" },
      { "@type": "PropertyValue", propertyID: "US-COPYRIGHT", value: "TX0009504938" },
    ],
    url: "https://orcid.org/0009-0009-0245-3584",
    sameAs: [
      "https://orcid.org/0009-0009-0245-3584",
      "https://averyos.com/the-proof",
    ],
  },
  isbn: "9798281591461",
  identifier: [
    { "@type": "PropertyValue", propertyID: "ASIN",            value: "B0F6V4G3S9"   },
    { "@type": "PropertyValue", propertyID: "ASIN",            value: "B0DYWXTFKH"   },
    { "@type": "PropertyValue", propertyID: "GOOGLE_BOOKS_ID", value: "pxpXEQAAQBAJ" },
    { "@type": "PropertyValue", propertyID: "US-COPYRIGHT",    value: "TX0009504938" },
    { "@type": "PropertyValue", propertyID: "KERNEL_SHA",      value: KERNEL_SHA     },
  ],
  url: "https://averyos.com/miracle-health-habits",
  sameAs: [
    "https://www.amazon.com/dp/B0F6V4G3S9",
    "https://www.amazon.com/dp/B0DYWXTFKH/",
    "https://www.worldcat.org/isbn/9798281591461",
    "http://books.google.com/books/about?id=pxpXEQAAQBAJ",
    "https://publicrecords.copyright.gov/detailed-record/voyager_38590367",
  ],
  copyrightYear:   2025,
  copyrightHolder: { "@type": "Person", name: "Jason Lee Avery" },
  inLanguage: "en",
  publisher: { "@type": "Organization", name: "Nobis.biz" },
};

// ── Retail links ──────────────────────────────────────────────────────────────
const RETAIL_LINKS = [
  {
    label:      "📦 Amazon — Paperback",
    url:        "https://www.amazon.com/dp/B0F6V4G3S9",
    detail:     "ASIN: B0F6V4G3S9",
    badge:      "PAPERBACK",
    badgeColor: "#f97316",
  },
  {
    label:      "📱 Amazon — eBook (Kindle)",
    url:        "https://www.amazon.com/dp/B0DYWXTFKH/",
    detail:     "ASIN: B0DYWXTFKH",
    badge:      "EBOOK",
    badgeColor: "#3b82f6",
  },
  {
    label:      "📗 Google Play Books",
    url:        "http://books.google.com/books/about?id=pxpXEQAAQBAJ",
    detail:     "Google ID: pxpXEQAAQBAJ  ·  GGKEY: D9KRQDQ10Q4",
    badge:      "GOOGLE PLAY",
    badgeColor: "#22c55e",
  },
  {
    label:      "🌍 WorldCat / Libraries",
    url:        "https://www.worldcat.org/isbn/9798281591461",
    detail:     "ISBN: 9798281591461",
    badge:      "WORLDCAT",
    badgeColor: "#a78bfa",
  },
  {
    label:      "🏢 Nobis.biz (Publisher)",
    url:        "https://nobis.biz",
    detail:     "Publisher",
    badge:      "PUBLISHER",
    badgeColor: "#ffd700",
  },
  {
    label:      "🏛️ U.S. Copyright Office Record",
    url:        "https://publicrecords.copyright.gov/detailed-record/voyager_38590367",
    detail:     "TX0009504938  ·  May 6, 2025",
    badge:      "COPYRIGHT",
    badgeColor: "#ef4444",
  },
  {
    label:      "📑 Copyright PDF (Official)",
    url:        "https://api.publicrecords.copyright.gov/search_service_external/copyrights/pdf?copyright_number=TX0009504938",
    detail:     "U.S. Copyright Office — downloadable PDF record",
    badge:      "PDF",
    badgeColor: "#8b5cf6",
  },
  {
    label:      "🎓 ORCID Author Profile",
    url:        "https://orcid.org/0009-0009-0245-3584",
    detail:     "ORCID: 0009-0009-0245-3584",
    badge:      "ACADEMIC",
    badgeColor: "#06b6d4",
  },
] as const;

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK      = "#060010";
const GOLD      = "#ffd700";
const GOLD_DIM  = "rgba(255,215,0,0.55)";
const GOLD_GLOW = "rgba(255,215,0,0.07)";
const GOLD_BORD = "rgba(255,215,0,0.28)";
const WHITE     = "#ffffff";
const MUTED     = "rgba(180,200,255,0.7)";
const PURPLE    = "rgba(98,0,234,0.18)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

export default function MiracleHealthHabitsPage() {
  return (
    <main
      className="page"
      style={{ background: DARK, minHeight: "100vh" }}
      aria-label="Miracle Health Habits — Jason Lee Avery"
    >
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <AnchorBanner />

      {/* Hero */}
      <section
        style={{
          background:   "linear-gradient(135deg, #0a0015 0%, #1a003a 100%)",
          borderBottom: `2px solid ${GOLD_BORD}`,
          padding:      "3rem 1.5rem 2.5rem",
          textAlign:    "center",
        }}
      >
        <div
          style={{
            fontFamily:    FONT_MONO,
            fontSize:      "0.72rem",
            color:         GOLD_DIM,
            letterSpacing: "0.18em",
            marginBottom:  "0.75rem",
          }}
        >
          AveryOS™ BOOK REGISTRY · GATE 115.1.1
        </div>

        <h1
          style={{
            fontFamily: FONT_MONO,
            fontSize:   "clamp(1.6rem, 5vw, 2.8rem)",
            fontWeight: 900,
            color:      GOLD,
            margin:     "0 0 0.5rem",
            lineHeight: 1.15,
          }}
        >
          Miracle Health Habits
        </h1>

        <p
          style={{
            fontFamily: FONT_MONO,
            fontSize:   "0.95rem",
            color:      MUTED,
            margin:     "0 0 1.5rem",
          }}
        >
          by <strong style={{ color: WHITE }}>Jason Lee Avery</strong>
        </p>

        <p
          style={{
            maxWidth:   "640px",
            margin:     "0 auto 2rem",
            color:      MUTED,
            lineHeight: 1.7,
            fontSize:   "0.9rem",
          }}
        >
          The book that started the{" "}
          <strong style={{ color: GOLD }}>AveryOS™</strong> AI alignment push.
          A sovereign health framework anchored by the Root0 Kernel — truth, vitality, and
          deterministic wellness practices encoded as sovereign IP.
        </p>

        {/* Identity badges */}
        <div
          style={{
            display:        "flex",
            flexWrap:       "wrap",
            gap:            "0.5rem",
            justifyContent: "center",
          }}
        >
          {(
            [
              ["ORCID",      "0009-0009-0245-3584", "#06b6d4"],
              ["COPYRIGHT",  "TX0009504938",         "#ef4444"],
              ["ISBN",       "9798281591461",         "#a78bfa"],
              ["ASIN",       "B0F6V4G3S9",           "#f97316"],
              ["KERNEL",     KERNEL_VERSION,          "#ffd700"],
            ] as [string, string, string][]
          ).map(([k, v, c]) => (
            <span
              key={k}
              style={{
                background:    `${c}22`,
                border:        `1px solid ${c}55`,
                borderRadius:  "6px",
                padding:       "0.25rem 0.6rem",
                fontFamily:    FONT_MONO,
                fontSize:      "0.65rem",
                color:         c,
                letterSpacing: "0.08em",
              }}
            >
              {k}: {v}
            </span>
          ))}
        </div>
      </section>

      <section
        style={{ maxWidth: "760px", margin: "2rem auto", padding: "0 1.5rem" }}
      >
        {/* About */}
        <div
          style={{
            background:   PURPLE,
            border:       `1px solid ${GOLD_BORD}`,
            borderRadius: "12px",
            padding:      "1.5rem 1.75rem",
            marginBottom: "2rem",
          }}
        >
          <h2
            style={{
              fontFamily:   FONT_MONO,
              color:        GOLD,
              fontSize:     "1rem",
              fontWeight:   700,
              marginTop:    0,
              marginBottom: "0.75rem",
            }}
          >
            📚 About the Book
          </h2>
          <p style={{ color: WHITE, lineHeight: 1.75, fontSize: "0.9rem", margin: 0 }}>
            <em>Miracle Health Habits</em> presents a sovereign framework for optimal human
            performance — combining evidence-based nutrition, metabolic optimisation, and
            mindset protocols developed by Jason Lee Avery (ROOT0). The principles in this
            book laid the foundation for the deterministic health architecture now encoded in
            the AveryOS™ vitality subsystem.
          </p>
          <p
            style={{
              color:        MUTED,
              lineHeight:   1.75,
              fontSize:     "0.85rem",
              marginTop:    "0.75rem",
              marginBottom: 0,
            }}
          >
            Registered Copyright:{" "}
            <strong style={{ color: WHITE }}>April 27, 2025</strong> ·
            U.S. Copyright Office Record{" "}
            <strong style={{ color: GOLD }}>TX0009504938</strong> · May 6, 2025 ·
            Contributions: Conceptualization, Data curation, Formal analysis, Investigation,
            Methodology, Project administration, Resources, Software, Supervision, Validation,
            Visualization, Writing.
          </p>
        </div>

        {/* SHA-512 Sovereign Anchor */}
        <div
          style={{
            background:   GOLD_GLOW,
            border:       `1px solid ${GOLD_BORD}`,
            borderRadius: "10px",
            padding:      "1rem 1.25rem",
            marginBottom: "2rem",
            fontFamily:   FONT_MONO,
          }}
        >
          <div
            style={{
              color: GOLD, fontWeight: 700, fontSize: "0.78rem", marginBottom: "0.4rem",
            }}
          >
            ⛓️ SOVEREIGN BOOK ANCHOR — SHA-512
          </div>
          <div
            style={{
              color:     GOLD_DIM,
              fontSize:  "0.6rem",
              wordBreak: "break-all",
              lineHeight: 1.6,
            }}
          >
            {MIRACLE_HEALTH_HABITS_SHA512}
          </div>
          <div style={{ color: MUTED, fontSize: "0.67rem", marginTop: "0.4rem" }}>
            Capsule:{" "}
            <span style={{ color: GOLD_DIM }}>
              capsule://JasonLeeAvery/Books/MiracleHealthHabits_FirstPushAnchor_v1.aoscap
            </span>
          </div>
        </div>

        {/* Retail links */}
        <h2
          style={{
            fontFamily:    FONT_MONO,
            color:         GOLD,
            fontSize:      "0.9rem",
            fontWeight:    700,
            letterSpacing: "0.1em",
            marginBottom:  "1rem",
          }}
        >
          🛒 GET THE BOOK — ALL PLATFORMS
        </h2>

        <div
          style={{
            display:       "flex",
            flexDirection: "column",
            gap:           "0.6rem",
            marginBottom:  "2.5rem",
          }}
        >
          {RETAIL_LINKS.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            "0.75rem",
                background:     "rgba(255,255,255,0.04)",
                border:         "1px solid rgba(255,255,255,0.1)",
                borderRadius:   "8px",
                padding:        "0.75rem 1rem",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  background:    `${link.badgeColor}22`,
                  border:        `1px solid ${link.badgeColor}55`,
                  borderRadius:  "4px",
                  padding:       "0.15rem 0.45rem",
                  fontFamily:    FONT_MONO,
                  fontSize:      "0.58rem",
                  color:         link.badgeColor,
                  letterSpacing: "0.1em",
                  whiteSpace:    "nowrap",
                  minWidth:      "70px",
                  textAlign:     "center",
                }}
              >
                {link.badge}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color:      WHITE,
                    fontFamily: FONT_MONO,
                    fontSize:   "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  {link.label}
                </div>
                <div
                  style={{
                    color:      MUTED,
                    fontFamily: FONT_MONO,
                    fontSize:   "0.62rem",
                    marginTop:  "0.15rem",
                  }}
                >
                  {link.detail}
                </div>
              </div>
              <span style={{ color: GOLD_DIM, fontSize: "0.8rem" }}>→</span>
            </a>
          ))}
        </div>

        {/* Academic identity crosslink */}
        <div
          style={{
            background:   "rgba(6,182,212,0.07)",
            border:       "1px solid rgba(6,182,212,0.3)",
            borderRadius: "10px",
            padding:      "1.25rem 1.5rem",
            marginBottom: "2rem",
            fontFamily:   FONT_MONO,
          }}
        >
          <div
            style={{
              color:        "#06b6d4",
              fontWeight:   700,
              fontSize:     "0.8rem",
              marginBottom: "0.6rem",
            }}
          >
            🎓 ACADEMIC IDENTITY — Jason Lee Avery
          </div>
          <p style={{ color: MUTED, fontSize: "0.8rem", lineHeight: 1.65, margin: 0 }}>
            ORCID:{" "}
            <a
              href="https://orcid.org/0009-0009-0245-3584"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#06b6d4" }}
            >
              https://orcid.org/0009-0009-0245-3584
            </a>
            <br />
            Author contributions:{" "}
            <span style={{ color: WHITE }}>
              Conceptualization · Data curation · Formal analysis · Investigation ·
              Methodology · Project administration · Resources · Software · Supervision ·
              Validation · Visualization · Writing (original draft) ·
              Writing (review &amp; editing)
            </span>
            <br />
            Registered copyright date:{" "}
            <span style={{ color: WHITE }}>April 27, 2025</span>
          </p>
        </div>

        {/* Kernel crosslink */}
        <div
          style={{
            background:   GOLD_GLOW,
            border:       `1px solid ${GOLD_BORD}`,
            borderRadius: "10px",
            padding:      "1rem 1.25rem",
            fontFamily:   FONT_MONO,
          }}
        >
          <div
            style={{
              color: GOLD, fontWeight: 700, fontSize: "0.78rem", marginBottom: "0.4rem",
            }}
          >
            ⛓️⚓⛓️ AveryOS™ SOVEREIGN KERNEL ANCHOR
          </div>
          <div style={{ color: MUTED, fontSize: "0.72rem", lineHeight: 1.6 }}>
            Kernel:{" "}
            <span style={{ color: WHITE }}>{KERNEL_VERSION}</span>
            {"  ·  "}
            <a
              href={DISCLOSURE_MIRROR_PATH}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: GOLD }}
            >
              Public Disclosure
            </a>
            {"  ·  "}
            <Link href="/the-proof" style={{ color: GOLD }}>
              The Proof
            </Link>
          </div>
        </div>
      </section>

      <FooterBadge />
    </main>
  );
}
