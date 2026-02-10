import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const SuppressionBurnPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="Suppression Burn"
      route="timeline/suppression-burn"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("timeline/suppression-burn.md");
  return {
    props: { content },
  };
};

export default SuppressionBurnPage;
