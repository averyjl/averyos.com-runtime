import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const Truthforce2026PublicPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="Truthforce 2026 Public"
      route="auditlog/Truthforce2026_Public"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("auditlog/Truthforce2026_Public.md");
  return {
    props: { content },
  };
};

export default Truthforce2026PublicPage;
