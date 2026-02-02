import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { listCapsuleIds } from "../lib/capsuleManifest";

const Home: NextPage = () => {
  const capsules = listCapsuleIds();

  return (
    <>
      <Head>
        <title>averyos.com • Capsule Runtime</title>
      </Head>
      <main className="page">
        <section className="hero">
          <h1>Sovereign Capsule WebBuilder</h1>
          <p>
            Capsule manifests drive each live route. Build manifests from .aoscap inputs and
            publish instantly.
          </p>
        </section>
        <section>
          <h2>Available Capsules</h2>
          {capsules.length === 0 ? (
            <p>No capsules built yet. Run the capsule compiler to generate manifests.</p>
          ) : (
            <ul>
              {capsules.map((capsule) => (
                <li key={capsule}>
                  <Link href={`/${capsule}`}>{capsule}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
};

export default Home;
