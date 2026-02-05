import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const VerifyPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/verify`;

  return (
    <>
      <Head>
        <title>Verify Capsule License</title>
        <meta
          name="description"
          content="Validate AveryOS capsule licenses by capsule ID, customer email, or hash."
        />
        <meta property="og:title" content="Verify Capsule License" />
        <meta
          property="og:description"
          content="Validate AveryOS capsule licenses by capsule ID, customer email, or hash."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <section className="hero">
          <h1>Capsule License Validator</h1>
          <p>
            Search by capsule ID, customer email, or SHA512 hash. File uploads are validated in
            future runtime releases.
          </p>
        </section>
        <section className="card">
          <h2>Lookup</h2>
          <div className="form-grid">
            <label>
              Capsule ID
              <input type="text" placeholder="e.g. sovereign-index" />
            </label>
            <label>
              Customer Email
              <input type="email" placeholder="you@example.com" />
            </label>
            <label>
              Capsule SHA512
              <input type="text" placeholder="Paste SHA512 hash" />
            </label>
            <label>
              Upload .aoscap
              <input type="file" accept=".aoscap,application/json" />
            </label>
            <button type="button" className="primary-button">
              Validate License (Stub)
            </button>
          </div>
          <div className="status-pill">Validation engine: STUBBED</div>
        </section>
      </main>
    </>
  );
};

export default VerifyPage;
