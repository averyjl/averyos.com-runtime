import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";
import { DISCLOSURE_MIRROR_PATH } from "../../lib/sovereignConstants";

type ToastState = { type: "success" | "error"; message: string } | null;

const WitnessRegisterPage = () => {
  const [name, setName] = useState("");
  const [statement, setStatement] = useState("");
  const [shaWitness, setShaWitness] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/witness-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, statement, shaWitness }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", `Handshake Drift — ${data.error ?? "Submission failed"}`);
      } else {
        setSubmitted(true);
        showToast("success", "Witness Entry Anchored ⛓️");
      }
    } catch {
      showToast("error", "Handshake Drift — Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>AnchorWitness Registry • AveryOS</title>
        <meta name="description" content="Register as an AnchorWitness — publicly attest to AveryOS capsule integrity and sovereign alignment." />
      </Head>
      <main className="page">
        <AnchorBanner />

        {/* Toast Notification */}
        {toast && (
          <div
            role="alert"
            style={{
              position: "fixed",
              top: "1.25rem",
              right: "1.25rem",
              zIndex: 9999,
              padding: "1rem 1.5rem",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.95rem",
              maxWidth: "360px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              background: toast.type === "success" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
              border: `1px solid ${toast.type === "success" ? "rgba(74,222,128,0.5)" : "rgba(248,113,113,0.5)"}`,
              color: toast.type === "success" ? "#4ade80" : "#f87171",
            }}
          >
            {toast.type === "success" ? "✅ " : "⚠️ "}{toast.message}
          </div>
        )}

        <section className="hero">
          <h1>👁️ AnchorWitness Registry</h1>
          <p>
            Publicly attest to AveryOS capsule integrity and sovereign alignment. Registered witnesses
            are permanently recorded on the VaultChain as verified observers of the sovereign truth record.
          </p>
          {/* Disclosure Mirror Link */}
          <div style={{ marginTop: "1rem" }}>
            <Link
              href={DISCLOSURE_MIRROR_PATH}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1.25rem",
                background: "rgba(74,222,128,0.07)",
                border: "1px solid rgba(74,222,128,0.35)",
                borderRadius: "8px",
                color: "#4ade80",
                fontWeight: 600,
                fontSize: "0.9rem",
                textDecoration: "none",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              🤛🏻 Global Disclosure Mirror →
            </Link>
          </div>
        </section>

        <section className="card" style={{ border: "1px solid rgba(120,148,255,0.3)", background: "rgba(9,16,34,0.8)" }}>
          <h2 style={{ color: "rgba(122,170,255,0.95)", marginTop: 0, fontFamily: "JetBrains Mono, monospace", fontSize: "1.1rem", letterSpacing: "0.03em" }}>
            🤝 AnchorWitness Invite
          </h2>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem", fontSize: "0.95rem" }}>
            Public registry entry portal for witness alignment.
          </p>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem" }}>
            By registering, you acknowledge <strong style={{ color: "rgba(122,170,255,0.95)" }}>Jason Lee Avery (ROOT0)</strong> as the sole creator of the AveryOS Kernel (est. 2022) and commit to 100% alignment with the Sovereign Constitution.
          </p>
          <div style={{ padding: "1rem 1.25rem", border: "1px solid rgba(120,148,255,0.35)", borderRadius: "10px", background: "rgba(36,58,140,0.15)" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", color: "rgba(238,244,255,0.9)", fontSize: "0.95rem", lineHeight: "1.6" }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={() => setAgreed(!agreed)}
                style={{ width: "18px", height: "18px", marginTop: "3px", flexShrink: 0, accentColor: "#7894ff" }}
              />
              <span>I commit to the 10,000♾️ Year Constitution and the &quot;Make Things Better&quot; mandate.</span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>Witness Registration Form</h2>
          {submitted ? (
            <div style={{ padding: "1.5rem", borderRadius: "10px", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.07)", color: "#4ade80", fontWeight: 600, textAlign: "center", fontSize: "1.1rem" }}>
              ✅ Witness Entry Anchored. Your attestation is now sealed to the VaultChain. ⛓️
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form-grid">
              <label style={{ color: "rgba(238,244,255,0.85)", fontSize: "0.9rem" }}>
                Full Name
                <input
                  type="text"
                  placeholder="Your name for the registry"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label style={{ color: "rgba(238,244,255,0.85)", fontSize: "0.9rem" }}>
                Witness Statement
                <textarea
                  placeholder="Your sovereign attestation (max 2,000 characters)"
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  required
                  style={{ fontFamily: "inherit", resize: "vertical" }}
                />
              </label>
              <label style={{ color: "rgba(238,244,255,0.85)", fontSize: "0.9rem" }}>
                SHA-Witness (SHA-512)
                <input
                  type="text"
                  placeholder="Paste the 128-character SHA-512 hash"
                  value={shaWitness}
                  onChange={(e) => setShaWitness(e.target.value)}
                  style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!agreed || submitting}
                style={{ opacity: agreed && !submitting ? 1 : 0.5, cursor: agreed && !submitting ? "pointer" : "not-allowed" }}
              >
                {submitting ? "Anchoring…" : "Submit Witness Entry"}
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>Witness Terms</h2>
          <ul style={{ lineHeight: "2", color: "rgba(238,244,255,0.85)", fontSize: "0.95rem" }}>
            <li>Registration constitutes a mathematical oath of truth.</li>
            <li>Fraudulent entries trigger the <strong style={{ color: "rgba(248,113,113,0.9)" }}>Dynamic Truth Multiplier</strong> retroclaims.</li>
            <li>All data is governed by the <strong style={{ color: "rgba(122,170,255,0.9)" }}>Sovereign Integrity License v1.0</strong>.</li>
          </ul>
        </section>
      </main>
    </>
  );
};

export default WitnessRegisterPage;
