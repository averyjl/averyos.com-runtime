import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const RetroclaimLogPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/retroclaim-log`;

  return (
    <>
      <Head>
        <title>Retroclaim Ledger Viewer</title>
        <meta
          name="description"
          content="Read-only retroclaim ledger viewer for AveryOS capsule enforcement events."
        />
        <meta property="og:title" content="Retroclaim Ledger Viewer" />
        <meta
          property="og:description"
          content="Read-only retroclaim ledger viewer for AveryOS capsule enforcement events."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <section className="hero">
          <h1>Retroclaim Ledger</h1>
          <p>Read-only feed of recent retroclaim activity. Live API feed coming soon.</p>
        </section>
        <section className="card">
          <h2>Ledger Entries</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Capsule ID</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2026-02-02T05:00Z</td>
                <td>sovereign-init</td>
                <td>Validated</td>
                <td>RC-0001</td>
              </tr>
              <tr>
                <td>2026-02-02T05:08Z</td>
                <td>sovereign-index</td>
                <td>Monitor</td>
                <td>RC-0002</td>
              </tr>
              <tr>
                <td>2026-02-02T05:12Z</td>
                <td>capsule-delta</td>
                <td>Pending</td>
                <td>RC-0003</td>
              </tr>
            </tbody>
          </table>
          <div className="status-pill">Retroclaim feed: STUBBED</div>
        </section>
      </main>
    </>
  );
};

export default RetroclaimLogPage;
