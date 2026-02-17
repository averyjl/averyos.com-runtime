import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../lib/markdown";

type PageProps = {
  content: string;
};

const AveryOSWhitepaperPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="AveryOS: A Decentralized Protocol for Sovereign Truth Anchoring"
      route="AveryOS_A_Decentralized_Protocol_for_Sovereign_Truth_Anchoring"
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

export default AveryOSWhitepaperPage;
