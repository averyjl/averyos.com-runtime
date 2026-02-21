import type { NextPage } from "next";
import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";
import { termsOfServiceMd } from "../lib/terms-of-service.js";
import { marked } from "marked";
import AnchorBanner from "../components/AnchorBanner";
import { sanitizeHtml } from "../lib/sanitizeHtml";

const TermsPage: NextPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/terms`;
  const content = sanitizeHtml(marked(termsOfServiceMd) as string);

  return (
    <>
      <Head>
        <title>Terms of Service • AveryOS</title>
        <meta name="description" content="AveryOS Terms of Service - Cryptographically anchored to the AveryOS Encrypted Deterministic Kernel" />
        <meta property="og:title" content="Terms of Service • AveryOS" />
        <meta property="og:description" content="AveryOS Terms of Service - AveryAnchored™ cryptographic integrity for key legal docs" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

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
    </>
  );
};

export default TermsPage;
