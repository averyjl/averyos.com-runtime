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
