import type { NextPage } from "next";
import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";
import { privacyPolicyMd } from "../lib/privacy-policy.js";
import { marked } from "marked";
import AnchorBanner from "../components/AnchorBanner";

const PrivacyPage: NextPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/privacy`;
  const content = marked(privacyPolicyMd) as string;

  return (
    <>
      <Head>
        <title>Privacy Policy • AveryOS</title>
        <meta name="description" content="AveryOS Privacy Policy - Cryptographically anchored to the AveryOS Encrypted Deterministic Kernel" />
        <meta property="og:title" content="Privacy Policy • AveryOS" />
        <meta property="og:description" content="AveryOS Privacy Policy - AveryAnchored™ cryptographic integrity for key legal docs" />
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

export default PrivacyPage;
