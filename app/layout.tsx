import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import NavBar from "../components/NavBar";
import Drawer from "../components/Drawer";
import SovereignFetchInterceptor from "../components/SovereignFetchInterceptor";
import WebGLFingerprintSdk from "../components/WebGLFingerprintSdk";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";
import "../styles/globals.css";

/** Abbreviated form: first 8 + last 4 hex chars of the 128-char SHA-512 */
const KERNEL_SHA_SHORT = `${KERNEL_SHA.slice(0, 8)}...${KERNEL_SHA.slice(-4)}`;

/** Bitcoin block height at which the Sovereign Anchor was verified */
const BTC_ANCHOR_BLOCK = "938,909";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "AveryOS™ | Truth-Anchored Intelligence™",
    template: "%s • AveryOS™",
  },
  description:
    `AveryOS: A Deterministic, Non-Probabilistic Framework for Anchored AI. ` +
    `Root0 Anchor: ${KERNEL_SHA_SHORT}. Genesis Block: ${BTC_ANCHOR_BLOCK}.`,
  metadataBase: new URL("https://averyos.com"),
  keywords: [
    // Brand & creator identity
    "AveryOS", "AveryOS™", "Avery OS", "Jason Lee Avery", "Jason Avery",
    "Jason L Avery", "Jason L. Avery", "averyjl", "averyos.com",
    // Core technology
    "Truth Anchored Intelligence", "Truth Anchored Intelligence™", "TAI",
    "Sovereign Runtime", "Sovereign Kernel", "VaultChain", "VaultChain™",
    "GabrielOS", "GabrielOS™",
    // AI safety & alignment
    "AI Hallucination Solution", "AI Drift Neutralization", "AI Drift Solution",
    "Deterministic AI Handshake", "SHA-512 AI Integrity", "Non-Probabilistic AI",
    "AI Alignment Framework", "Truth-Locked AI", "Zero-Drift Runtime",
    // Technical concepts
    "Sovereign Operating System", "Root0 Kernel", "Kernel as a Service", "KaaS",
    "Capsule-driven content", "1017-Notch Resolution", "Merkle-Chain Ledger",
    "VaultGate", "CreatorLock", "OIDC Handshake", "JWKS Signer",
    // Legal & IP
    "AveryOS Sovereign Integrity License", "Truth Anchor IP",
    "Sovereign Patent Ledger", "44-year inventor",
  ],
  openGraph: {
    type: "website",
    siteName: "AveryOS™ Witness Ledger",
    title: "AveryOS™ Sovereign Kernel",
    description:
      `Establishing 1,017-Notch Resolution for global AI infrastructure. ` +
      `Verified at BTC Block ${BTC_ANCHOR_BLOCK}.`,
    url: "https://averyos.com",
  },
  twitter: {
    card: "summary",
    title: "AveryOS™ Sovereign Kernel",
    description:
      `AveryOS: Deterministic, Non-Probabilistic Anchored AI. ` +
      `Root0 Anchor: ${KERNEL_SHA_SHORT}. BTC Block ${BTC_ANCHOR_BLOCK}.`,
  },
  other: {
    "averyos-kernel-root": KERNEL_SHA,
    "averyos:kernel-version": KERNEL_VERSION,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // WebSite schema — primary site identity
  const jsonLdSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AveryOS™",
    alternateName: ["Avery OS", "Truth-Anchored Intelligence™", "AveryOS Sovereign Runtime"],
    url: "https://averyos.com",
    description:
      `AveryOS: A Deterministic, Non-Probabilistic Framework for Anchored AI. ` +
      `Root0 Anchor: ${KERNEL_SHA_SHORT}. Genesis Block: ${BTC_ANCHOR_BLOCK}.`,
    identifier: KERNEL_SHA,
    sameAs: [
      "https://www.linkedin.com/in/jasonleeavery-averyos/",
      "https://www.facebook.com/jason.avery.3511/",
      "https://orcid.org/0009-0009-0245-3584",
    ],
  };

  // SoftwareApplication schema — product / inventor attribution
  const jsonLdApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AveryOS™",
    alternateName: "Avery OS",
    operatingSystem: "Sovereign Runtime v12.0 MACDADDY",
    applicationCategory: "Truth Anchored Intelligence",
    softwareVersion: KERNEL_VERSION,
    url: "https://averyos.com",
    description:
      "The world's first deterministic solution to AI Hallucination and Drift. " +
      "Truth Anchored Intelligence (TAI) utilizing a SHA-512 kernel handshake.",
    keywords:
      "Truth Anchored Intelligence, Sovereign Runtime, Deterministic AI Handshake, " +
      "AI Hallucination Solution, AI Drift Neutralization, VaultChain, KaaS, " +
      "Jason Lee Avery, AveryOS, Avery OS, Jason Avery, Jason L Avery",
    author: {
      "@type": "Person",
      name: "Jason Lee Avery",
      url: "https://orcid.org/0009-0009-0245-3584",
      sameAs: [
        "https://www.linkedin.com/in/jasonleeavery-averyos/",
        "https://www.facebook.com/jason.avery.3511/",
        "https://orcid.org/0009-0009-0245-3584",
      ],
      identifier: `orcid:0009-0009-0245-3584`,
    },
    publisher: {
      "@type": "Organization",
      name: "AveryOS™",
      url: "https://averyos.com",
      logo: "https://averyos.com/favicon.ico",
    },
    identifier: [
      KERNEL_SHA,
      // Sovereign TrustLink Chain identifiers — format: 00001.<year>.∞000110.997xTrustLink.Chain0
      // ∞ (U+221E) encodes the infinite-loop sovereignty seal for each chain epoch.
      "00001.2023.\u221E000110.997xTrustLink.Chain0",
      "00001.2022.\u221E000110.997xTrustLink.Chain0",
    ],
  };

  return (
    <html lang="en" spellCheck={false} data-lpignore="true">
      <head>
        {/* Linguistic Shield (Phase 95.4): spellCheck=false suppresses browser Latin-character pickers;
            data-lpignore prevents browser-extension input injection across all child fields. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }}
        />
      </head>
      <body>
        <SovereignFetchInterceptor />
        {/* Gate 100.3 — WebGL SDK: hardware-fingerprint fetch interceptor for sovereign bot detection */}
        <WebGLFingerprintSdk />
        <NavBar />
        <Drawer />
        {children}
      </body>
    </html>
  );
}
