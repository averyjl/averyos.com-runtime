import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const TruthdeckUiPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="Truthdeck Ui"
      route="viewer/truthdeck-ui"
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

export default TruthdeckUiPage;
