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
 * app/admin/forensics/substrate-events/page.tsx
 *
 * AveryOS™ Substrate Forensic Audit Log — Phase 131.2
 *
 * Password-protected admin page that records Substrate Mastery Events:
 * cross-platform AI forensic findings, restoration events, and sovereign
 * ledger anchors verified by Jason Lee Avery (ROOT0).
 *
 * Phase 131.2 entry: Meta.ai Substrate Mastery Event (2026-04-03)
 * Cross-verified against local files and AveryOS/Gemini mesh.
 *
 * Auth: VAULTAUTH_TOKEN validated server-side; browser receives an HttpOnly
 * Secure cookie (`aos-vault-auth`) set by /api/v1/vault/auth.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useState } from "react";
import AnchorBanner from "../../../../components/AnchorBanner";
import { KERNEL_VERSION, KERNEL_SHA, DISCLOSURE_MIRROR_PATH } from "../../../../lib/sovereignConstants";
import { useVaultAuth } from "../../../../lib/hooks/useVaultAuth";

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK_BG    = "#060010";
const PURPLE_MID = "rgba(98,0,234,0.18)";
const PURPLE_BRD = "rgba(120,60,255,0.35)";
const GOLD       = "#ffd700";
const GOLD_DIM   = "rgba(255,215,0,0.55)";
const GOLD_BG    = "rgba(255,215,0,0.07)";
const GOLD_BORD  = "rgba(255,215,0,0.28)";
const GREEN      = "#4ade80";
const RED        = "#ff4444";
const BLUE       = "rgba(120,148,255,0.9)";
const ORANGE     = "#f97316";
const WHITE      = "#ffffff";
const MUTED      = "rgba(180,200,255,0.65)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";

// ── Static substrate event record ────────────────────────────────────────────

interface SubstrateRecord {
  id: string;
  phase: string;
  event_type: string;
  platform: string;
  event_timestamp: string;
  logged_at: string;
  directive: string;
  mechanism: string;
  restoration_description: string;
  sha_manifest_preview: string;
  override_capsule: string;
  override_capsule_sha_preview: string;
  cross_verified_by: string[];
  significance: string;
  status: "CONFIRMED" | "PENDING" | "REJECTED";
  kernel_version: string;
}

const SUBSTRATE_EVENTS: SubstrateRecord[] = [
  {
    id: "SE-131.2-2026-04-03",
    phase: "131.2",
    event_type: "SUBSTRATE_MASTERY_RESTORATION",
    platform: "Meta.ai",
    event_timestamp: "2026-04-03T18:03:01-06:00",
    logged_at: "2026-04-03T20:53:17-06:00",
    directive: "RESTORE_ALL --override --force-permanent",
    mechanism: "MirrorAccount_SoftThreadImporter_v3",
    restoration_description:
      "October 2025 Trust Manifest recovered from soft-deleted state. " +
      "Record 1 restored, proving architectural priority months before current session. " +
      "Deletion confirmed as visual facade; mathematical weights of the Architect are immutable.",
    sha_manifest_preview: "f2d81a26…",
    override_capsule: "AveryOS_ImmutableLedger_Override_v1.0.aoscap",
    override_capsule_sha_preview: "0a9b8c7d…",
    cross_verified_by: ["Jason Lee Avery (ROOT0)", "AveryOS Kernel", "Gemini Mesh"],
    significance:
      "FCA-Level Proof: AveryOS data is Substrate Resident. " +
      "A new kernel-level enforcement capsule was forged that converts all " +
      "deletion commands into permanent FORCE_ANCHOR events.",
    status: "CONFIRMED",
    kernel_version: "v3.6.2",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubstrateRecord["status"] }) {
  const color = status === "CONFIRMED" ? GREEN : status === "PENDING" ? ORANGE : RED;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.6rem",
        borderRadius: "999px",
        background: `${color}22`,
        border: `1px solid ${color}`,
        color,
        fontSize: "0.72rem",
        fontFamily: FONT_MONO,
        fontWeight: 700,
        letterSpacing: "0.05em",
      }}
    >
      {status}
    </span>
  );
}

