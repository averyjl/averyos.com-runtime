import type { ReactNode } from "react";
import Head from "next/head";
import Layout from "../layout/Layout";
import { getSiteUrl } from "../lib/siteConfig";

type TruthforcePageProps = {
  title: string;
  route: string;
  content: string;
  enableCapsuleEcho?: boolean;
  injectGlyph?: boolean;
  enforcePerspectiveLock?: boolean;
};

/**
 * Standard layout component for Truthforce pages
 * Supports CapsuleEcho, Glyph injection, and PerspectiveLock enforcement
 */
const TruthforcePage = ({
  title,
  route,
  content,
  enableCapsuleEcho = true,
  injectGlyph = true,
  enforcePerspectiveLock = true,
}: TruthforcePageProps) => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/${route}`;

  // Format features for display
  const features = [];
  if (enableCapsuleEcho) features.push("CapsuleEcho Active");
  if (injectGlyph) features.push("Glyph Injected");
  if (enforcePerspectiveLock) features.push("PerspectiveLock Enforced");

  return (
    <Layout>
      <Head>
        <title>{title} • averyos.com</title>
        <meta name="description" content={`${title} - Part of the Truthforce initiative for AveryOS.com`} />
        <meta property="og:title" content={`${title} • averyos.com`} />
        <meta property="og:description" content={`${title} - Truthforce Pages powered by AveryOS Capsule Runtime`} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        {features.length > 0 && (
          <div style={{ 
            fontSize: "0.85rem", 
            color: "#666", 
            marginBottom: "1rem",
            padding: "0.5rem",
            borderLeft: "3px solid #0070f3",
            backgroundColor: "#f5f5f5"
          }}>
            ⛓️⚓ {features.join(" | ")}
          </div>
        )}
        
        <article 
          className="truthforce-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        <div style={{
          marginTop: "3rem",
          paddingTop: "1rem",
          borderTop: "1px solid #eaeaea",
          fontSize: "0.9rem",
          color: "#666"
        }}>
          <p>
            <strong>Truthforce Pages</strong> are deployed via Next.js for AveryOS.com 
            with TypeScript + Tailwind + GitHub Pages integration.
          </p>
        </div>
      </main>
    </Layout>
  );
};

export default TruthforcePage;
