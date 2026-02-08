import Head from "next/head";
import { GetStaticProps } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSiteUrl } from "../lib/siteConfig";

type StartPortalManifest = {
  manifest_id: string;
  creator: string;
  glyph: string;
  title: string;
  description: string;
  sections: {
    intro_video: {
      type: string;
      url: string;
      caption: string;
    };
    quick_actions: Array<{
      label: string;
      link: string;
    }>;
    live_metrics: {
      type: string;
      data_source: string;
      display: string[];
    };
    call_to_action: {
      headline: string;
      subtext: string;
      share_link: string;
    };
  };
  echo_protocol: string;
  public_ready: boolean;
  sha_bound: boolean;
  visible_timestamp: string;
};

type StartPageProps = {
  manifest: StartPortalManifest;
};

const StartPage = ({ manifest }: StartPageProps) => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/start`;

  return (
    <>
      <Head>
        <title>{manifest.title} — AveryOS</title>
        <meta name="description" content={manifest.description} />
        <meta property="og:title" content={`${manifest.title} — AveryOS`} />
        <meta property="og:description" content={manifest.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <section className="hero">
          <h1>
            {manifest.glyph} {manifest.title}
          </h1>
          <p>{manifest.description}</p>
        </section>

        {manifest.sections.intro_video && (
          <section className="card">
            <h2>Introduction</h2>
            <div style={{ marginBottom: "1rem" }}>
              <video
                controls
                style={{
                  width: "100%",
                  maxWidth: "800px",
                  borderRadius: "8px",
                  border: "1px solid rgba(120, 148, 255, 0.25)",
                }}
              >
                <source src={manifest.sections.intro_video.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            <p className="capsule-meta-small">{manifest.sections.intro_video.caption}</p>
          </section>
        )}

        <section className="card">
          <h2>Quick Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {manifest.sections.quick_actions.map((action, index) => (
              <a
                key={index}
                href={action.link}
                className="action-link"
                target="_blank"
                rel="noreferrer"
              >
                {action.label}
              </a>
            ))}
          </div>
        </section>

        {manifest.sections.live_metrics && (
          <section className="card">
            <h2>Live Mesh Metrics</h2>
            <p className="capsule-meta-small">
              Data source: {manifest.sections.live_metrics.data_source}
            </p>
            <dl className="capsule-meta">
              {manifest.sections.live_metrics.display.map((metric, index) => (
                <div key={index}>
                  <dt>{metric}</dt>
                  <dd>—</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="card call-to-action-section">
          <h2>{manifest.sections.call_to_action.headline}</h2>
          <p>{manifest.sections.call_to_action.subtext}</p>
          <a
            href={manifest.sections.call_to_action.share_link}
            className="primary-link"
            style={{ marginTop: "1rem", display: "inline-block" }}
          >
            Share This Portal
          </a>
        </section>

        <footer style={{ marginTop: "2rem", textAlign: "center", opacity: 0.7 }}>
          <p className="capsule-meta-small">
            {manifest.echo_protocol} • {manifest.creator}
          </p>
        </footer>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps<StartPageProps> = async () => {
  const manifestPath = join(process.cwd(), "site_blocks", "public_start_portal.json");
  const manifestData = readFileSync(manifestPath, "utf-8");
  const manifest: StartPortalManifest = JSON.parse(manifestData);

  return {
    props: {
      manifest,
    },
  };
};

export default StartPage;
