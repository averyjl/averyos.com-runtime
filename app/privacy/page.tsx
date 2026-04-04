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
import { privacyPolicyMd } from "../../lib/privacy-policy.js";
import { marked } from "marked";
import AnchorBanner from "../../components/AnchorBanner";
import { sanitizeHtml } from "../../lib/sanitizeHtml";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy • AveryOS",
  description: "AveryOS Privacy Policy - Cryptographically anchored to the AveryOS Encrypted Deterministic Kernel",
  openGraph: {
    title: "Privacy Policy • AveryOS",
    description: "AveryOS Privacy Policy - AveryAnchored™ cryptographic integrity for key legal docs",
    type: "website",
    url: "https://averyos.com/privacy",
  },
  alternates: { canonical: "https://averyos.com/privacy" },
};

export default function PrivacyPage() {
  const content = sanitizeHtml(marked(privacyPolicyMd) as string);

  return (
    <main className="page">
      <AnchorBanner />
      
      <article 
        className="truthforce-content"
        style={{
          background: 'rgba(9, 16, 34, 0.85)',
          border: '1px solid rgba(120, 148, 255, 0.25)',
          borderRadius: '16px',
          padding: '2.5rem',
          lineHeight: '1.7'
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </main>
  );
}