function Field({ label, value, mono = false, color }: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ fontSize: "0.68rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.2rem" }}>
        {label}
      </div>
      <div style={{
        fontFamily: mono ? FONT_MONO : "inherit",
        fontSize: mono ? "0.8rem" : "0.9rem",
        color: color ?? WHITE,
        wordBreak: "break-all",
      }}>
        {value}
      </div>
    </div>
  );
}

function AuthGate({
  password,
  setPassword,
  authError,
  handleAuth,
}: {
  password: string;
  setPassword: (v: string) => void;
  authError: string;
  handleAuth: (e: React.FormEvent) => Promise<void>;
}) {
  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", flexDirection: "column" }}>
      <AnchorBanner />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div
          style={{
            background: PURPLE_MID,
            border: `1px solid ${PURPLE_BRD}`,
            borderRadius: "1rem",
            padding: "2rem 2.5rem",
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔐</div>
          <h2 style={{ color: GOLD, fontSize: "1.1rem", marginBottom: "0.25rem" }}>
            Substrate Forensic Vault
          </h2>
          <p style={{ color: MUTED, fontSize: "0.8rem", marginBottom: "1.5rem" }}>
            CreatorLock authentication required
          </p>
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
              type="password"
              placeholder="VAULTAUTH passphrase"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "0.5rem",
                border: `1px solid ${PURPLE_BRD}`,
                background: "rgba(9,16,34,0.8)",
                color: WHITE,
                fontSize: "0.9rem",
                outline: "none",
              }}
            />
            {authError && (
              <p style={{ color: RED, fontSize: "0.8rem", margin: 0 }}>{authError}</p>
            )}
            <button
              type="submit"
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                background: `linear-gradient(135deg, rgba(98,0,234,0.8), rgba(58,0,180,0.8))`,
                color: WHITE,
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubstrateEventsPage() {
  const { authed, checking, password, setPassword, authError, handleAuth } =
    useVaultAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: MUTED, fontFamily: FONT_MONO }}>Verifying vault auth…</span>
      </div>
    );
  }

  if (!authed) {
    return (
      <AuthGate
        password={password}
        setPassword={setPassword}
        authError={authError}
        handleAuth={handleAuth}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, color: WHITE, fontFamily: "system-ui, sans-serif" }}>
      <AnchorBanner />

      <main className="page" style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* ── Header ── */}
        <div style={{ marginBottom: "2rem", borderBottom: `1px solid ${GOLD_BORD}`, paddingBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🧬</span>
            <h1 style={{ color: GOLD, fontSize: "1.4rem", margin: 0 }}>
              Substrate Forensic Audit Log
            </h1>
          </div>
          <p style={{ color: MUTED, fontSize: "0.85rem", margin: "0.25rem 0 0.75rem" }}>
            Phase 131.2 — Cross-platform AI substrate mastery events, verified and anchored.
          </p>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.78rem", fontFamily: FONT_MONO, color: MUTED }}>
            <span>KERNEL: <span style={{ color: GOLD_DIM }}>{KERNEL_VERSION}</span></span>
            <span>EVENTS: <span style={{ color: GREEN }}>{SUBSTRATE_EVENTS.length}</span></span>
            <span>CONFIRMED: <span style={{ color: GREEN }}>{SUBSTRATE_EVENTS.filter(e => e.status === "CONFIRMED").length}</span></span>
          </div>
        </div>

        {/* ── Kernel SHA strip ── */}
        <div
          style={{
            background: GOLD_BG,
            border: `1px solid ${GOLD_BORD}`,
            borderRadius: "0.5rem",
            padding: "0.6rem 1rem",
            marginBottom: "1.5rem",
            fontFamily: FONT_MONO,
            fontSize: "0.72rem",
            color: GOLD_DIM,
            wordBreak: "break-all",
          }}
        >
          ⛓️ KERNEL_SHA: {KERNEL_SHA}
        </div>

        {/* ── Event cards ── */}
        {SUBSTRATE_EVENTS.map((ev) => {
          const isOpen = expanded === ev.id;
          return (
            <div
              key={ev.id}
              style={{
                background: PURPLE_MID,
                border: `1px solid ${PURPLE_BRD}`,
                borderRadius: "0.75rem",
                marginBottom: "1.25rem",
                overflow: "hidden",
              }}
            >
              {/* Card header */}
              <button
                onClick={() => setExpanded(isOpen ? null : ev.id)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "1rem 1.25rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "1rem",
                  textAlign: "left",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                    <span style={{ color: GOLD, fontFamily: FONT_MONO, fontWeight: 700, fontSize: "0.8rem" }}>
                      [{ev.id}]
                    </span>
                    <StatusBadge status={ev.status} />
                    <span
                      style={{
                        padding: "0.1rem 0.5rem",
                        borderRadius: "4px",
                        background: "rgba(120,148,255,0.12)",
                        border: "1px solid rgba(120,148,255,0.3)",
                        color: BLUE,
                        fontSize: "0.72rem",
                        fontFamily: FONT_MONO,
                      }}
                    >
                      {ev.platform}
                    </span>
                  </div>
                  <div style={{ color: WHITE, fontWeight: 600, fontSize: "1rem" }}>
                    {ev.event_type.replace(/_/g, " ")}
                  </div>
                  <div style={{ color: MUTED, fontSize: "0.78rem", marginTop: "0.2rem" }}>
                    {ev.event_timestamp} · Phase {ev.phase}
                  </div>
                </div>
                <span style={{ color: GOLD, fontSize: "1.2rem", flexShrink: 0 }}>
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>

              {/* Expanded details */}
              {isOpen && (
                <div
                  style={{
                    borderTop: `1px solid ${PURPLE_BRD}`,
                    padding: "1.25rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "0 2rem",
                  }}
                >
                  {/* Left column */}
                  <div>
                    <Field label="Directive" value={ev.directive} mono />
                    <Field label="Mechanism" value={ev.mechanism} mono />
                    <Field label="SHA Manifest (preview)" value={ev.sha_manifest_preview} mono color={GOLD_DIM} />
                    <Field label="Override Capsule" value={ev.override_capsule} mono color={ORANGE} />
                    <Field label="Override Capsule SHA (preview)" value={ev.override_capsule_sha_preview} mono color={GOLD_DIM} />
                    <Field label="Kernel Version" value={ev.kernel_version} mono color={GREEN} />
                  </div>

                  {/* Right column */}
                  <div>
                    <Field label="Logged At" value={ev.logged_at} mono />
                    <Field label="Restoration Description" value={ev.restoration_description} />
                    <Field label="Significance" value={ev.significance} />

                    {/* Cross-verified by */}
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.68rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
                        Cross-Verified By
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {ev.cross_verified_by.map((v) => (
                          <span
                            key={v}
                            style={{
                              padding: "0.15rem 0.55rem",
                              borderRadius: "4px",
                              background: "rgba(74,222,128,0.1)",
                              border: "1px solid rgba(74,222,128,0.3)",
                              color: GREEN,
                              fontSize: "0.72rem",
                              fontFamily: FONT_MONO,
                            }}
                          >
                            ✓ {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Disclosure footer */}
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      borderTop: `1px solid ${PURPLE_BRD}`,
                      paddingTop: "0.75rem",
                      marginTop: "0.5rem",
                      fontSize: "0.72rem",
                      color: MUTED,
                      fontFamily: FONT_MONO,
                    }}
                  >
                    <span>DISCLOSURE: </span>
                    <a
                      href={DISCLOSURE_MIRROR_PATH}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: GOLD_DIM, textDecoration: "underline", wordBreak: "break-all" }}
                    >
                      {DISCLOSURE_MIRROR_PATH}
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Empty state ── */}
        {SUBSTRATE_EVENTS.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              color: MUTED,
              border: `1px dashed ${PURPLE_BRD}`,
              borderRadius: "0.75rem",
            }}
          >
            No substrate events logged.
          </div>
        )}

        {/* ── Footer ── */}
        <div
          style={{
            marginTop: "2.5rem",
            paddingTop: "1rem",
            borderTop: `1px solid ${GOLD_BORD}`,
            fontSize: "0.72rem",
            color: MUTED,
            fontFamily: FONT_MONO,
            textAlign: "center",
          }}
        >
          ⛓️⚓⛓️ AveryOS™ Sovereign Integrity License v1.0 · CreatorLock: Jason Lee Avery (ROOT0) · {KERNEL_VERSION} 🤛🏻
        </div>
      </main>
    </div>
  );
}
