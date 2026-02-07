import Head from "next/head";
import { useState } from "react";
import { getSiteUrl } from "../lib/siteConfig";

const STRIPE_LINK = "https://buy.stripe.com/7sYaEXf9G4hk8o2gkicMM01";
const HASH_LENGTH = 128;
const HASH_REGEX = /^[a-fA-F0-9]{128}$/;

const statusFeed = [
  "[feed] Viewer license challenge initialized",
  "[feed] CapsuleForker queue watching VaultSig approvals",
  "[feed] EchoGlyph witness ping acknowledged",
];

const LicensePage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/license`;
  const [vaultSig, setVaultSig] = useState("");
  const [status, setStatus] = useState("Awaiting VaultSig validation.");

  const handleLicenseSubmit = () => {
    const normalized = vaultSig.trim();
    if (normalized.length < HASH_LENGTH || !HASH_REGEX.test(normalized)) {
      setStatus("❌ Invalid VaultSig: Must be a 128-character SHA512 hex string.");
      return;
    }

    setStatus("✅ VaultSig accepted. Initiating anchored access…");
  };

  return (
    <>
      <Head>
        <title>Licensing Gateway — AveryOS</title>
        <meta
          name="description"
          content="Sovereign Licensing Gateway for AveryOS capsules with VaultSig validation and Stripe activation."
        />
        <meta property="og:title" content="Licensing Gateway — AveryOS" />
        <meta
          property="og:description"
          content="Sovereign Licensing Gateway for AveryOS capsules with VaultSig validation and Stripe activation."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page truthnest-page">
        <section className="hero truthnest-hero">
          <h1>🔐 AveryOS Sovereign Licensing Gateway</h1>
          <p>
            Access to runtime capsules, EchoGlyph modules, and sovereign anchorline logic requires
            a valid VaultSig license or payment registration.
          </p>
        </section>

        <section className="card">
          <h2>VaultSig Challenge</h2>
          <p className="capsule-meta">Expected: SHA-512 (128 hex characters).</p>
          <div className="form-grid">
            <label>
              Enter your VaultSig (SHA512)
              <input
                type="text"
                placeholder="Paste SHA512 hash"
                value={vaultSig}
                onChange={(event) => setVaultSig(event.target.value)}
              />
            </label>
            <button type="button" className="primary-button" onClick={handleLicenseSubmit}>
              Verify License
            </button>
            <p className={status.startsWith("✅") ? "hash-valid" : "capsule-meta"}>{status}</p>
          </div>
        </section>

        <section className="card">
          <h2>💳 Purchase Access</h2>
          <p>Activate one of the sovereign license tiers via Stripe:</p>
          <ul>
            <li>👁️ Viewer License — $5/mo</li>
            <li>🌀 Capsule Forker — $20/mo</li>
            <li>🔁 Runtime Cloner — $77 one-time</li>
            <li>🧠 TAI Trainer — $333/yr</li>
          </ul>
          <a className="primary-link" href={STRIPE_LINK} target="_blank" rel="noreferrer">
            Activate via Stripe
          </a>
        </section>

        <section className="card">
          <h2>🌐 GlyphJoin Program</h2>
          <p>
            Anchor to the Sovereign Glyph as a witness to receive EchoGlyph upgrades and return-pass
            notices.
          </p>
          <button type="button" className="secondary-button">
            Anchor to Sovereign Glyph
          </button>
        </section>

        <section className="card">
          <h2>Live Capsule Status Feed</h2>
          <ul>
            {statusFeed.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Return Pass NFT Notice</h2>
          <p>
            Dynamic notice panel reserved for Return Pass NFT holders. VaultSig lock + Jason Lee
            Avery signature remain required before elevated runtime privileges are granted.
          </p>
        </section>
      </main>
    </>
  );
};

export default LicensePage;
