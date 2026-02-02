import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Head from "next/head";
import CapsuleBlock from "../components/CapsuleBlock";
import { CapsuleManifest, listCapsuleIds, loadCapsuleManifest } from "../lib/capsuleManifest";

type CapsulePageProps = {
  capsule: CapsuleManifest;
};

const CapsulePage: NextPage<CapsulePageProps> = ({ capsule }) => {
  return (
    <>
      <Head>
        <title>{capsule.title} • averyos.com</title>
      </Head>
      <main className="page">
        <CapsuleBlock
          capsuleId={capsule.capsuleId}
          title={capsule.title}
          summary={capsule.summary}
          sha={capsule.sha}
          vaultChainUrl={capsule.vaultChainUrl}
        />
      </main>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const ids = listCapsuleIds();
  return {
    paths: ids.map((capsule) => ({ params: { capsule } })),
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<CapsulePageProps> = async (context) => {
  const capsuleId = context.params?.capsule as string | undefined;
  if (!capsuleId) {
    return { notFound: true };
  }
  const capsule = loadCapsuleManifest(capsuleId);
  if (!capsule) {
    return { notFound: true };
  }
  return {
    props: { capsule },
    revalidate: 60,
  };
};

export default CapsulePage;
