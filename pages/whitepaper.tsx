import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../lib/markdown";

type PageProps = {
  content: string;
};

const WhitepaperPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="AveryOS Technical Whitepaper"
      route="whitepaper"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("whitepaper.md");
  return {
    props: { content },
  };
};

export default WhitepaperPage;
