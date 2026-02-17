import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const ResonanceLogPage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="Resonance Log"
      route="capsule/resonance-log"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("capsule/resonance-log.md");
  return {
    props: { content },
  };
};

export default ResonanceLogPage;
