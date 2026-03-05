import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../lib/markdown";

type PageProps = {
  content: string;
};

const CreatorLockPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="Creator Lock"
      route="creator-lock"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("creator-lock.md");
  return {
    props: { content },
  };
};

export default CreatorLockPage;
