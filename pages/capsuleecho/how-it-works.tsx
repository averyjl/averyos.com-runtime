import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const HowItWorksPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="How It Works"
      route="capsuleecho/how-it-works"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("capsuleecho/how-it-works.md");
  return {
    props: { content },
  };
};

export default HowItWorksPage;
