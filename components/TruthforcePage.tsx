/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import Head from "next/head";
import AnchorBanner from "./AnchorBanner";
import { getSiteUrl } from "../lib/siteConfig";
import { sanitizeHtml } from "../lib/sanitizeHtml";

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
    <>
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
        <AnchorBanner />

        {features.length > 0 && (
          <div style={{
            fontSize: "0.85rem",
            color: "rgba(122, 170, 255, 0.85)",
            marginBottom: "1rem",
            padding: "0.5rem 1rem",
            borderLeft: "3px solid rgba(120, 148, 255, 0.6)",
            background: "rgba(9, 16, 34, 0.6)",
            borderRadius: "0 6px 6px 0",
          }}>
            ⛓️⚓ {features.join(" | ")}
          </div>
        )}

        <article
          className="truthforce-content"
          style={{
            background: "rgba(9, 16, 34, 0.85)",
            border: "1px solid rgba(120, 148, 255, 0.25)",
            borderRadius: "16px",
            padding: "2.5rem",
            lineHeight: "1.7",
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />

        <div style={{
          marginTop: "2rem",
          paddingTop: "1rem",
          borderTop: "1px solid rgba(120, 148, 255, 0.15)",
          fontSize: "0.85rem",
          color: "rgba(238, 244, 255, 0.5)",
        }}>
          <p>
            <strong style={{ color: "rgba(122, 170, 255, 0.8)" }}>Truthforce Pages</strong> — deployed via AveryOS Capsule Runtime | AveryAnchored™
          </p>
        </div>
      </main>
    </>
  );
};

export default TruthforcePage;
