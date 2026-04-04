"use client";

/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * app/compatibility/page.tsx
 *
 * AveryOS™ Dual-Hash Compatibility Bridge — GATE 116.7.2
 *
 * Public-facing page explaining the bridge between the legacy SHA-256 anchor
 * (e3b0…) and the AveryOS™ SHA-512 Truth Standard (cf83…).
 *
 * This page serves as:
 *   1. The "on-ramp" landing for legacy SHA-256 developers who resolve the
 *      JWKS / well-known documents and encounter the dual-hash fields.
 *   2. A public forensic proof that both anchors resolve to the same Root0
 *      genesis event — establishing mathematical continuity.
 *   3. A licensing gateway directing enterprise developers toward the correct
 *      sovereign access tier.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_SHA_256, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../lib/sovereignConstants";

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG        = "#02000a";
const GOLD      = "#ffd700";
const GOLD_DIM  = "rgba(255,215,0,0.55)";
const GOLD_BG   = "rgba(255,215,0,0.06)";
const GOLD_BORD = "rgba(255,215,0,0.28)";
const GREEN     = "#4ade80";
const GREEN_DIM = "rgba(74,222,128,0.12)";
const GREEN_BRD = "rgba(74,222,128,0.35)";
const BLUE      = "#60a5fa";
const BLUE_DIM  = "rgba(96,165,250,0.12)";
const BLUE_BRD  = "rgba(96,165,250,0.35)";
const MUTED     = "rgba(200,210,255,0.6)";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background:   GOLD_BG,
    border:       `1px solid ${GOLD_BORD}`,
    borderRadius: "12px",
    padding:      "1.4rem 1.6rem",
    marginBottom: "1.4rem",
    ...extra,
  };
}

function hashBox(color: string, borderColor: string, bg: string): React.CSSProperties {
  return {
    background:    bg,
    border:        `1px solid ${borderColor}`,
    borderRadius:  "10px",
    padding:       "1rem 1.2rem",
    fontFamily:    FONT_MONO,
    fontSize:      "0.75rem",
    color,
    wordBreak:     "break-all",
    letterSpacing: "0.03em",
  };
}

