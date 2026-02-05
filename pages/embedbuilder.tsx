import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const EmbedBuilderPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/embedbuilder`;

  return (
    <>
      <Head>
        <title>Embed Capsule Builder</title>
        <meta
          name="description"
          content="Embed Capsule builder tool for AveryOS deployments."
        />
        <meta property="og:title" content="Embed Capsule Builder" />
        <meta property="og:description" content="Embed Capsule builder tool for AveryOS deployments." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <section className="hero">
          <h1>Embed Capsule Builder</h1>
          <p>
            Use the live builder to generate embed code. This iframe points to the hosted tool
            at averyos.com.
          </p>
        </section>
        <section className="card">
          <div className="embed-frame">
            <iframe
              title="AveryOS Embed Builder"
              src="https://averyos.com/tools/embedbuilder"
              loading="lazy"
            />
          </div>
          <p className="capsule-meta">
            If the embed tool is unavailable, check back later or contact{" "}
            <a href="mailto:truth@averyworld.com">truth@averyworld.com</a>.
          </p>
        </section>
      </main>
    </>
  );
};

export default EmbedBuilderPage;
