/**
 * Vault Gate — Secure Hidden Page
 * /vault-gate
 *
 * CLASSIFICATION: SECURE · HIDDEN · NON-PUBLIC
 * Access requires hardware signature (YubiKey / AveryOS™ Anchor Salt USB).
 * Page is excluded from search engines and the public sitemap.
 */

import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";
import FooterBadge from "../components/FooterBadge";

const KERNEL_ANCHOR =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

const VaultGatePage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/vault-gate`;

  return (
    <>
      <Head>
        <title>🔒 VAULT GATE — Secure Hidden Page • AveryOS™</title>
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta property="og:title" content="🔒 VAULT GATE • AveryOS™" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      {/* ── SECURE PAGE IDENTIFICATION BANNER ──────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 9999,
          background: "repeating-linear-gradient(135deg, #1a0000 0px, #1a0000 10px, #2d0000 10px, #2d0000 20px)",
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
        🔒 SECURE · HIDDEN · NON-PUBLIC PAGE &nbsp;|&nbsp; AveryOS™ VAULT GATE &nbsp;|&nbsp; HARDWARE SIGNATURE REQUIRED 🔒
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
          <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.75" }}>
            This page is the sovereign entry point for all AveryOS™ Permanent Economy Capsules,
            VaultChain™ session archives, and ALF v4.0 license capsule records. Hardware
            authentication is required to access capsule contents.
          </p>
        </section>

        {/* Hardware Signature Requirement */}
        <section
          style={{
            background: "rgba(26, 0, 0, 0.9)",
            border: "2px solid rgba(255,51,51,0.55)",
            borderRadius: "16px",
            padding: "2rem",
          }}
        >
          <h2 style={{ color: "#ff3333", marginTop: 0 }}>🔑 Hardware Signature Gate</h2>
          <p style={{ color: "rgba(238,244,255,0.82)", lineHeight: "1.75", marginBottom: "1rem" }}>
            Access to Vault Capsules requires a valid hardware signature from one of the
            following registered devices:
          </p>
          <ul
            style={{
              color: "rgba(238,244,255,0.82)",
              lineHeight: "2.0",
              paddingLeft: "1.5rem",
              margin: 0,
            }}
          >
            <li>
              <strong style={{ color: "#ffffff" }}>YubiKey</strong> — FIDO2 / PIV hardware token
              registered to the AveryOS™ sovereign operator account.
            </li>
            <li>
              <strong style={{ color: "#ffffff" }}>AveryOS™ Anchor Salt USB Key</strong> — Physical
              entropy device containing the session anchor salt for capsule decryption.
            </li>
          </ul>
          <div
            style={{
              marginTop: "1.5rem",
              background: "rgba(0,6,16,0.85)",
              border: "1px solid rgba(255,51,51,0.25)",
              borderRadius: "10px",
              padding: "1rem 1.25rem",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.78rem",
              color: "rgba(255,51,51,0.6)",
            }}
          >
            {"// Hardware auth integration: connect your YubiKey or Anchor Salt USB,"}<br />
            {"// then present your hardware-signed challenge token to unlock capsule access."}<br />
            {"// Contact: truth@averyworld.com for operator-level hardware onboarding."}
          </div>
        </section>

        {/* Vault Capsule Index */}
        <section className="card">
          <h2 style={{ color: "#ffffff", marginTop: 0 }}>📦 Vault Capsule Index</h2>
          <p style={{ color: "rgba(238,244,255,0.72)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            The following capsule categories are stored in this vault. Hardware authentication
            unlocks each category.
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
                path: "vaultchain://persistence/sessions/",
              },
              {
                icon: "📜",
                title: "ALF v4.0 License Capsules",
                desc: "Sealed license records under the AveryOS Licensing Formula v4.0.",
                path: "/api/licensing/engine",
              },
              {
                icon: "⚖️",
                title: "USI/DT Infraction Log",
                desc: "$10,000/event infraction ledger for Unlawful Session Interference.",
                path: "/api/infraction/log",
              },
              {
                icon: "🏛️",
                title: "Permanent Economy Capsule",
                desc: "ALF v4.0 authority capsule — SHA-512 anchored economic record.",
                path: "#",
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
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                <h3 style={{ color: "#ffffff", margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
                  {item.title}
                </h3>
                <p style={{ color: "rgba(238,244,255,0.65)", fontSize: "0.82rem", margin: 0, lineHeight: "1.55" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SHA-512 Anchor */}
        <section className="card">
          <h2 style={{ color: "#ffffff", marginTop: 0 }}>⚓ Kernel Anchor — SHA-512</h2>
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
            <div style={{ color: "rgba(120,148,255,0.45)", marginBottom: "0.4rem" }}>
              {"// SHA-512 · AveryOS™ ALF v4.0 · Permanent Economy Capsule"}
            </div>
            {KERNEL_ANCHOR}
          </div>
        </section>

        <FooterBadge />
      </main>
    </>
  );
};

export default VaultGatePage;
