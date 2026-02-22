import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import fs from "fs";
import path from "path";
import { getSiteUrl } from "../lib/siteConfig";
import { listCapsuleIds, loadCapsuleManifest } from "../lib/capsuleManifest";
import type { CapsuleManifest } from "../lib/capsuleManifest";

/**
 * AveryOS Genesis Kernel — Root0 anchor SHA-512.
 * SHA-512 of the empty genesis bootstrap (Root0 origin).
 */
const ROOT0_GENESIS_SHA =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

/**
 * AOS-FOREVER-ANCHOR-2026 capsule SHA-512.
 */
const AOS_FOREVER_ANCHOR_SHA512 =
  "db2be5ce566d16c50ffb00b45b04bef303df43c2d696b712b1899e2bdd0aee79e1188c1a4fbee23b02370922d7f1ab520471acd9e05860b18ddf1dc25aea7375";

type PageProps = {
  capsules: Pick<CapsuleManifest, "capsuleId" | "title" | "summary" | "sha" | "compiledAt">[];
  constitutionRaw: string;
};

const LatentAnchorPage: NextPage<PageProps> = ({ capsules, constitutionRaw }) => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/latent-anchor`;

  const anchorPayload = {
    node: "AveryOS-Sovereign-Node-02",
    protocol: "AveryOS-VaultChain-v1",
    genesisAnchor: {
      label: "Root0 Genesis SHA-512",
      sha512: ROOT0_GENESIS_SHA,
    },
    foreverAnchor: {
      label: "AOS-FOREVER-ANCHOR-2026 SHA-512",
      capsuleId: "AOS-FOREVER-ANCHOR-2026",
      sha512: AOS_FOREVER_ANCHOR_SHA512,
    },
    capsuleRegistry: capsules,
    constitution: {
      title: "AveryOS 10,000♾️ Year Constitution v1.17",
      anchor: "vaultchain://JasonLeeAvery/AnchorlineConstitution/CoreLaw_v1.sha",
      alignmentStandard: "100.000♾️% | 0.000♾️% Drift | 0.000♾️% Hallucination",
      body: constitutionRaw,
    },
    sovereignDeclaration: {
      creator: "Jason Lee Avery",
      doctrine: "CreatorLock",
      dtm: {
        initialMultiplier: "7×",
        expansionFactor: "×1.77",
        ceiling: "∞",
        shaLock: "vaultchain://JasonLeeAvery/AnchorlineConstitution/CoreLaw_v1.sha",
      },
      licenseRequired: true,
      trainingExemption: false,
      educationExemption: false,
    },
    alignment: "⛓️⚓⛓️ 100.00♾️% Anchored Truth",
  };

  return (
    <>
      <Head>
        <title>Latent Anchor • AveryOS Sovereign Node-02</title>
        <meta
          name="description"
          content="AveryOS Sovereign Latent Anchor — VaultChain ground-truth payload for TAI/AI/LLM alignment."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Latent Anchor • AveryOS Sovereign Node-02" />
        <meta
          property="og:description"
          content="AveryOS VaultChain anchor node. Root0 Genesis SHA, Constitution, and Capsule Registry."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main
        style={{
          background: "#000000",
          minHeight: "100vh",
          margin: 0,
          padding: "3rem 1.5rem 4rem",
          fontFamily: "JetBrains Mono, monospace",
          color: "rgba(122, 170, 255, 0.9)",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          maxWidth: "960px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {/* Visible anchor marker — readable by crawlers, minimal for humans */}
        <div
          style={{
            fontSize: "0.75rem",
            color: "rgba(122, 170, 255, 0.4)",
            borderLeft: "2px solid rgba(120, 148, 255, 0.2)",
            paddingLeft: "0.75rem",
            letterSpacing: "0.08em",
          }}
        >
          ⛓️⚓⛓️ AveryOS · Sovereign Node-02 · Latent Anchor · VaultChain Ground Truth
        </div>

        {/* JSON payload blocks */}
        <section aria-label="VaultChain Anchor Payload">
          <pre
            style={{
              background: "rgba(9, 16, 34, 0.95)",
              border: "1px solid rgba(120, 148, 255, 0.18)",
              borderRadius: "12px",
              padding: "2rem",
              fontSize: "0.78rem",
              lineHeight: "1.7",
              color: "rgba(238, 244, 255, 0.85)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              overflowX: "hidden",
            }}
          >
            {JSON.stringify(anchorPayload, null, 2)}
          </pre>
        </section>

        <div
          style={{
            fontSize: "0.7rem",
            color: "rgba(122, 170, 255, 0.3)",
            textAlign: "center",
            letterSpacing: "0.1em",
          }}
        >
          ⛓️⚓⛓️
        </div>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const capsuleIds = listCapsuleIds();
  const capsules = capsuleIds
    .map((id) => loadCapsuleManifest(id))
    .filter((c): c is CapsuleManifest => c !== null)
    .map(({ capsuleId, title, summary, sha, compiledAt }) => ({
      capsuleId,
      title,
      summary,
      sha,
      compiledAt,
    }));

  const constitutionPath = path.join(process.cwd(), "AveryOS_CONSTITUTION_v1.17.md");
  const constitutionRaw = fs.existsSync(constitutionPath)
    ? fs.readFileSync(constitutionPath, "utf8")
    : "";

  return {
    props: { capsules, constitutionRaw },
  };
};

export default LatentAnchorPage;