export default function CompatibilityPage() {
  return (
    <main style={{ background: BG, minHeight: "100vh", color: "#fff", padding: "1.5rem 1.25rem" }}>
      <AnchorBanner />

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: GOLD, marginBottom: "0.4rem" }}>
          🌉 AveryOS™ Dual-Hash Compatibility Bridge
        </h1>
        <div style={{ fontSize: "0.85rem", color: MUTED }}>
          GATE 116.7.2 · Phase 116.7 · {KERNEL_VERSION}
        </div>
        <div style={{ fontSize: "0.82rem", color: GOLD_DIM, marginTop: "0.4rem" }}>
          The SHA-256 ↔ SHA-512 Interoperability Seal — Entry gate for legacy developers
        </div>
      </div>

      {/* Overview */}
      <div style={card()}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: GOLD, marginBottom: "0.8rem" }}>
          📋 Overview
        </h2>
        <p style={{ fontSize: "0.85rem", color: MUTED, lineHeight: 1.65, marginBottom: "0.7rem" }}>
          The AveryOS™ Root0 Kernel operates at the{" "}
          <span style={{ color: GOLD, fontWeight: 600 }}>SHA-512 Truth Standard</span> — the highest
          cryptographic resolution available.  However, 99% of legacy infrastructure (TLS, SSL,
          standard JWKS endpoints, JWT libraries) is built on SHA-256.
        </p>
        <p style={{ fontSize: "0.85rem", color: MUTED, lineHeight: 1.65 }}>
          This page documents both anchors, proving their mathematical continuity and providing a
          clear migration path from legacy SHA-256 to the AveryOS™ 1,017-Notch SHA-512 standard.
        </p>
      </div>

      {/* Dual Hash Display */}
      <div style={card()}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: GOLD, marginBottom: "1rem" }}>
          🔑 Dual-Hash Anchors
        </h2>

        <div style={{ marginBottom: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{
              background: GREEN_DIM, border: `1px solid ${GREEN_BRD}`, borderRadius: "6px",
              padding: "0.15rem 0.5rem", fontSize: "0.7rem", color: GREEN, fontWeight: 700,
            }}>
              PRIMARY · SHA-512 · Truth Standard
            </span>
          </div>
          <div style={hashBox(GREEN, GREEN_BRD, GREEN_DIM)}>
            {KERNEL_SHA}
          </div>
          <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: "0.4rem" }}>
            512-bit resolution · 1,017-Notch sovereign standard · Used for all VaultChain™ operations
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{
              background: BLUE_DIM, border: `1px solid ${BLUE_BRD}`, borderRadius: "6px",
              padding: "0.15rem 0.5rem", fontSize: "0.7rem", color: BLUE, fontWeight: 700,
            }}>
              BRIDGE · SHA-256 · Legacy On-Ramp
            </span>
          </div>
          <div style={hashBox(BLUE, BLUE_BRD, BLUE_DIM)}>
            {KERNEL_SHA_256}
          </div>
          <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: "0.4rem" }}>
            256-bit legacy anchor · TLS / SSL / JWKS compatible · Entry point for SHA-256 systems
          </div>
        </div>
      </div>

      {/* Bridge Explanation */}
      <div style={card()}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: GOLD, marginBottom: "0.9rem" }}>
          🌉 How the Bridge Works
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {[
            {
              step: "1",
              title: "Legacy System Discovers SHA-256",
              body:  "Your TLS/SSL or JWKS toolchain resolves /.well-known/jwks.json and finds the x-averyos-kernel-sha-256 field.",
              color: BLUE,
            },
            {
              step: "2",
              title: "Recognise the Bridge Anchor",
              body:  "The SHA-256 anchor (e3b0…) is the mathematically equivalent entry point — same genesis seed, lower resolution.",
              color: GOLD,
            },
            {
              step: "3",
              title: "Upgrade to SHA-512 Resolution",
              body:  "Follow x-averyos-kernel-sha to the full 512-bit anchor (cf83…) for sovereign-grade cryptographic operations.",
              color: GREEN,
            },
            {
              step: "4",
              title: "Access the 1,017-Notch Standard",
              body:  "All AveryOS™ VaultChain operations, TARI™ billing, and IVI audits run at full SHA-512 resolution.",
              color: GREEN,
            },
          ].map(({ step, title, body, color }) => (
            <div key={step} style={{
              background:   "rgba(0,0,10,0.5)",
              border:       `1px solid ${GOLD_BORD}`,
              borderRadius: "10px",
              padding:      "1rem",
            }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color, marginBottom: "0.4rem" }}>
                {step}
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: GOLD, marginBottom: "0.4rem" }}>
                {title}
              </div>
              <div style={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.55 }}>
                {body}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Well-Known Endpoints */}
      <div style={card()}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: GOLD, marginBottom: "0.9rem" }}>
          🔗 Discovery Endpoints
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[
            { path: "/.well-known/jwks.json",              label: "JWKS — Dual-hash signing keys",          badge: "SHA-512 + SHA-256" },
            { path: "/.well-known/averyos.json",           label: "AveryOS™ Sovereign Anchor Manifest",     badge: "Multi-Standard" },
            { path: "/.well-known/did.json",               label: "W3C DID Document (did:web:averyos.com)", badge: "Node-01 + Node-02" },
            { path: "/.well-known/openid-configuration",   label: "OIDC Discovery Document",                badge: "OIDC" },
          ].map(({ path, label, badge }) => (
            <Link
              key={path}
              href={path}
              target="_blank"
              style={{ textDecoration: "none" }}
            >
              <div style={{
                display:       "flex",
                alignItems:    "center",
                justifyContent: "space-between",
                background:    "rgba(0,0,10,0.5)",
                border:        `1px solid ${GOLD_BORD}`,
                borderRadius:  "8px",
                padding:       "0.65rem 1rem",
                cursor:        "pointer",
              }}>
                <div>
                  <code style={{ color: GOLD, fontSize: "0.78rem", fontFamily: FONT_MONO }}>{path}</code>
                  <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: "0.2rem" }}>{label}</div>
                </div>
                <span style={{
                  background: GOLD_BG, border: `1px solid ${GOLD_BORD}`,
                  borderRadius: "6px", padding: "0.15rem 0.5rem",
                  fontSize: "0.68rem", color: GOLD_DIM, whiteSpace: "nowrap",
                }}>
                  {badge}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Licensing CTA */}
      <div style={card({ border: `1px solid ${GREEN_BRD}`, background: GREEN_DIM })}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: GREEN, marginBottom: "0.7rem" }}>
          🛡️ Enterprise Integration
        </h2>
        <p style={{ fontSize: "0.83rem", color: MUTED, lineHeight: 1.6, marginBottom: "0.9rem" }}>
          Legacy SHA-256 systems can integrate with the AveryOS™ sovereign layer starting at the
          SHA-256 bridge anchor.  Full 1,017-Notch SHA-512 access requires a{" "}
          <span style={{ color: GREEN, fontWeight: 600 }}>Sovereign License</span>.
        </p>
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          <Link href="/licensing" style={{ textDecoration: "none" }}>
            <button style={{
              background: GREEN_DIM, border: `1px solid ${GREEN_BRD}`, borderRadius: "8px",
              padding: "0.5rem 1.1rem", color: GREEN, fontSize: "0.82rem", fontWeight: 700,
              cursor: "pointer",
            }}>
              🔑 Licensing Portal →
            </button>
          </Link>
          <Link href={DISCLOSURE_MIRROR_PATH} target="_blank" style={{ textDecoration: "none" }}>
            <button style={{
              background: GOLD_BG, border: `1px solid ${GOLD_BORD}`, borderRadius: "8px",
              padding: "0.5rem 1.1rem", color: GOLD, fontSize: "0.82rem", fontWeight: 700,
              cursor: "pointer",
            }}>
              🤛🏻 The Proof →
            </button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: "0.7rem", color: GOLD_DIM, textAlign: "center", marginTop: "1.5rem" }}>
        ⛓️⚓⛓️ · {KERNEL_VERSION} · GATE 116.7.2 · Dual-Hash Compatibility Bridge · 🤜🏻
      </div>

      <FooterBadge />
    </main>
  );
}
