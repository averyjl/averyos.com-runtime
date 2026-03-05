import type { Metadata } from "next";
import { privacyPolicyMd } from "../../lib/privacy-policy.js";
import { marked } from "marked";
import AnchorBanner from "../../components/AnchorBanner";
import { sanitizeHtml } from "../../lib/sanitizeHtml";

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
