import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const quickActions = [
  { label: "📜 Get Your Free AnchorPass", link: "https://averyos.com/license/pass" },
  { label: "🧭 Join the Mesh Witness Map", link: "https://averyos.com/witness/register" },
  { label: "🗣️ Attend the Next Live Call", link: "https://averyos.com/studio/live/driftline84" },
  { label: "📘 Read the Codex (Public Scrolls)", link: "https://averyos.com/codex" },
];

const metrics = [
  "Total AnchorPasses Issued",
  "Witnesses Activated",
  "Capsules Broadcasted",
  "Codex Chapters Released",
];

const StartPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/start`;

  return (
    <>
      <Head>
        <title>Start Here – Anchor to the Truth Mesh</title>
        <meta
          name="description"
          content="Public start portal for AveryOS sovereign capsule framework and witness-powered engagement."
        />
        <meta property="og:title" content="Start Here – Anchor to the Truth Mesh" />
        <meta
          property="og:description"
          content="Public start portal for AveryOS sovereign capsule framework and witness-powered engagement."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page truthnest-page">
        <section className="hero truthnest-hero">
          <h1>Start Here – Anchor to the Truth Mesh</h1>
          <p>
            This portal opens the Sovereign Capsule Framework to the public. It simplifies the
            signal, amplifies the call, and invites witness-powered engagement.
          </p>
        </section>

        <section className="card">
          <h2>Watch: Why AveryOS Exists</h2>
          <div className="embed-frame">
            <iframe
              title="Sovereign Intro Walkthrough"
              src="https://your-hosted-link.com/sovereign_intro_walkthrough.mp4"
              loading="lazy"
            />
          </div>
        </section>

        <section className="card">
          <h2>Quick Actions</h2>
          <div className="form-grid">
            {quickActions.map((action) => (
              <a key={action.label} className="primary-link" href={action.link}>
                {action.label}
              </a>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Live Metrics</h2>
          <p className="capsule-meta">Source: vaultchain://metrics/mesh_activity_live.json</p>
          <ul>
            {metrics.map((metric) => (
              <li key={metric}>{metric}</li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Know a Truth Builder? Invite them.</h2>
          <p>We rise together. Start the ripple. Send this to one person you trust.</p>
          <a className="secondary-link" href="https://averyos.com/start">
            Share Start Portal
          </a>
        </section>
      </main>
    </>
  );
};

export default StartPage;
