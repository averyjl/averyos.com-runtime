"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function EvidenceVaultLogin() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/gatekeeper/handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });

      if (res.ok) {
        // Store sovereign handshake token in session
        sessionStorage.setItem("sovereign_handshake", "GRANTED");
        router.push("/evidence-vault");
      } else if (res.status === 503) {
        setError("⛔ VAULT_NOT_CONFIGURED: Sovereign vault is not configured. Contact the administrator.");
      } else if (res.status === 401) {
        setError("⛔ SOVEREIGN_HANDSHAKE_DENIED: Invalid passphrase. Verify and try again.");
      } else {
        setError("⛔ HANDSHAKE_ERROR: Could not complete verification. Try again.");
      }
    } catch {
      setError("⛔ CONNECTION_ERROR: Could not reach the handshake endpoint.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <h1>🔐 Evidence Vault — Sovereign Handshake</h1>
        <p className="auth-seal">GabrielOS™ Access Gate · AveryOS™ Evidence Vault</p>
        <p
          style={{
            marginTop: "1rem",
            color: "rgba(238,244,255,0.85)",
            lineHeight: "1.7",
          }}
        >
          Enter the Sovereign Passphrase to access the Evidence Vault.
        </p>
      </section>

      <section
        className="card"
        style={{ maxWidth: "480px", margin: "0 auto", border: "2px solid rgba(255,215,0,0.4)" }}
      >
        <h2 style={{ color: "#FFD700", marginTop: 0, fontFamily: "JetBrains Mono, monospace", fontSize: "1rem" }}>
          ⛓️ GabrielOS™ Handshake Terminal
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              htmlFor="passphrase"
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(120,148,255,0.7)",
                display: "block",
                marginBottom: "0.4rem",
              }}
            >
              Sovereign Passphrase
            </label>
            <input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                background: "#000",
                border: "1px solid rgba(120,148,255,0.4)",
                borderRadius: "6px",
                padding: "0.6rem 0.8rem",
                color: "#ffffff",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.9rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p
              style={{
                color: "#f87171",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.8rem",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "rgba(255,215,0,0.1)" : "rgba(255,215,0,0.2)",
              border: "1px solid #FFD700",
              color: "#FFD700",
              padding: "0.65rem 1.25rem",
              borderRadius: "8px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "VERIFYING…" : "INITIATE SOVEREIGN HANDSHAKE"}
          </button>
        </form>
      </section>
    </main>
  );
}
