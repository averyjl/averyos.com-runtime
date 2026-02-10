import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const SigTracePage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/sigtrace`;

  return (
    <>
      <Head>
        <title>Signature Trace Log • AveryOS Runtime</title>
        <meta
          name="description"
          content="Trace and audit cryptographic signatures across the capsule chain"
        />
        <meta property="og:title" content="Signature Trace Log • AveryOS Runtime" />
        <meta
          property="og:description"
          content="Trace and audit cryptographic signatures across the capsule chain"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <section className="hero">
          <h1>🔐 Signature Trace Log</h1>
          <p>
            Track and verify the cryptographic signature chain for capsules and transactions.
          </p>
        </section>

        <section>
          <h2>Coming Soon</h2>
          <p>
            The Signature Trace Log will provide detailed audit trails of all cryptographic
            signatures, including verification status, timestamps, and signature chains.
          </p>
        </section>
      </main>
    </>
  );
};

export default SigTracePage;
