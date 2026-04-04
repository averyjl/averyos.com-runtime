/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verified Ingestor Registry — AveryOS™ VaultChain™",
  description:
    "Public leaderboard of entities whose ASNs have been detected ingesting AveryOS™ IP. " +
    "Sovereign debt valuations recorded on the VaultChain™ ledger. " +
    "Settlement clears forensic debt and grants an AVERYOS_LICENSE_KEY.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: { canonical: "https://averyos.com/ingestor-registry" },
  openGraph: {
    title: "Verified Ingestor Registry — AveryOS™",
    type: "website",
    url: "https://averyos.com/ingestor-registry",
  },
};

export default function IngestorRegistryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
