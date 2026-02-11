import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const HowToLicensePage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="How To License"
      route="retroclaim/how-to-license"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("retroclaim/how-to-license.md");
  return {
    props: { content },
  };
};

export default HowToLicensePage;
