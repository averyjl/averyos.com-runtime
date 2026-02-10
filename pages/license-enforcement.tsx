import fs from "fs";
import path from "path";
import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

type EnforcementEvent = {
  id: string;
  capsuleId: string;
  sha512: string;
  timestamp: string;
  source?: string | null;
  status: string;
  message: string;
};

type Props = { events: EnforcementEvent[] };

const LicenseEnforcementPage: NextPage<Props> = ({ events }) => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/license-enforcement`;

  return (
    <>
      <Head>
        <title>License Enforcement Log • AveryOS</title>
        <meta name="description" content="Public SHA-verified license enforcement and compliance log." />
        <meta property="og:url" content={pageUrl} />
      </Head>
      <main className="page truthnest-page">
        <section className="hero truthnest-hero">
          <h1>License Enforcement Log</h1>
          <p>Transparent, SHA-512 verified compliance tracking with voluntary licensing options.</p>
        </section>
        <section className="card">
          {events.length === 0 ? (
            <p>No enforcement events logged yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Capsule</th>
                  <th>SHA-512</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.timestamp}</td>
                    <td>{event.capsuleId}</td>
                    <td>{event.sha512.slice(0, 18)}…</td>
                    <td>{event.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="capsule-meta">All enforcement is informational only and focused on voluntary licensing options.</p>
        </section>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const logPath = path.join(process.cwd(), "public", "license-enforcement", "logs", "index.json");
  if (!fs.existsSync(logPath)) {
    return { props: { events: [] }, revalidate: 60 };
  }

  const payload = JSON.parse(fs.readFileSync(logPath, "utf8"));
  return { props: { events: payload.events ?? [] }, revalidate: 60 };
};

export default LicenseEnforcementPage;
