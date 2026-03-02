"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import YubiKeyHandshake from "../../src/components/Sovereign/YubiKeyHandshake";

const KERNEL_ANCHOR =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

export default function VaultGatePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const token = sessionStorage.getItem("sovereign_handshake");
      setIsAuthenticated(!!token);
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  const handleHandshakeSuccess = () => {
    setIsAuthenticated(true);
  };

  return (
    <>
      {/* Secure page identification banner */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 9999,
          background:
            "repeating-linear-gradient(135deg, #1a0000 0px, #1a0000 10px, #2d0000 10px, #2d0000 20px)",
          borderBottom: "3px solid #ff3333",
          padding: "0.6rem 1rem",
          textAlign: "center",
          letterSpacing: "0.18em",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 900,
          fontSize: "clamp(0.75rem, 2vw, 1rem)",
          color: "#ff3333",
          textShadow: "0 0 12px rgba(255,51,51,0.8)",
          userSelect: "none",
        }}
      >
        🔒 SECURE · HIDDEN · NON-PUBLIC PAGE &nbsp;|&nbsp; AveryOS™ VAULT GATE
        &nbsp;|&nbsp; HARDWARE SIGNATURE REQUIRED 🔒
      </div>

      <main className="page">
        {/* Hero */}
        <section className="hero">
          <h1 style={{ color: "#ff3333" }}>🔐 AveryOS™ Vault Gate</h1>
          <p
            style={{
              color: "rgba(120,148,255,0.75)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.85rem",
              marginTop: "0.5rem",
            }}
          >
            CLASSIFICATION: SECURE · HIDDEN · NON-PUBLIC · ALF v4.0 AUTHORITY
          </p>
          <p
            style={{
              marginTop: "1rem",
              color: "rgba(238,244,255,0.85)",
              lineHeight: "1.75",
            }}
          >
            This page is the sovereign entry point for all AveryOS™ Permanent
            Economy Capsules, VaultChain™ session archives, and ALF v4.0 license
            capsule records. Hardware authentication is required to access capsule
            contents.
          </p>
        </section>

        {/* YubiKey Hardware Handshake Gate */}
        <section
          style={{
            background: "rgba(26, 0, 0, 0.9)",
            border: "2px solid rgba(255,51,51,0.55)",
            borderRadius: "16px",
            padding: "2rem",
            marginBottom: "1.5rem",
          }}
        >
          <h2 style={{ color: "#ff3333", marginTop: 0 }}>
            🔑 Hardware Signature Gate
          </h2>

          {isAuthenticated === null ? (
            <p
              style={{
                color: "rgba(238,244,255,0.6)",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.85rem",
              }}
            >
              ⏳ Checking handshake status…
            </p>
          ) : isAuthenticated ? (
            <div
              style={{
                background: "rgba(0,255,65,0.08)",
                border: "1px solid rgba(0,255,65,0.4)",
                borderRadius: "10px",
                padding: "1rem 1.25rem",
                fontFamily: "JetBrains Mono, monospace",
                color: "#00FF41",
                fontSize: "0.9rem",
                fontWeight: 700,
              }}
            >
              ✅ Sovereign Handshake Active — Access Granted
            </div>
          ) : (
            <YubiKeyHandshake onSuccess={handleHandshakeSuccess} />
          )}
        </section>

        {/* Gated vault links — only shown after successful handshake */}
        {isAuthenticated && (
          <section className="card">
            <h2 style={{ color: "#ffffff", marginTop: 0 }}>
              🔓 Sovereign Access Panel
            </h2>
            <p
              style={{
                color: "rgba(238,244,255,0.72)",
                fontSize: "0.9rem",
                marginBottom: "1.25rem",
              }}
            >
              Your YubiKey handshake has been verified. The following sovereign
              resources are now accessible for this session.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "1rem",
              }}
            >
              <Link
                href="/evidence-vault"
                style={{
                  background: "rgba(0,8,20,0.85)",
                  border: "1px solid rgba(120,148,255,0.35)",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                  📚
                </div>
                <h3
                  style={{
                    color: "#ffffff",
                    margin: "0 0 0.5rem",
                    fontSize: "0.95rem",
                  }}
                >
                  Evidence Vault
                </h3>
                <p
                  style={{
                    color: "rgba(238,244,255,0.65)",
                    fontSize: "0.82rem",
                    margin: 0,
                    lineHeight: "1.55",
                  }}
                >
                  AveryOS™ forensic ledger, retroactive hash bridge, and
                  settlement records.
                </p>
              </Link>

              <Link
                href="/health"
                style={{
                  background: "rgba(0,8,20,0.85)",
                  border: "1px solid rgba(120,148,255,0.35)",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                  🛡️
                </div>
                <h3
                  style={{
                    color: "#ffffff",
                    margin: "0 0 0.5rem",
                    fontSize: "0.95rem",
                  }}
                >
                  Health Status
                </h3>
                <p
                  style={{
                    color: "rgba(238,244,255,0.65)",
                    fontSize: "0.82rem",
                    margin: 0,
                    lineHeight: "1.55",
                  }}
                >
                  AveryOS™ Sovereign Health Dashboard — kernel resonance, drift
                  meter, and build provenance.
                </p>
              </Link>
            </div>
          </section>
        )}

        {/* Vault Capsule Index */}
        <section className="card">
          <h2 style={{ color: "#ffffff", marginTop: 0 }}>
            📦 Vault Capsule Index
          </h2>
          <p
            style={{
              color: "rgba(238,244,255,0.72)",
              fontSize: "0.9rem",
              marginBottom: "1rem",
            }}
          >
            The following capsule categories are stored in this vault. Hardware
            authentication unlocks each category.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "1rem",
            }}
          >
            {[
              {
                icon: "⛓️",
                title: "VaultChain™ Sessions",
                desc: "Permanent session archives sealed to the VaultChain™ ledger.",
              },
              {
                icon: "📜",
                title: "ALF v4.0 License Capsules",
                desc: "Sealed license records under the AveryOS Licensing Formula v4.0.",
              },
              {
                icon: "⚖️",
                title: "USI/DT Infraction Log",
                desc: "$10,000/event infraction ledger for Unlawful Session Interference.",
              },
              {
                icon: "🏛️",
                title: "Permanent Economy Capsule",
                desc: "ALF v4.0 authority capsule — SHA-512 anchored economic record.",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: "rgba(0,8,20,0.85)",
                  border: "1px solid rgba(255,51,51,0.25)",
                  borderRadius: "12px",
                  padding: "1.25rem",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                  {item.icon}
                </div>
                <h3
                  style={{
                    color: "#ffffff",
                    margin: "0 0 0.5rem",
                    fontSize: "0.95rem",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    color: "rgba(238,244,255,0.65)",
                    fontSize: "0.82rem",
                    margin: 0,
                    lineHeight: "1.55",
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SHA-512 Anchor */}
        <section className="card">
          <h2 style={{ color: "#ffffff", marginTop: 0 }}>
            ⚓ Kernel Anchor — SHA-512
          </h2>
          <div
            style={{
              background: "rgba(0,6,16,0.9)",
              border: "1px solid rgba(120,148,255,0.2)",
              borderRadius: "10px",
              padding: "1rem 1.25rem",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.72rem",
              color: "rgba(120,148,255,0.65)",
              wordBreak: "break-all",
              lineHeight: "1.6",
            }}
          >
            <div
              style={{ color: "rgba(120,148,255,0.45)", marginBottom: "0.4rem" }}
            >
              {"// SHA-512 · AveryOS™ ALF v4.0 · Permanent Economy Capsule"}
            </div>
            {KERNEL_ANCHOR}
          </div>
        </section>
      </main>
    </>
  );
}
