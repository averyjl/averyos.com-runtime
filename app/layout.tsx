import type { Metadata } from "next";
import type { ReactNode } from "react";
import NavBar from "../components/NavBar";
import Drawer from "../components/Drawer";
import FooterBadge from "../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "AveryOS™ — Sovereign Runtime",
    template: "%s • AveryOS™",
  },
  description:
    "AveryOS™ is a Sovereign Operating Framework authored by Jason Lee Avery. " +
    "Truth-Locked capsule execution, creator-owned licensing, and zero-drift runtime enforcement. " +
    `Root0 Kernel ${KERNEL_VERSION} | SHA-512 Anchor: ${KERNEL_SHA}`,
  metadataBase: new URL("https://averyos.com"),
  openGraph: {
    type: "website",
    siteName: "AveryOS™",
    title: "AveryOS™ — Sovereign Runtime",
    description:
      "AveryOS™ Sovereign Operating Framework — Truth-Locked capsule execution. " +
      `Root0 Kernel ${KERNEL_VERSION} | SHA-512: ${KERNEL_SHA}`,
    url: "https://averyos.com",
  },
  twitter: {
    card: "summary",
    title: "AveryOS™ — Sovereign Runtime",
    description:
      `AveryOS™ Root0 Kernel ${KERNEL_VERSION} | SHA-512 Anchor: ${KERNEL_SHA}`,
  },
  other: {
    "averyos:kernel-sha": KERNEL_SHA,
    "averyos:kernel-version": KERNEL_VERSION,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
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
