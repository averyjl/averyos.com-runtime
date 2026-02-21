import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const ViewerIndexPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="Truthdeck UI"
      route="viewer"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("viewer/truthdeck-ui.md");
  return {
    props: { content },
  };
};

export default ViewerIndexPage;
