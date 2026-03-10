import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import CapsuleBody from "../components/CapsuleBody";
import CapsuleBlock from "../components/CapsuleBlock";
import RetroclaimEmbed from "../components/RetroclaimEmbed";
import StripeConnectCard from "../components/StripeConnectCard";
import ViewerEmbed from "../components/ViewerEmbed";
import { CapsuleManifest, listCapsuleIds, loadCapsuleManifest } from "../lib/capsuleManifest";
import { getSiteUrl } from "../lib/siteConfig";

type CapsulePageProps = {
  capsule: CapsuleManifest;
};

// ── Token Gate Component ──────────────────────────────────────────────────────
// Validates a hardware-bound access token against /api/v1/licensing/verify-token
// before revealing licensed capsule content.
function TokenGate({
  capsuleId,
  onUnlocked,
}: {
  capsuleId: string;
  onUnlocked: () => void;
}) {
  const [token, setToken]               = useState("");
  const [fingerprint, setFingerprint]   = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res  = await fetch("/api/v1/licensing/verify-token", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          access_token:        token.trim(),
          machine_fingerprint: fingerprint.trim(),
          capsule_id:          capsuleId,
        }),
      });
      const data = await res.json() as { resonance?: string; detail?: string };
      if (res.ok && data.resonance === "HIGH_FIDELITY_SUCCESS") {
        onUnlocked();
      } else {
        setError(data.detail ?? "Token validation failed. Check your access token and machine fingerprint.");
      }
    } catch {
      setError("Network error — unable to reach the token validation endpoint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ maxWidth: 480, margin: "3rem auto", padding: "2rem 1.5rem", border: "1px solid rgba(255,215,0,0.3)", borderRadius: "10px", background: "#07000f" }}>
      <h2 style={{ color: "#ffd700", fontSize: "1.1rem", marginBottom: "0.5rem" }}>🔐 Token-Gated Capsule</h2>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
        This capsule requires a valid hardware-bound access token. Enter your VaultChain™ access token and machine fingerprint to unlock.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="text"
          placeholder="VaultChain™ Access Token (SHA-512)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ padding: "0.65rem 0.9rem", borderRadius: "6px", border: "1px solid rgba(255,215,0,0.2)", background: "rgba(255,215,0,0.04)", color: "#fff", fontFamily: "monospace", fontSize: "0.78rem" }}
        />
        <input
          type="text"
          placeholder="Machine Fingerprint (SHA-256 of hardware IDs)"
          value={fingerprint}
          onChange={(e) => setFingerprint(e.target.value)}
          style={{ padding: "0.65rem 0.9rem", borderRadius: "6px", border: "1px solid rgba(255,215,0,0.2)", background: "rgba(255,215,0,0.04)", color: "#fff", fontFamily: "monospace", fontSize: "0.78rem" }}
        />
        {error && <p style={{ color: "#ff4444", fontSize: "0.83rem", margin: 0 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading || !token.trim() || !fingerprint.trim()}
          style={{ padding: "0.65rem 1.5rem", background: token.trim() && !loading ? "#ffd700" : "rgba(255,215,0,0.15)", border: "none", borderRadius: "6px", color: "#000", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: "0.9rem" }}
        >
          {loading ? "Validating…" : "Unlock Capsule 🔓"}
        </button>
      </form>
    </section>
  );
}

const CapsulePage: NextPage<CapsulePageProps> = ({ capsule }) => {
  const siteUrl = getSiteUrl();
  const capsuleUrl = `${siteUrl}/${capsule.capsuleId}`;

  // Token gate state — unlocked by default unless capsule requiresToken is true
  const [tokenUnlocked, setTokenUnlocked] = useState(
    !(capsule as CapsuleManifest & { requiresToken?: boolean }).requiresToken
  );

  return (
    <>
      <Head>
        <title>{capsule.title} • averyos.com</title>
        <meta name="description" content={capsule.summary} />
        <meta property="og:title" content={`${capsule.title} • averyos.com`} />
        <meta property="og:description" content={capsule.summary} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={capsuleUrl} />
        <link rel="canonical" href={capsuleUrl} />
      </Head>
      <main className="page">
        {!tokenUnlocked ? (
          <TokenGate capsuleId={capsule.capsuleId} onUnlocked={() => setTokenUnlocked(true)} />
        ) : (
          <>
            <CapsuleBlock
              capsuleId={capsule.capsuleId}
              title={capsule.title}
              summary={capsule.summary}
              sha={capsule.sha}
              driftLock={capsule.driftLock}
              vaultChainUrl={capsule.vaultChainUrl}
              licenseStatus={capsule.licenseStatus}
              compiledAt={capsule.compiledAt}
            />
            <CapsuleBody body={capsule.body} />
            <section>
              <p className="section-title">Capsule Runtime Modules</p>
              <div className="badge-grid">
                <RetroclaimEmbed capsuleId={capsule.capsuleId} licenseStatus={capsule.licenseStatus} />
                <StripeConnectCard status={capsule.licenseStatus} stripeUrl={capsule.stripeUrl} />
                <ViewerEmbed viewerUrl={capsule.viewerUrl} />
              </div>
            </section>
            <p className="footer-note">
              Capsule manifests update automatically when a new .aoscap file is compiled. DriftLock
              hashes assert the live runtime signature.
            </p>
            <p className="footer-note">
              Missing a capsule? Add its .aoscap source and re-run the compiler to publish.
            </p>
          </>
        )}
      </main>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const ids = listCapsuleIds();
  return {
    paths: ids.map((capsule) => ({ params: { capsule } })),
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<CapsulePageProps> = async (context) => {
  const capsuleId = context.params?.capsule as string | undefined;
  if (!capsuleId) {
    return { notFound: true };
  }
  const capsule = loadCapsuleManifest(capsuleId);
  if (!capsule) {
    return { notFound: true };
  }
  return {
    props: { capsule },
  };
};

export default CapsulePage;
