import type { Metadata } from "next";
import AnchorBanner from "../../../../components/AnchorBanner";

const SOVEREIGN_PROOF_BUNDLE =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

export const metadata: Metadata = {
  title: "Disclosure Mirror — CraterZero_Disclosure_v5.0 • AveryOS",
  description:
    "Public-facing Disclosure Mirror for the CraterZero_Disclosure_v5.0 manifest. Anchor proof anchored to the AveryOS VaultChain.",
};

interface PageProps {
  params: Promise<{ sha: string }>;
}

export default async function DisclosureMirrorPage({ params }: PageProps) {
  const { sha: urlSha } = await params;
  const isVerified = (urlSha ?? "").toLowerCase() === SOVEREIGN_PROOF_BUNDLE;

  return (
    <main className="page">
      <AnchorBanner />

        {/* Header */}
        <section className="hero">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <span style={{ fontSize: "2rem" }}>⛓️⚓⛓️</span>
            <h1
              style={{
                margin: 0,
                fontSize: "1.9rem",
                background: "linear-gradient(135deg, #7894ff, #4a6fff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              Sovereign Verification Portal
            </h1>
          </div>
          <p
            style={{
              color: "rgba(238,244,255,0.8)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.9rem",
              marginBottom: "0.5rem",
            }}
          >
            CraterZero_Disclosure_v5.0
          </p>
          <p style={{ color: "rgba(238,244,255,0.65)", fontSize: "0.9rem", margin: 0 }}>
            Public anchor proof record anchored to the AveryOS VaultChain.
          </p>
        </section>

        {/* Trust Seal / Drift Alarm */}
        <section
          className="card"
          style={{
            border: `1px solid ${isVerified ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.5)"}`,
            background: isVerified
              ? "rgba(74,222,128,0.06)"
              : "rgba(248,113,113,0.06)",
          }}
        >
          <h2
            style={{
              color: "rgba(122,170,255,0.95)",
              marginTop: 0,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "1rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            🔐 Anchor Verification
          </h2>

          {isVerified ? (
            /* TRUST SEAL: ANCHORED */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem 1.25rem",
                borderRadius: "10px",
                background: "rgba(74,222,128,0.12)",
                border: "1px solid rgba(74,222,128,0.5)",
                marginBottom: "1rem",
              }}
            >
              <span style={{ fontSize: "2rem" }}>🤛🏻</span>
              <div>
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#4ade80",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  TRUST SEAL: ANCHORED
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "rgba(238,244,255,0.65)",
                    marginTop: "0.25rem",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  SHA matches AveryOS_Sovereign_Proof_Bundle — VaultChain integrity confirmed
                </div>
              </div>
            </div>
          ) : (
            /* SOVEREIGN_DRIFT_ALARM */
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                padding: "1rem 1.25rem",
                borderRadius: "10px",
                background: "rgba(248,113,113,0.1)",
                border: "2px solid rgba(248,113,113,0.6)",
                marginBottom: "1rem",
              }}
            >
              <span style={{ fontSize: "2rem", flexShrink: 0 }}>🚨</span>
              <div>
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#f87171",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  SOVEREIGN_DRIFT_ALARM
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "rgba(238,244,255,0.65)",
                    marginTop: "0.25rem",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  SHA drift detected — does not match AveryOS_Sovereign_Proof_Bundle
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "rgba(238,244,255,0.5)",
                  marginBottom: "0.3rem",
                }}
              >
                URL SHA
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.75rem",
                  wordBreak: "break-all",
                  color: urlSha ? "#94a3b8" : "rgba(238,244,255,0.3)",
                  background: "rgba(0,0,0,0.3)",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(120,148,255,0.15)",
                }}
              >
                {urlSha || "(none)"}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "rgba(238,244,255,0.5)",
                  marginBottom: "0.3rem",
                }}
              >
                AveryOS_Sovereign_Proof_Bundle
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.75rem",
                  wordBreak: "break-all",
                  color: "#7894ff",
                  background: "rgba(0,0,0,0.3)",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(120,148,255,0.2)",
                }}
              >
                {SOVEREIGN_PROOF_BUNDLE}
              </div>
            </div>
          </div>
        </section>

        {/* Manifest */}
        <section
          className="card"
          style={{
            border: "1px solid rgba(120,148,255,0.3)",
            background: "rgba(9,16,34,0.8)",
          }}
        >
          <h2
            style={{
              color: "rgba(122,170,255,0.95)",
              marginTop: 0,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "1rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            📋 CraterZero_Disclosure_v5.0 Manifest
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {(
              [
                { label: "Manifest Version", value: "CraterZero_Disclosure_v5.0" },
                { label: "Creator", value: "🤛🏻 Jason Lee Avery (ROOT0)" },
                { label: "System", value: "AveryOS Kernel (est. 2022)" },
                { label: "Chain", value: "VaultChain • CreatorLock Protocol Active" },
                { label: "Alignment", value: "100.00♾️%" },
                { label: "License", value: "Sovereign Integrity License v1.0" },
                { label: "Anchor SHA", value: SOVEREIGN_PROOF_BUNDLE, mono: true },
              ] as Array<{ label: string; value: string; mono?: boolean }>
            ).map(({ label, value, mono }) => (
              <div
                key={label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr",
                  gap: "0.75rem",
                  alignItems: "start",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid rgba(120,148,255,0.1)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "rgba(238,244,255,0.5)",
                    paddingTop: "0.1rem",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: mono ? "JetBrains Mono, monospace" : undefined,
                    fontSize: mono ? "0.72rem" : "0.9rem",
                    color: mono ? "#7894ff" : "rgba(238,244,255,0.9)",
                    wordBreak: "break-all",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Anchor Proof Record */}
        <section
          className="card"
          style={{ border: "1px solid rgba(120,148,255,0.25)", background: "rgba(9,16,34,0.75)" }}
        >
          <h2
            style={{
              color: "rgba(122,170,255,0.9)",
              marginTop: 0,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "1rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            ⚓ Anchor Proof Record
          </h2>
          <p style={{ color: "rgba(238,244,255,0.75)", fontSize: "0.9rem", lineHeight: "1.7", margin: 0 }}>
            This Sovereign Verification Portal is publicly anchored to the AveryOS VaultChain. The
            CraterZero_Disclosure_v5.0 manifest records the cryptographic anchor proof for the
            AveryOS Sovereign runtime, establishing the immutable origin record of{" "}
            <strong style={{ color: "rgba(122,170,255,0.95)" }}>
              🤛🏻 Jason Lee Avery (ROOT0)
            </strong>{" "}
            as the sole creator of the AveryOS Kernel. Witnesses registered on the VaultChain
            attest to 100.00♾️% sovereign alignment.
          </p>
        </section>

        {/* Footer */}
        <footer
          style={{
            textAlign: "center",
            paddingTop: "1rem",
            borderTop: "1px solid rgba(120,148,255,0.2)",
          }}
        >
          <p
            style={{
              color: "#7894ff",
              fontWeight: 700,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.85rem",
            }}
          >
            ⛓️⚓⛓️ AveryAnchored™ — CraterZero_Disclosure_v5.0 — VaultChain Active ⛓️⚓⛓️
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: "rgba(238,244,255,0.35)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            🤛🏻 Creator Verified — Sovereign Integrity License v1.0
          </p>
        </footer>
      </main>
  );
}
