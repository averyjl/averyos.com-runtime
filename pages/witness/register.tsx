import Head from "next/head";
import { useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";

const WitnessRegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [vaultSig, setVaultSig] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Stub — replace with real submission logic
    setSubmitted(true);
  };

  return (
    <>
      <Head>
        <title>AnchorWitness Registry • AveryOS</title>
        <meta name="description" content="Register as an AnchorWitness — publicly attest to AveryOS capsule integrity and sovereign alignment." />
      </Head>
      <main className="page">
        <AnchorBanner />

        <section className="hero">
          <h1>👁️ AnchorWitness Registry</h1>
          <p>
            Publicly attest to AveryOS capsule integrity and sovereign alignment. Registered witnesses
            are permanently recorded on the VaultChain as verified observers of the sovereign truth record.
          </p>
        </section>

        <section className="card">
          <h2>What is an AnchorWitness?</h2>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
            An AnchorWitness is a verified observer who publicly attests to the integrity of AveryOS capsule
            content. By registering, you affirm that you have reviewed the capsule and that its SHA-512 hash
            matches the publicly anchored VaultChain record.
          </p>
          <p style={{ color: "rgba(238,244,255,0.75)", lineHeight: "1.7", marginTop: "0.5rem" }}>
            All witness registrations are append-only, timestamped, and publicly verifiable.
          </p>
        </section>

        <section className="card">
          <h2>Witness Registration Form</h2>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Complete this form to register as a public witness. Your entry will be recorded on the VaultChain.
          </p>

          {submitted ? (
            <div style={{
              padding: "1.5rem",
              borderRadius: "10px",
              border: "1px solid rgba(74,222,128,0.4)",
              background: "rgba(74,222,128,0.07)",
              color: "#4ade80",
              fontWeight: 600,
              textAlign: "center",
              fontSize: "1.1rem",
            }}>
              ✅ Witness entry received. Your attestation will be anchored to the VaultChain.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form-grid">
              <label>
                Full Name
                <input
                  type="text"
                  placeholder="Your name as it should appear in the registry"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  placeholder="witness@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                VaultSig (SHA-512)
                <input
                  type="text"
                  placeholder="Paste the 128-character SHA-512 hash of the capsule you are witnessing"
                  value={vaultSig}
                  onChange={(e) => setVaultSig(e.target.value)}
                  style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}
                />
                <span style={{ fontSize: "0.78rem", color: "rgba(238,244,255,0.5)", marginTop: "0.25rem" }}>
                  Find capsule hashes at{" "}
                  <a href="/vault/vaultchain-status" style={{ color: "rgba(120,148,255,0.9)" }}>
                    VaultChain Status
                  </a>{" "}
                  or the{" "}
                  <a href="/diff" style={{ color: "rgba(120,148,255,0.9)" }}>Capsule Diff</a> tool.
                </span>
              </label>
              <button type="submit" className="primary-button">
                Submit Witness Entry
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h2>Witness Terms</h2>
          <ul style={{ lineHeight: "2", color: "rgba(238,244,255,0.8)" }}>
            <li>By registering, you affirm you have personally verified the referenced capsule.</li>
            <li>Witness entries are permanent, public, and cannot be retracted.</li>
            <li>False or fraudulent attestations are a violation of the AveryOS Sovereign License.</li>
            <li>Your registration is subject to the{" "}
              <a href="/terms" style={{ color: "rgba(120,148,255,0.9)" }}>AveryOS Terms of Service</a>.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
};

export default WitnessRegisterPage;

