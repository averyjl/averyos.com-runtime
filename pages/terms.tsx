import type { NextPage } from "next";
import Head from "next/head";
import Layout from "../layout/Layout";
import { getSiteUrl } from "../lib/siteConfig";
import { termsOfServiceMd } from "../lib/terms-of-service.js";
import { marked } from "marked";

const TermsPage: NextPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/terms`;
  const content = marked(termsOfServiceMd) as string;

  return (
    <Layout>
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
        <div style={{ 
          fontSize: "0.85rem", 
          color: "rgba(122, 170, 255, 0.9)", 
          marginBottom: "1rem",
          padding: "0.75rem",
          borderLeft: "3px solid rgba(120, 148, 255, 0.5)",
          background: "rgba(36, 58, 140, 0.15)",
          borderRadius: "4px"
        }}>
          ⛓️⚓ AveryAnchored™ | CreatorLock Protocol Active | 100.00♾️% Alignment
        </div>
        
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
    </Layout>
  );
};

export default TermsPage;
