import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const DiscoverPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/discover`;

  return (
    <>
      <Head>
        <title>Discover • AveryOS Runtime</title>
        <meta
          name="description"
          content="Discover capsules and modules in the AveryOS ecosystem"
        />
        <meta property="og:title" content="Discover • AveryOS Runtime" />
        <meta
          property="og:description"
          content="Discover capsules and modules in the AveryOS ecosystem"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <section className="hero">
          <h1>🔍 Discover</h1>
          <p>Explore and discover capsules across the AveryOS ecosystem.</p>
        </section>

        <section>
          <h2>Coming Soon</h2>
          <p>
            The Discover portal will enable you to browse, search, and explore capsules
            with advanced filtering and discovery features.
          </p>
        </section>
      </main>
    </>
  );
};

export default DiscoverPage;
