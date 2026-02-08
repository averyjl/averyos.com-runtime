import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { listRegistryCapsules } from "../lib/capsuleRegistry";
import { listCapsuleIds } from "../lib/capsuleManifest";
import { getSiteUrl } from "../lib/siteConfig";

type CapsuleIndexItem = ReturnType<typeof listRegistryCapsules>[number];

type HomeProps = {
  capsules: CapsuleIndexItem[];
};

const formatCompiledAt = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
};

const Home: NextPage<HomeProps> = ({ capsules }) => {
  const siteUrl = getSiteUrl();
  const capsuleCount = capsules.length;

  return (
    <>
      <Head>
        <title>averyos.com • Capsule Runtime</title>
        <meta
          name="description"
          content="Capsule-powered runtime for averyos.com with sovereign manifests, DriftLock hashes, and publish-ready modules."
        />
        <meta property="og:title" content="averyos.com • Capsule Runtime" />
        <meta
          property="og:description"
          content="Capsule-powered runtime for averyos.com with sovereign manifests, DriftLock hashes, and publish-ready modules."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <link rel="canonical" href={siteUrl} />
      </Head>

      <main className="page">
        <section className="hero">
          <h1>Sovereign Capsule WebBuilder</h1>
          <p>
            Capsule manifests drive each live route. Build manifests from .aoscap inputs and
            publish instantly with DriftLock + VaultChain metadata.
          </p>
        </section>
        <section>
          <p className="section-title">Runtime Modules</p>
          <div className="badge-grid">
            <div className="badge">
              <h3>CapsulePage Auto-Compiler</h3>
              <p>Transforms .aoscap JSON into manifest-ready capsules with SHA + DriftLock.</p>
            </div>
            <div className="badge">
              <h3>Retroclaim Embed</h3>
              <p>Anchors capsule licensing data and readiness signals.</p>
            </div>
            <div className="badge">
              <h3>Stripe License Connect</h3>
              <p>Shows revenue connection status and link targets.</p>
            </div>
            <div className="badge">
              <h3>Viewer+</h3>
              <p>Indicates the live viewer endpoint when attached.</p>
            </div>
          </div>
        </section>
        <section>
          <h2>Available Capsules</h2>
          <p className="capsule-meta">{capsuleCount} capsule(s) available.</p>
          {capsules.length === 0 ? (
            <p>No capsules built yet. Run the capsule compiler to generate manifests.</p>
          ) : (
            <ul className="capsule-list">
              {capsules.map((capsule) => (
                <li key={capsule.capsuleId}>
                  <div className="capsule-list-item">
                    <Link href={`/${capsule.capsuleId}`}>{capsule.title ?? capsule.capsuleId}</Link>
                    {capsule.summary ? <p>{capsule.summary}</p> : null}
                    {capsule.compiledAt ? (
                      <span className="capsule-meta">
                        Compiled {formatCompiledAt(capsule.compiledAt)}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="footer-note">
          Need to add more pages? Drop new .aoscap files into /capsules and run the capsule build
          script to publish them instantly.
        </p>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const registryCapsules = listRegistryCapsules();
  const capsules =
    registryCapsules.length > 0
      ? registryCapsules
      : listCapsuleIds().map((capsuleId) => ({ capsuleId }));
  return {
    props: {
      capsules,
    },
    revalidate: 60,
  };
};

export default Home;
