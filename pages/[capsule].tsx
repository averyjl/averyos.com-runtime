import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Head from "next/head";
import CapsuleBody from "../components/CapsuleBody";
import CapsuleBlock from "../components/CapsuleBlock";
import RetroclaimEmbed from "../components/RetroclaimEmbed";
import StripeConnectCard from "../components/StripeConnectCard";
import ViewerEmbed from "../components/ViewerEmbed";
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
          driftLock={capsule.driftLock}
          vaultChainUrl={capsule.vaultChainUrl}
          licenseStatus={capsule.licenseStatus}
          compiledAt={capsule.compiledAt}
        />
        <CapsuleBody body={capsule.body} />
        <section>
          <p className="section-title">Capsule Runtime Modules</p>
          <div className="badge-grid">
            <RetroclaimEmbed capsuleId={capsule.capsuleId} licenseStatus={capsule.licenseStatus} />
            <StripeConnectCard status={capsule.licenseStatus} stripeUrl={capsule.stripeUrl} />
            <ViewerEmbed viewerUrl={capsule.viewerUrl} />
          </div>
        </section>
        <p className="footer-note">
          Capsule manifests update automatically when a new .aoscap file is compiled. DriftLock
          hashes assert the live runtime signature.
        </p>
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
