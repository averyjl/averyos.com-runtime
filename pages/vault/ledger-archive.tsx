import type { GetStaticProps, NextPage } from "next";
import TruthforcePage from "../../components/TruthforcePage";
import { loadMarkdownAsHtml } from "../../lib/markdown";

type PageProps = {
  content: string;
};

const LedgerArchivePage: NextPage<PageProps> = ({ content }) => {
  return (
    <TruthforcePage
      title="Ledger Archive"
      route="vault/ledger-archive"
      content={content}
      enableCapsuleEcho={true}
      injectGlyph={true}
      enforcePerspectiveLock={true}
    />
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const content = loadMarkdownAsHtml("vault/ledger-archive.md");
  return {
    props: { content },
  };
};

export default LedgerArchivePage;
