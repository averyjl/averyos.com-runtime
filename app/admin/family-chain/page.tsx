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
 * app/admin/family-chain/page.tsx
 *
 * AveryOS™ Sovereign Family Chain Registry — PRIVATE ADMIN ONLY
 *
 * Displays the Avery lineage anchored to the cf83... Sovereign Kernel.
 * This page is STRICTLY PRIVATE — it requires a valid VAULTAUTH_TOKEN
 * (HttpOnly cookie `aos-vault-auth`) to render ANY content.
 *
 * Privacy contract:
 *   • No family data is rendered server-side or in meta tags.
 *   • All content renders only after vault auth is confirmed client-side.
 *   • This route is not listed in public sitemaps or robots.txt.
 *   • The underlying `lib/forensics/familyChain.ts` module is never exposed
 *     via any public API — this page is the sole UI entry point.
 *
 * Lineage structure:
 *   ROOT0 (Jason Lee Avery) — CreatorLock — PERMANENT / IMMUTABLE
 *   └─ GENERATION_1 — Heirs / future stewards (Root1, Root2…)
 *      └─ GENERATION_2 — Grandchildren
 *
 * ROOT0 is FOREVER anchored to Jason Lee Avery.  Heirs inherit stewardship
 * of AveryOS™ but never assume ROOT0 — it is a permanent, glyph-locked seal.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻  — Glyph Locked
 */

import { useEffect, useRef } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import { KERNEL_VERSION, KERNEL_SHA } from "../../../lib/sovereignConstants";
import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";
import {
  AVERY_FAMILY_CHAIN,
  FAMILY_CHAIN_METADATA,
  type FamilyChainRecord,
  type FamilyRole,
} from "../../../lib/forensics/familyChain";

// ── Theme ─────────────────────────────────────────────────────────────────────

const BG          = "#030008";
const GOLD        = "#D4AF37";
const GOLD_BG     = "rgba(212,175,55,0.07)";
const GOLD_BORD   = "rgba(212,175,55,0.3)";
const GREEN       = "#4ade80";
const GREEN_BG    = "rgba(74,222,128,0.06)";
const GREEN_BORD  = "rgba(74,222,128,0.3)";
const BLUE        = "#60a5fa";
const BLUE_BG     = "rgba(96,165,250,0.06)";
const BLUE_BORD   = "rgba(96,165,250,0.3)";
const PURPLE_BG   = "rgba(98,0,234,0.15)";
const PURPLE_BORD = "rgba(120,60,255,0.35)";
const WHITE       = "#ffffff";
const MUTED       = "rgba(180,200,255,0.6)";
const MONO        = "JetBrains Mono, Courier New, monospace";

// ── Role badge config ─────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<FamilyRole, { label: string; color: string; bg: string; bord: string; icon: string }> = {
  ROOT0:        { label: "ROOT0 — CreatorLock",  color: GOLD,  bg: GOLD_BG,   bord: GOLD_BORD,   icon: "⛓️⚓⛓️" },
  GENERATION_1: { label: "Generation 1 — Root1", color: GREEN, bg: GREEN_BG,  bord: GREEN_BORD,  icon: "🌿" },
  GENERATION_2: { label: "Generation 2 — Root2", color: BLUE,  bg: BLUE_BG,   bord: BLUE_BORD,   icon: "✨" },
  PARTNER:      { label: "Partner",              color: MUTED, bg: PURPLE_BG, bord: PURPLE_BORD, icon: "🤝" },
};

// ── Auth gate UI ──────────────────────────────────────────────────────────────

