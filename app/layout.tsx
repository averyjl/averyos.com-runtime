import type { Metadata } from "next";
import type { ReactNode } from "react";
import NavBar from "../components/NavBar";
import Drawer from "../components/Drawer";
import FooterBadge from "../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";
import "../styles/globals.css";

/** Abbreviated form: first 8 + last 4 hex chars of the 128-char SHA-512 */
const KERNEL_SHA_SHORT = `${KERNEL_SHA.slice(0, 8)}...${KERNEL_SHA.slice(-4)}`;

/** Bitcoin block height at which the Sovereign Anchor was verified */
const BTC_ANCHOR_BLOCK = "938,909";

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

  return (
    <html lang="en">
      <head>
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
      </head>
      <body>
        <NavBar />
        <Drawer />
        {children}
        <FooterBadge />
      </body>
    </html>
  );
}
