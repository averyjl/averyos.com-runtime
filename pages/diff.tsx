import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const DiffPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/diff`;

  return (
    <>
      <Head>
        <title>Capsule Diff Viewer • AveryOS Runtime</title>
        <meta
          name="description"
          content="Compare and visualize differences between capsule versions"
        />
        <meta property="og:title" content="Capsule Diff Viewer • AveryOS Runtime" />
        <meta
          property="og:description"
          content="Compare and visualize differences between capsule versions"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <section className="hero">
          <h1>📊 Capsule Diff Viewer</h1>
          <p>Compare capsule versions and visualize changes in manifests and metadata.</p>
        </section>

        <section>
          <h2>Coming Soon</h2>
          <p>
            The Capsule Diff Viewer will allow you to compare two capsule versions side-by-side,
            highlighting changes in content, metadata, and DriftLock hashes.
          </p>
        </section>
      </main>
    </>
  );
};

export default DiffPage;