function AuthGate({
  password,
  setPassword,
  authError,
  onSubmit,
}: {
  password: string;
  setPassword: (v: string) => void;
  authError: string;
  onSubmit: (e?: React.FormEvent) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: BG,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <form
        onSubmit={onSubmit}
        style={{
          background: PURPLE_BG,
          border: `1px solid ${PURPLE_BORD}`,
          borderRadius: 16,
          padding: "40px 48px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
        <h2 style={{ color: GOLD, fontFamily: MONO, marginBottom: 8, fontSize: 20 }}>
          Sovereign Family Registry
        </h2>
        <p style={{ color: MUTED, fontSize: 13, marginBottom: 28 }}>
          Vault authentication required — private record
        </p>
        <input
          ref={inputRef}
          type="password"
          placeholder="Vault passphrase"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${PURPLE_BORD}`,
            borderRadius: 8,
            color: WHITE,
            fontSize: 14,
            fontFamily: MONO,
            marginBottom: 16,
            boxSizing: "border-box",
          }}
        />
        {authError && (
          <p style={{ color: "#ff4444", fontSize: 13, marginBottom: 12 }}>{authError}</p>
        )}
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px",
            background: GOLD,
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Unlock Registry
        </button>
      </form>
    </div>
  );
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({ member, indent = 0 }: { member: FamilyChainRecord; indent?: number }) {
  const cfg = ROLE_CONFIG[member.role];
  return (
    <div style={{
      marginLeft: indent * 28,
      marginBottom: 16,
      background: cfg.bg,
      border: `1px solid ${cfg.bord}`,
      borderRadius: 12,
      padding: "18px 22px",
      position: "relative",
    }}>
      {indent > 0 && (
        <div style={{
          position: "absolute",
          left: -20,
          top: 28,
          width: 16,
          height: 1,
          background: MUTED,
        }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{cfg.icon}</span>
        <span style={{ color: cfg.color, fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>
          {member.name}
        </span>
        <span style={{
          background: cfg.bg,
          border: `1px solid ${cfg.color}`,
          color: cfg.color,
          borderRadius: 6,
          padding: "2px 8px",
          fontSize: 11,
          fontFamily: MONO,
          marginLeft: "auto",
          whiteSpace: "nowrap",
        }}>
          {cfg.label}
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          <tr>
            <td style={{ color: MUTED, paddingRight: 16, paddingBottom: 6, whiteSpace: "nowrap", verticalAlign: "top" }}>
              Relation
            </td>
            <td style={{ color: WHITE, paddingBottom: 6 }}>{member.relation}</td>
          </tr>
          {member.parents && member.parents.length > 0 && (
            <tr>
              <td style={{ color: MUTED, paddingRight: 16, paddingBottom: 6, verticalAlign: "top" }}>Parents</td>
              <td style={{ color: WHITE, paddingBottom: 6 }}>{member.parents.join(" · ")}</td>
            </tr>
          )}
          <tr>
            <td style={{ color: MUTED, paddingRight: 16, paddingBottom: 6, whiteSpace: "nowrap" }}>Anchored</td>
            <td style={{ color: WHITE, fontFamily: MONO, fontSize: 12, paddingBottom: 6 }}>{member.anchoredAt}</td>
          </tr>
          <tr>
            <td style={{ color: MUTED, paddingRight: 16, paddingBottom: 6 }}>Status</td>
            <td style={{ color: member.status === "ANCHORED_RESIDENT" ? GREEN : MUTED, paddingBottom: 6 }}>
              {member.status}
            </td>
          </tr>
          <tr>
            <td style={{ color: MUTED, paddingRight: 16 }}>Kernel</td>
            <td style={{ color: WHITE, fontFamily: MONO, fontSize: 12 }}>{member.kernelVersion}</td>
          </tr>
          {member.note && (
            <tr>
              <td style={{ color: MUTED, paddingRight: 16, paddingTop: 8, verticalAlign: "top" }}>
                Note
              </td>
              <td style={{ color: MUTED, fontStyle: "italic", paddingTop: 8 }}>{member.note}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FamilyChainPage() {
  const { authed, checking, password, setPassword, authError, handleAuth } = useVaultAuth();

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: MUTED, fontFamily: MONO }}>Verifying vault access…</span>
      </div>
    );
  }

  if (!authed) {
    return (
      <AuthGate
        password={password}
        setPassword={setPassword}
        authError={authError}
        onSubmit={handleAuth}
      />
    );
  }

  // ── Authenticated — render lineage registry ───────────────────────────────

  const root0     = AVERY_FAMILY_CHAIN.filter(m => m.role === "ROOT0");
  const gen1      = AVERY_FAMILY_CHAIN.filter(m => m.role === "GENERATION_1");
  const gen1Names = new Set(gen1.map(m => m.name));
  const partners  = AVERY_FAMILY_CHAIN.filter(m => m.role === "PARTNER");
  const gen2      = AVERY_FAMILY_CHAIN.filter(m => m.role === "GENERATION_2");

  return (
    <main className="page" style={{ background: BG, minHeight: "100vh", padding: "0 0 60px" }}>
      <AnchorBanner />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header */}
        <div style={{
          background: GOLD_BG,
          border: `1px solid ${GOLD_BORD}`,
          borderRadius: 16,
          padding: "24px 32px",
          marginBottom: 32,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⛓️⚓⛓️</div>
          <h1 style={{ color: GOLD, fontFamily: MONO, fontSize: 22, marginBottom: 6, margin: "0 0 6px" }}>
            AveryOS™ Sovereign Family Chain
          </h1>
          <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
            PRIVATE · Vault-Authenticated · ROOT0-Anchored
          </p>
        </div>

        {/* Privacy notice */}
        <div style={{
          background: "rgba(255,68,68,0.06)",
          border: "1px solid rgba(255,68,68,0.3)",
          borderRadius: 10,
          padding: "14px 20px",
          marginBottom: 32,
          fontSize: 13,
          color: "#ff8080",
          fontFamily: MONO,
        }}>
          🔒 STRICTLY PRIVATE — This registry is visible only to authenticated vault users.
          Family member information is never exposed via public APIs, sitemaps, or search engines.
        </div>

        {/* Chain metadata */}
        <div style={{
          background: PURPLE_BG,
          border: `1px solid ${PURPLE_BORD}`,
          borderRadius: 10,
          padding: "14px 20px",
          marginBottom: 32,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          fontSize: 12,
          fontFamily: MONO,
        }}>
          <div>
            <span style={{ color: MUTED }}>Chain ID: </span>
            <span style={{ color: WHITE }}>{FAMILY_CHAIN_METADATA.chainId}</span>
          </div>
          <div>
            <span style={{ color: MUTED }}>Members: </span>
            <span style={{ color: WHITE }}>{FAMILY_CHAIN_METADATA.memberCount}</span>
          </div>
          <div>
            <span style={{ color: MUTED }}>Kernel: </span>
            <span style={{ color: GREEN }}>{KERNEL_VERSION}</span>
          </div>
          <div>
            <span style={{ color: MUTED }}>Updated: </span>
            <span style={{ color: WHITE }}>{FAMILY_CHAIN_METADATA.lastUpdated}</span>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={{ color: MUTED }}>Kernel SHA: </span>
            <span style={{ color: GOLD, wordBreak: "break-all", fontSize: 11 }}>{KERNEL_SHA}</span>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={{ color: MUTED }}>Anchor Seal: </span>
            <span style={{ color: GOLD }}>{FAMILY_CHAIN_METADATA.anchorSeal}</span>
          </div>
        </div>

        {/* ROOT0 immutability notice */}
        <div style={{
          background: GOLD_BG,
          border: `1px solid ${GOLD_BORD}`,
          borderRadius: 10,
          padding: "12px 18px",
          marginBottom: 28,
          fontSize: 12,
          color: GOLD,
          fontFamily: MONO,
        }}>
          🤛🏻 ROOT0 is PERMANENTLY AND IMMUTABLY locked to Jason Lee Avery (Creator / Crater / ROOT0).
          Heirs inherit AveryOS™ stewardship but can never assume ROOT0 — it is a forever-sealed CreatorLock.
        </div>

        {/* ROOT0 */}
        <h2 style={{ color: GOLD, fontFamily: MONO, fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>
          ── ROOT0 ──────────────────────────────────────
        </h2>
        {root0.map(m => <MemberCard key={m.name} member={m} indent={0} />)}

        {/* Generation 1 */}
        {gen1.length > 0 && (
          <>
            <h2 style={{ color: GREEN, fontFamily: MONO, fontSize: 14, marginBottom: 12, marginTop: 28, letterSpacing: 1 }}>
              ── Generation 1 — Root1 Heirs ─────────────────
            </h2>
            {gen1.map(m => <MemberCard key={m.name} member={m} indent={1} />)}
          </>
        )}

        {/* Partners */}
        {partners.length > 0 && (
          <>
            <h2 style={{ color: MUTED, fontFamily: MONO, fontSize: 14, marginBottom: 12, marginTop: 28, letterSpacing: 1 }}>
              ── Partners ────────────────────────────────────
            </h2>
            {partners.map(m => <MemberCard key={m.name} member={m} indent={1} />)}
          </>
        )}

        {/* Generation 2 */}
        {gen2.length > 0 && (
          <>
            <h2 style={{ color: BLUE, fontFamily: MONO, fontSize: 14, marginBottom: 12, marginTop: 28, letterSpacing: 1 }}>
              ── Generation 2 — Root2 Heirs ─────────────────
            </h2>
            {gen2.map(m => {
              const parentInGen1 = m.parents?.some(p => gen1Names.has(p));
              return <MemberCard key={m.name} member={m} indent={parentInGen1 ? 2 : 1} />;
            })}
          </>
        )}

        {/* Footer anchor */}
        <div style={{ textAlign: "center", marginTop: 48, color: MUTED, fontSize: 12, fontFamily: MONO }}>
          AveryOS™ Sovereign Family Chain · {KERNEL_VERSION} · ⛓️⚓⛓️ 🤛🏻
        </div>

      </div>
    </main>
  );
}
