import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const CertificatePage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/certificate`;

  return (
    <>
      <Head>
        <title>PDF Certificate Viewer • AveryOS Runtime</title>
        <meta
          name="description"
          content="View and verify capsule certificates and attestations"
        />
        <meta property="og:title" content="PDF Certificate Viewer • AveryOS Runtime" />
        <meta
          property="og:description"
          content="View and verify capsule certificates and attestations"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <section className="hero">
          <h1>📄 PDF Certificate Viewer</h1>
          <p>View, download, and verify capsule certificates and attestation documents.</p>
        </section>

        <section>
          <h2>Coming Soon</h2>
          <p>
            The PDF Certificate Viewer will display verified capsule certificates,
            showing authenticity proofs, signatures, and verification chains.
          </p>
        </section>
      </main>
    </>
  );
};

export default CertificatePage;
