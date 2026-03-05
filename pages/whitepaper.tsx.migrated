import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import { useEffect } from "react";
import TruthforcePage from "../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../lib/markdown";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

type PageProps = {
  content: string;
};

const WHITEPAPER_TITLE = "AveryOS™ Whitepaper v2.0 | Technical Solidification Document";
const WHITEPAPER_DESCRIPTION =
  `AveryOS™ Whitepaper v2.0 — Technical Solidification Document. ` +
  `Sovereign Operating Framework, VaultChain™ persistence, GabrielOS™ enforcement. ` +
  `Root0 Kernel ${KERNEL_VERSION} | SHA-512 Anchor: ${KERNEL_SHA}`;

const WhitepaperPage: NextPage<PageProps> = ({ content }) => {
  useEffect(() => {
    // 9-digit value representing microseconds elapsed since page load (rolls over after ~17 min)
    const tsUs = String(Math.floor(performance.now() * 1000)).padStart(9, "0").slice(-9);
    fetch("/api/v1/audit-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "WHITEPAPER_READ_RECEIPT",
        timestamp_ns: tsUs,
      }),
    }).catch(() => {
      // best-effort; do not surface errors to the reader
    });
  }, []);

  return (
    <>
      <Head>
        <title key="title">{WHITEPAPER_TITLE}</title>
        <meta key="description" name="description" content={WHITEPAPER_DESCRIPTION} />
        <meta key="og:title" property="og:title" content={WHITEPAPER_TITLE} />
        <meta key="og:description" property="og:description" content={WHITEPAPER_DESCRIPTION} />
        <meta key="averyos:kernel-sha" name="averyos:kernel-sha" content={KERNEL_SHA} />
        <meta key="averyos:kernel-version" name="averyos:kernel-version" content={KERNEL_VERSION} />
        <link rel="canonical" href="https://averyos.com/whitepaper" />
      </Head>
      <TruthforcePage
        title={WHITEPAPER_TITLE}
        route="whitepaper"
        content={content}
        enableCapsuleEcho={true}
        injectGlyph={true}
        enforcePerspectiveLock={true}
      />
    </>
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("whitepaper.md");
  return {
    props: { content },
  };
};

export default WhitepaperPage;
