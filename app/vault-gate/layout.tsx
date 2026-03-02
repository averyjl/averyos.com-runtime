import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "🔒 VAULT GATE — Secure Hidden Page • AveryOS™",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  openGraph: {
    title: "🔒 VAULT GATE • AveryOS™",
    type: "website",
    url: "https://averyos.com/vault-gate",
  },
};

export default function VaultGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
