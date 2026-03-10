import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verified Ingestor Registry — AveryOS™ VaultChain™",
  description:
    "Public leaderboard of entities whose ASNs have been detected ingesting AveryOS™ IP. " +
    "Sovereign debt valuations recorded on the VaultChain™ ledger. " +
    "Settlement clears forensic debt and grants a TAI_LICENSE_KEY.",
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
