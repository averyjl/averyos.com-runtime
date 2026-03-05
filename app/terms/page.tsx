import type { Metadata } from "next";
import { termsOfServiceMd } from "../../lib/terms-of-service.js";
import { marked } from "marked";
import AnchorBanner from "../../components/AnchorBanner";
import { sanitizeHtml } from "../../lib/sanitizeHtml";

export const metadata: Metadata = {
  title: "Terms of Service • AveryOS",
  description: "AveryOS Terms of Service - Cryptographically anchored to the AveryOS Encrypted Deterministic Kernel",
  openGraph: {
    title: "Terms of Service • AveryOS",
    description: "AveryOS Terms of Service - AveryAnchored™ cryptographic integrity for key legal docs",
    type: "website",
    url: "https://averyos.com/terms",
  },
  alternates: { canonical: "https://averyos.com/terms" },
};

export default function TermsPage() {
  const content = sanitizeHtml(marked(termsOfServiceMd) as string);

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
