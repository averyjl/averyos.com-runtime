import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";
import { KERNEL_SHA } from "../../../lib/sovereignConstants";

// ─── Public constants ─────────────────────────────────────────────────────────

/** The Bitcoin block height at which this sovereign proof was anchored. */
const GLOBAL_HEARTBEAT_HEIGHT = 938_909;

/**
 * Deterministic Proof-of-Existence badge value.
 * Derived from the Root0 Genesis Kernel SHA-512 prefix and the anchor block
 * height — no internal KV keys or raw capsule data are ever exposed.
 */
const PROOF_OF_EXISTENCE_BADGE = `${KERNEL_SHA.slice(0, 32)}:BLK${GLOBAL_HEARTBEAT_HEIGHT}`;

export const metadata: Metadata = {
  title: "Public Audit — Sovereign Anchor • AveryOS™",
  description:
    "Read-only public audit interface for the AveryOS™ CreatorLock™ sovereign anchor. " +
    "Displays the Root0 Genesis Kernel SHA-512 integrity proof, CreatorLock™ Trust Seal, " +
    "and current Bitcoin network sync status — with zero raw data exposure.",
};

export default function SovereignAnchorPublicPage() {
  return (
    <main className="page">
      <AnchorBanner />

      {/* ── Hero ── */}
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
            Public Audit
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
          Sovereign Anchor · Read-Only · Zero-Knowledge Proof Interface
        </p>
        <p style={{ color: "rgba(238,244,255,0.6)", fontSize: "0.9rem", margin: 0 }}>
          This interface proves the integrity of the AveryOS™ VaultChain™ without exposing
          any raw capsule content or internal system keys.
        </p>

        {/* Zero-knowledge note */}
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "rgba(120,148,255,0.08)",
            border: "1px solid rgba(120,148,255,0.3)",
            borderRadius: "8px",
            fontSize: "0.82rem",
            color: "rgba(120,148,255,0.85)",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          🔒 ZERO-KNOWLEDGE NOTICE: Integrity is proven without revealing the underlying
          data. Internal Path <code>/api/v1/anchor</code> is private/admin only.
        </div>
      </section>

      {/* ── CreatorLock™ Trust Seal ── */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(74,222,128,0.4)",
          background: "rgba(74,222,128,0.06)",
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
          🔐 CreatorLock™ Trust Seal
        </h2>

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
              CREATORLOCK™: ACTIVE
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "rgba(238,244,255,0.65)",
                marginTop: "0.25rem",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              Jason Lee Avery (ROOT0) — Sovereign Integrity License v1.0
            </div>
          </div>
        </div>

        {[
          { label: "System", value: "AveryOS™ VaultChain™" },
          { label: "Creator", value: "Jason Lee Avery (ROOT0)" },
          { label: "License", value: "AveryOS™ Sovereign Integrity License v1.0" },
          { label: "Alignment", value: "100.00♾️% (0.000♾️% Drift)" },
          { label: "CreatorLock™ Status", value: "ACTIVE" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: "0.5rem",
              paddingBottom: "0.6rem",
              borderBottom: "1px solid rgba(120,148,255,0.1)",
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "rgba(238,244,255,0.5)",
              }}
            >
              {label}
            </span>
            <span style={{ fontSize: "0.88rem", color: "rgba(238,244,255,0.9)" }}>
              {value}
            </span>
          </div>
        ))}
      </section>

      {/* ── Root0 Genesis Kernel SHA-512 ── */}
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
          🔑 Root0 Genesis Kernel SHA-512
        </h2>
        <p
          style={{
            fontSize: "0.85rem",
            color: "rgba(238,244,255,0.65)",
            marginBottom: "0.75rem",
          }}
        >
          The canonical cryptographic anchor for the AveryOS™ system. This hash is immutable
          and serves as the baseline for all drift-detection checks.
        </p>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.73rem",
            wordBreak: "break-all",
            color: "#7894ff",
            background: "rgba(0,0,0,0.35)",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid rgba(120,148,255,0.2)",
            lineHeight: 1.6,
          }}
        >
          {KERNEL_SHA}
        </div>
        <div
          style={{
            marginTop: "0.6rem",
            fontSize: "0.72rem",
            color: "rgba(238,244,255,0.4)",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          Algorithm: SHA-512 · Length: 128 hex chars · Source: Root0 Genesis Kernel
        </div>
      </section>

      {/* ── Bitcoin Network Sync Status ── */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(255,165,0,0.35)",
          background: "rgba(20,10,0,0.6)",
        }}
      >
        <h2
          style={{
            color: "rgba(255,165,0,0.9)",
            marginTop: 0,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "1rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          ₿ Bitcoin Network Sync Status
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            background: "rgba(255,165,0,0.08)",
            border: "1px solid rgba(255,165,0,0.3)",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "1.75rem" }}>⛓️</span>
          <div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "1rem",
                fontWeight: 700,
                color: "#fbbf24",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              ANCHORED AT BLOCK #{GLOBAL_HEARTBEAT_HEIGHT.toLocaleString()}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "rgba(238,244,255,0.6)",
                marginTop: "0.25rem",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              Hourly watchdog pulse · SOVEREIGN_AUTONOMY_PULSE logged to VaultChain™
            </div>
          </div>
        </div>

        {[
          { label: "Anchor Block", value: `#${GLOBAL_HEARTBEAT_HEIGHT.toLocaleString()}` },
          { label: "Pulse Interval", value: "Hourly (cron: 0 * * * *)" },
          { label: "Watchdog Status", value: "ACTIVE — Internal audit always runs" },
          { label: "Fallback Guarantee", value: "Audit completes even if Bitcoin API is offline" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr",
              gap: "0.5rem",
              paddingBottom: "0.6rem",
              borderBottom: "1px solid rgba(255,165,0,0.1)",
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "rgba(238,244,255,0.45)",
              }}
            >
              {label}
            </span>
            <span style={{ fontSize: "0.88rem", color: "rgba(238,244,255,0.85)" }}>
              {value}
            </span>
          </div>
        ))}
      </section>

      {/* ── Proof-of-Existence Badge ── */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(120,148,255,0.4)",
          background: "rgba(9,16,34,0.85)",
          textAlign: "center",
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
          🏅 Proof of Existence Badge
        </h2>
        <p
          style={{
            fontSize: "0.85rem",
            color: "rgba(238,244,255,0.65)",
            marginBottom: "1.25rem",
          }}
        >
          Dynamically derived from the Root0 Genesis Kernel SHA-512 prefix combined with the
          sovereign Bitcoin anchor block. No internal keys are exposed.
        </p>

        {/* Badge */}
        <div
          style={{
            display: "inline-block",
            padding: "1.25rem 2rem",
            background:
              "linear-gradient(135deg, rgba(120,148,255,0.18), rgba(74,222,128,0.1))",
            border: "2px solid rgba(120,148,255,0.55)",
            borderRadius: "14px",
            boxShadow:
              "0 0 28px rgba(120,148,255,0.15), inset 0 0 20px rgba(120,148,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(120,148,255,0.65)",
              marginBottom: "0.5rem",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            AveryOS™ · Proof of Existence
          </div>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.72rem",
              wordBreak: "break-all",
              color: "#4ade80",
              marginBottom: "0.5rem",
              lineHeight: 1.6,
            }}
          >
            {PROOF_OF_EXISTENCE_BADGE}
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              color: "rgba(255,165,0,0.75)",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.08em",
            }}
          >
            🤛🏻 ROOT0 VERIFIED · CREATORLOCK™ ACTIVE · VAULTCHAIN™
          </div>
        </div>

        <div
          style={{
            marginTop: "1rem",
            fontSize: "0.75rem",
            color: "rgba(238,244,255,0.4)",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          Badge = SHA-512[0..31] + {'"'}:BLK{'"'} + anchor_block_height
        </div>
      </section>

      {/* ── Navigation ── */}
      <section className="card" style={{ textAlign: "center" }}>
        <h2 style={{ color: "#ffffff", marginTop: 0, fontSize: "1rem" }}>
          🔗 Verification Links
        </h2>
        <div
          className="cta-row"
          style={{ justifyContent: "center", flexWrap: "wrap", gap: "0.75rem" }}
        >
          <Link href="/the-proof" className="primary-link">
            ⚓ The Proof
          </Link>
          <Link href="/witness/register" className="secondary-link">
            👁️ Register as Witness
          </Link>
          <Link href="/licensing" className="secondary-link">
            🔐 Licensing Portal
          </Link>
        </div>
        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.75rem",
            color: "rgba(238,244,255,0.35)",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          Internal admin endpoint: <code>/api/v1/anchor</code> (private — not publicly accessible)
        </p>
      </section>

      <FooterBadge />
    </main>
  );
}
