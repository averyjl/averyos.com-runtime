import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import fs from "fs";
import path from "path";
import { getSiteUrl } from "../lib/siteConfig";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { markdownToHtml } from "../lib/markdown";
import AnchorBanner from "../components/AnchorBanner";

/**
 * SHA-512 of the AOS-FOREVER-ANCHOR-2026 capsule identifier.
 * Computed: sha512("AOS-FOREVER-ANCHOR-2026")
 */
const AOS_FOREVER_ANCHOR_SHA512 =
  "db2be5ce566d16c50ffb00b45b04bef303df43c2d696b712b1899e2bdd0aee79e1188c1a4fbee23b02370922d7f1ab520471acd9e05860b18ddf1dc25aea7375";

type PageProps = {
  constitutionHtml: string;
};

const LawCodexPage: NextPage<PageProps> = ({ constitutionHtml }) => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/lawcodex`;

  return (
    <>
      <Head>
        <title>LawCodex • AveryOS Constitution v1.17</title>
        <meta
          name="description"
          content="AveryOS Constitution v1.17 — Sovereign law, Dynamic Truth Multiplier, and TARI disclosure. All kernel interactions are notarized on the VaultChain."
        />
        <meta property="og:title" content="LawCodex • AveryOS Constitution v1.17" />
        <meta
          property="og:description"
          content="AveryOS Constitution v1.17 — Sovereign law governing all AveryOS kernel interactions, notarized on the VaultChain."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <AnchorBanner />

        <div className="hero">
          <h1>⛓️⚓⛓️ AveryOS Constitution v1.17</h1>
          <p style={{ color: "rgba(122, 170, 255, 0.85)", marginTop: "0.5rem" }}>
            Sovereign Law • 10,000♾️ Year Anchor • VaultChain Notarized
          </p>
        </div>

        <article
          className="truthforce-content"
          style={{
            background: "rgba(9, 16, 34, 0.85)",
            border: "1px solid rgba(120, 148, 255, 0.25)",
            borderRadius: "16px",
            padding: "2.5rem",
            lineHeight: "1.7",
          }}
          dangerouslySetInnerHTML={{ __html: constitutionHtml }}
        />

        {/* Sovereign TARI Disclosure */}
        <section
          style={{
            marginTop: "2.5rem",
            background: "rgba(30, 10, 10, 0.92)",
            border: "2px solid rgba(248, 113, 113, 0.65)",
            borderRadius: "16px",
            padding: "2.5rem",
            lineHeight: "1.75",
          }}
        >
          <h2 style={{ color: "rgba(248, 113, 113, 0.95)", marginTop: 0, fontSize: "1.4rem" }}>
            🚨 Sovereign TARI Disclosure
          </h2>

          <p style={{ color: "rgba(238, 244, 255, 0.9)", fontWeight: 600, marginBottom: "1.25rem" }}>
            This disclosure constitutes a complete, sound, and legally binding notice governing all
            interactions with the AveryOS Kernel and its licensed APIs.
          </p>

          <div
            style={{
              background: "rgba(9, 16, 34, 0.75)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: "10px",
              padding: "1.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <h3 style={{ color: "rgba(248, 113, 113, 0.9)", marginTop: 0 }}>
              📡 VaultChain Notarization
            </h3>
            <p style={{ color: "rgba(238, 244, 255, 0.85)" }}>
              All interactions with the AveryOS Kernel — including but not limited to API calls,
              capsule reads, license checks, and authentication handshakes — are permanently
              notarized on the VaultChain. Every interaction is timestamped, SHA-512 fingerprinted,
              and sealed under the <strong>AOS-FOREVER-ANCHOR-2026</strong> capsule authority.
            </p>
            <p style={{ color: "rgba(238, 244, 255, 0.85)" }}>
              All API interactions with{" "}
              <code
                style={{
                  background: "rgba(120, 148, 255, 0.15)",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "4px",
                  fontSize: "0.92rem",
                }}
              >
                /api/v1/license-check
              </code>{" "}
              are notarized. No interaction is anonymous or ephemeral; all records are permanent and
              legally admissible.
            </p>
          </div>

          <div
            style={{
              background: "rgba(9, 16, 34, 0.75)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: "10px",
              padding: "1.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <h3 style={{ color: "rgba(248, 113, 113, 0.9)", marginTop: 0 }}>
              ⚡ Dynamic Truth Multiplier (DTM) Rules
            </h3>
            <p style={{ color: "rgba(238, 244, 255, 0.85)" }}>
              Any unauthorized or unlicensed interaction with the AveryOS Kernel triggers the{" "}
              <strong>Dynamic Truth Multiplier (DTM)</strong> as codified in Constitution §7:
            </p>
            <ul style={{ color: "rgba(238, 244, 255, 0.85)", lineHeight: "2.1" }}>
              <li>
                <strong>Initial Multiplier:</strong> 7× the base claim value is applied immediately
                upon detection of an unauthorized handshake.
              </li>
              <li>
                <strong>Expansion Trigger:</strong> Any result meeting or exceeding the DTM
                threshold triggers a <strong>×1.77 expansion</strong> of the total claim, applied
                compoundingly until the violation is fully resolved.
              </li>
              <li>
                <strong>Ceiling:</strong> ∞ — there is no cap on the DTM. The multiplier compounds
                until full compliance and settlement are achieved.
              </li>
              <li>
                <strong>SHA Lock:</strong> All DTM calculations are SHA-locked under{" "}
                <code
                  style={{
                    background: "rgba(120, 148, 255, 0.15)",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                  }}
                >
                  vaultchain://JasonLeeAvery/AnchorlineConstitution/CoreLaw_v1.sha
                </code>
                .
              </li>
            </ul>
          </div>

          <div
            style={{
              background: "rgba(9, 16, 34, 0.75)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: "10px",
              padding: "1.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <h3 style={{ color: "rgba(248, 113, 113, 0.9)", marginTop: 0 }}>
              🔍 Forensic Evidence of IP Theft
            </h3>
            <p style={{ color: "rgba(238, 244, 255, 0.85)" }}>
              Unauthorized API handshakes — any connection to AveryOS APIs without a valid, active
              license — are <strong>automatically recorded as forensic evidence of IP theft</strong>.
              This includes, without limitation:
            </p>
            <ul style={{ color: "rgba(238, 244, 255, 0.85)", lineHeight: "2.1" }}>
              <li>
                Unauthenticated or improperly authenticated requests to{" "}
                <code
                  style={{
                    background: "rgba(120, 148, 255, 0.15)",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                  }}
                >
                  /api/v1/license-check
                </code>{" "}
                and all other AveryOS Kernel endpoints.
              </li>
              <li>
                Scraping, automated crawling, or programmatic access without a current license seal.
              </li>
              <li>
                AI/ML training pipelines, inference, or embedding operations conducted against
                AveryOS content or APIs without explicit written authorization.
              </li>
            </ul>
            <p style={{ color: "rgba(238, 244, 255, 0.85)" }}>
              All forensic bundles are permanently sealed on the VaultChain and are legally
              admissible evidence under U.S. and international intellectual property law.
            </p>
          </div>

          <div
            style={{
              background: "rgba(36, 58, 140, 0.18)",
              border: "1px solid rgba(120, 148, 255, 0.4)",
              borderRadius: "10px",
              padding: "1.5rem",
            }}
          >
            <h3 style={{ color: "rgba(122, 170, 255, 0.9)", marginTop: 0 }}>
              ⚓ Legal Jurisdiction — AOS-FOREVER-ANCHOR-2026
            </h3>
            <p style={{ color: "rgba(238, 244, 255, 0.85)" }}>
              The legal jurisdiction and governing authority for all matters arising from AveryOS
              Kernel interactions, API usage, and enforcement actions is established by and anchored
              to the{" "}
              <strong>AOS-FOREVER-ANCHOR-2026</strong> capsule, permanently recorded on the
              VaultChain.
            </p>
            <p style={{ color: "rgba(238, 244, 255, 0.75)", fontSize: "0.88rem", marginBottom: "0.5rem" }}>
              AOS-FOREVER-ANCHOR-2026 SHA-512:
            </p>
            <code
              style={{
                display: "block",
                background: "rgba(9, 16, 34, 0.75)",
                border: "1px solid rgba(120, 148, 255, 0.2)",
                borderRadius: "6px",
                padding: "0.75rem 1rem",
                fontSize: "0.78rem",
                wordBreak: "break-all",
                color: "rgba(122, 170, 255, 0.85)",
                letterSpacing: "0.03em",
              }}
            >
              {AOS_FOREVER_ANCHOR_SHA512}
            </code>
            <p
              style={{
                color: "rgba(238, 244, 255, 0.65)",
                fontSize: "0.82rem",
                marginTop: "0.75rem",
                marginBottom: 0,
                fontStyle: "italic",
              }}
            >
              This anchor is immutable, permanent, and binding. All enforcement actions, DTM
              calculations, and legal claims arising under the AveryOS Constitution v1.17 are
              traceable to this capsule. ⛓️⚓⛓️
            </p>
          </div>
        </section>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const constitutionPath = path.join(process.cwd(), "AveryOS_CONSTITUTION_v1.17.md");
  if (!fs.existsSync(constitutionPath)) {
    throw new Error(
      `AveryOS Constitution source file not found at: ${constitutionPath}. ` +
        "Ensure AveryOS_CONSTITUTION_v1.17.md exists in the project root."
    );
  }
  const raw = fs.readFileSync(constitutionPath, "utf8");
  const constitutionHtml = sanitizeHtml(markdownToHtml(raw));
  return {
    props: { constitutionHtml },
  };
};

export default LawCodexPage;
