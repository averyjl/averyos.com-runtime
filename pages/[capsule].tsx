import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Head from "next/head";
import CapsuleBody from "../components/CapsuleBody";
import CapsuleBlock from "../components/CapsuleBlock";
import RetroclaimEmbed from "../components/RetroclaimEmbed";
import StripeConnectCard from "../components/StripeConnectCard";
import ViewerEmbed from "../components/ViewerEmbed";
import { CapsuleManifest, listCapsuleIds, loadCapsuleManifest } from "../lib/capsuleManifest";
import { getSiteUrl } from "../lib/siteConfig";

type CapsulePageProps = {
  capsule: CapsuleManifest;
};

const CapsulePage: NextPage<CapsulePageProps> = ({ capsule }) => {
  const siteUrl = getSiteUrl();
  const capsuleUrl = `${siteUrl}/${capsule.capsuleId}`;

  return (
    <>
      <Head>
        <title>{capsule.title} • averyos.com</title>
        <meta name="description" content={capsule.summary} />
        <meta property="og:title" content={`${capsule.title} • averyos.com`} />
        <meta property="og:description" content={capsule.summary} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={capsuleUrl} />
        <link rel="canonical" href={capsuleUrl} />
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
        <p className="footer-note">
          Missing a capsule? Add its .aoscap source and re-run the compiler to publish.
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
  };
};

export default CapsulePage;
