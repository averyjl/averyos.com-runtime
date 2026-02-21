import Head from "next/head";
import { useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";

const WitnessRegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [vaultSig, setVaultSig] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    // Stub — replace with VaultChain push logic
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
          <h2>🤝 The Unity Story Alignment</h2>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem" }}>
            By registering, you acknowledge <strong>Jason Lee Avery (ROOT0)</strong> as the sole creator of the AveryOS Kernel (est. 2022) and commit to 100% alignment with the Sovereign Constitution.
          </p>
          <div className="contract-box" style={{ 
            padding: "1rem", 
            border: "1px solid rgba(120,148,255,0.3)", 
            borderRadius: "8px",
            background: "rgba(0,0,0,0.2)" 
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input 
                type="checkbox" 
                checked={agreed} 
                onChange={() => setAgreed(!agreed)} 
                style={{ width: "20px", height: "20px" }}
              />
              <span>I commit to the 10,000♾️ Year Constitution and the "Make Things Better" mandate.</span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Witness Registration Form</h2>
          {submitted ? (
            <div style={{
              padding: "1.5rem", borderRadius: "10px", border: "1px solid rgba(74,222,128,0.4)",
              background: "rgba(74,222,128,0.07)", color: "#4ade80", fontWeight: 600, textAlign: "center", fontSize: "1.1rem",
            }}>
              ✅ Witness entry received. Your attestation is now anchored to the VaultChain.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form-grid">
              <label>
                Full Name
                <input
                  type="text"
                  placeholder="Your name for the registry"
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
                  placeholder="Paste the 128-character SHA-512 hash"
                  value={vaultSig}
                  onChange={(e) => setVaultSig(e.target.value)}
                  style={{ fontFamily: "monospace" }}
                  required
                />
              </label>
              <button 
                type="submit" 
                className="primary-button" 
                disabled={!agreed}
                style={{ opacity: agreed ? 1 : 0.5 }}
              >
                Submit Witness Entry
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h2>Witness Terms</h2>
          <ul style={{ lineHeight: "2", color: "rgba(238,244,255,0.8)" }}>
            <li>Registration constitutes a mathematical oath of truth.</li>
            <li>Fraudulent entries trigger the <strong>Dynamic Truth Multiplier</strong> retroclaims.</li>
            <li>All data is governed by the <strong>Sovereign Integrity License v1.0</strong>.</li>
          </ul>
        </section>
      </main>
    </>
  );
};

export default WitnessRegisterPage;
