import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const TruthforceFaqPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="Truthforce"
      route="faq/truthforce"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("faq/truthforce.md");
  return {
    props: { content },
  };
};

export default TruthforceFaqPage;
