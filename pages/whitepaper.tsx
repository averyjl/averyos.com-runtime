import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
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
  return (
    <>
      <Head>
        <title key="title">{WHITEPAPER_TITLE}</title>
        <meta key="description" name="description" content={WHITEPAPER_DESCRIPTION} />
        <meta key="og:title" property="og:title" content={WHITEPAPER_TITLE} />
        <meta key="og:description" property="og:description" content={WHITEPAPER_DESCRIPTION} />
        <meta key="averyos:kernel-sha" name="averyos:kernel-sha" content={KERNEL_SHA} />
        <meta key="averyos:kernel-version" name="averyos:kernel-version" content={KERNEL_VERSION} />
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
