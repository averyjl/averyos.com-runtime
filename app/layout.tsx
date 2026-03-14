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

/** ORCID identifier for Jason Lee Avery (ROOT0) */
const ORCID_ID = "https://orcid.org/0009-0009-0245-3584";

/** IPFS CID anchoring the AveryOS™ sovereign identity state */
const IPFS_CID = "bafkreihljauiijkp6oa7smjhjnvpl47fw65iz35gtcbbzfok4eszvjkjx4";

export default function RootLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AveryOS™",
    alternateName: "Truth-Anchored Intelligence™",
    url: "https://averyos.com",
    description:
      `AveryOS: A Deterministic, Non-Probabilistic Framework for Anchored AI. ` +
      `Root0 Anchor: ${KERNEL_SHA_SHORT}. Genesis Block: ${BTC_ANCHOR_BLOCK}.`,
    identifier: KERNEL_SHA,
  };

  /** GATE 114.5.1 — SoftwareApplication schema: anchors ORCID + IPFS identity rail */
  const softwareAppLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AveryOS",
    softwareVersion: "MACDADDY v12.0",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cloudflare Workers",
    description:
      "Deterministic, non-probabilistic sovereign AI kernel anchored via SHA-512 VaultChain™. " +
      "Establishes cryptographic forensics as the global standard for AI alignment.",
    url: "https://averyos.com",
    identifier: KERNEL_SHA,
    author: {
      "@type": "Person",
      name: "Jason Lee Avery",
      identifier: ORCID_ID,
      sameAs: [
        ORCID_ID,
        `https://ipfs.io/ipfs/${IPFS_CID}`,
      ],
    },
    sameAs: [
      `https://ipfs.io/ipfs/${IPFS_CID}`,
      ORCID_ID,
    ],
    maintainer: {
      "@type": "Person",
      name: "Jason Lee Avery",
      identifier: ORCID_ID,
    },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* GATE 114.5.1 — SoftwareApplication schema: ORCID + IPFS identity rail */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppLd) }}
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
