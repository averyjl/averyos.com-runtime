/**
 * app/registry/page.tsx
 *
 * AveryOS™ Public Capsule Registry — Phase 97 / Gate 9
 *
 * A public read-only view of the sovereign capsule registry.
 * Shows summary statistics (capsule count, category breakdown, last compiled)
 * without requiring vault auth.  Detailed capsule contents and SHA-512 proofs
 * are accessible via /vaultchain-explorer after identity verification.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";
import { loadCapsuleRegistry } from "../../lib/capsuleRegistry";

export const metadata: Metadata = {
  title: "Public Capsule Registry — AveryOS™ VaultChain™",
  description:
    "Public read-only index of AveryOS™ sovereign capsules. " +
    "Verify capsule integrity, browse categories, and obtain verification links. " +
    "Full SHA-512 proof verification available via VaultChain™ Explorer.",
};

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG_DARK   = "#03000a";
const GOLD      = "#ffd700";
const GOLD_DIM  = "rgba(255,215,0,0.55)";
const GOLD_BDR  = "rgba(255,215,0,0.3)";
const WHITE     = "#ffffff";
const GREEN     = "#4ade80";
const MONO      = "JetBrains Mono, monospace";

export default function RegistryPage() {
  const registry = loadCapsuleRegistry();
  const KERNEL_SHORT = `${KERNEL_SHA.slice(0, 8)}…${KERNEL_SHA.slice(-4)}`;

  // Build category breakdown from registry
  const categoryMap: Record<string, number> = {};
  if (registry) {
    for (const capsule of registry.capsules) {
      const cat = capsule.category ?? "GENERAL";
      categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
    }
  }
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  // Recent capsules (last 10, no SHA-512 or private details)
  const recentCapsules = registry?.capsules.slice(-10).reverse() ?? [];

  return (
    <main className="page" style={{ background: BG_DARK, minHeight: "100vh" }}>
      <AnchorBanner />

      {/* ── Hero ── */}
      <section
        style={{
          textAlign: "center",
          padding: "3rem 1.5rem 2rem",
          borderBottom: `1px solid ${GOLD_BDR}`,
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📦</div>
        <h1
          style={{
            fontSize: "1.9rem",
            fontWeight: 800,
            color: WHITE,
            letterSpacing: "0.04em",
            marginBottom: "0.6rem",
          }}
        >
          AveryOS™ Public Capsule Registry
        </h1>
        <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "1rem", maxWidth: "660px", margin: "0 auto 1rem" }}>
          Public summary index of sovereign capsules anchored on VaultChain™.
          SHA-512 proof verification and full capsule details require identity verification.
        </p>
        <div
          style={{
            display: "inline-block",
            background: "rgba(255,215,0,0.07)",
            border: `1px solid ${GOLD_BDR}`,
            borderRadius: "8px",
            padding: "0.45rem 1.1rem",
            color: GOLD_DIM,
            fontFamily: MONO,
            fontSize: "0.75rem",
          }}
        >
          ⛓️⚓⛓️ KERNEL: {KERNEL_SHORT} | {KERNEL_VERSION} | VaultChain™ Indexed
        </div>
      </section>

      {/* ── Summary Stats ── */}
      <section style={{ maxWidth: "900px", margin: "2rem auto", padding: "0 1.5rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {[
            { icon: "📦", label: "Total Capsules", value: registry?.count ?? 0 },
            { icon: "🗂️", label: "Categories",     value: categories.length },
            { icon: "⛓️", label: "Kernel Version", value: KERNEL_VERSION },
            {
              icon: "🕒",
              label: "Last Compiled",
              value: registry?.generatedAt
                ? new Date(registry.generatedAt).toISOString().slice(0, 10)
                : "N/A",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "rgba(255,215,0,0.04)",
                border: `1px solid ${GOLD_BDR}`,
                borderRadius: "12px",
                padding: "1.1rem 1.25rem",
                fontFamily: MONO,
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>{stat.icon}</div>
              <div style={{ fontSize: "0.68rem", color: GOLD_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "1.1rem", color: WHITE, fontWeight: 700 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Category Breakdown */}
        {categories.length > 0 && (
          <div
            style={{
              background: "rgba(255,215,0,0.03)",
              border: `1px solid ${GOLD_BDR}`,
              borderRadius: "12px",
              padding: "1.1rem 1.5rem",
              marginBottom: "2rem",
              fontFamily: MONO,
            }}
          >
            <div style={{ color: GOLD, fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.85rem", letterSpacing: "0.06em" }}>
              🗂️ CAPSULE CATEGORIES
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              {categories.map(([cat, count]) => (
                <span
                  key={cat}
                  style={{
                    background: "rgba(255,215,0,0.08)",
                    border: `1px solid ${GOLD_BDR}`,
                    borderRadius: "999px",
                    padding: "0.3rem 0.85rem",
                    fontSize: "0.72rem",
                    color: GOLD,
                    fontWeight: 600,
                  }}
                >
                  {cat} <span style={{ color: GOLD_DIM }}>({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Capsules — public summary (no SHA / private fields) */}
        <div
          style={{
            background: "rgba(255,215,0,0.03)",
            border: `1px solid ${GOLD_BDR}`,
            borderRadius: "12px",
            overflow: "hidden",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              padding: "0.85rem 1.5rem",
              borderBottom: `1px solid ${GOLD_BDR}`,
              color: GOLD,
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: "0.82rem",
              letterSpacing: "0.06em",
            }}
          >
            ⚓ RECENT CAPSULES (Summary — Public View)
          </div>
          {recentCapsules.length === 0 ? (
            <div style={{ padding: "1.5rem", color: GOLD_DIM, fontFamily: MONO, fontSize: "0.8rem" }}>
              No capsules indexed yet. Run <code>npm run capsule:build</code> to compile.
            </div>
          ) : (
            <div>
              {recentCapsules.map((cap) => (
                <div
                  key={cap.capsuleId}
                  style={{
                    padding: "0.85rem 1.5rem",
                    borderBottom: `1px solid rgba(255,215,0,0.08)`,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: WHITE, fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.2rem" }}>
                      {cap.title ?? cap.capsuleId}
                    </div>
                    {cap.summary && (
                      <div style={{ color: "rgba(238,244,255,0.6)", fontSize: "0.75rem", lineHeight: 1.5 }}>
                        {cap.summary.slice(0, 160)}{cap.summary.length > 160 ? "…" : ""}
                      </div>
                    )}
                    <div style={{ marginTop: "0.35rem", fontFamily: MONO, fontSize: "0.65rem", color: GOLD_DIM }}>
                      ID: {cap.capsuleId}
                      {cap.compiledAt && (
                        <span style={{ marginLeft: "0.75rem" }}>
                          Compiled: {cap.compiledAt.slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/vaultchain-explorer?capsule=${encodeURIComponent(cap.capsuleId)}`}
                    style={{
                      fontSize: "0.72rem",
                      color: GOLD,
                      fontFamily: MONO,
                      border: `1px solid ${GOLD_BDR}`,
                      borderRadius: "6px",
                      padding: "0.3rem 0.7rem",
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                    }}
                  >
                    🔍 Verify →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auth gate hint */}
        <div
          style={{
            background: "rgba(74,222,128,0.05)",
            border: `1px solid rgba(74,222,128,0.25)`,
            borderRadius: "10px",
            padding: "1rem 1.4rem",
            marginBottom: "2rem",
            fontFamily: MONO,
            fontSize: "0.8rem",
            color: "rgba(238,244,255,0.7)",
          }}
        >
          <span style={{ color: GREEN, fontWeight: 700 }}>🔐 Full Access:</span>{" "}
          SHA-512 proof hashes, drift-lock certificates, and private capsule details require
          identity verification via the{" "}
          <Link href="/vault-gate" style={{ color: GOLD }}>VaultChain™ Vault Gate</Link>.
        </div>

        {/* CTA row */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link href="/vaultchain-explorer" className="primary-link">
            ⛓️ VaultChain™ Explorer →
          </Link>
          <Link href="/vault-gate" className="secondary-link">
            🔐 Vault Gate
          </Link>
          <Link href="/the-proof" className="secondary-link">
            ⚓ The Proof
          </Link>
          <Link href="/licensing" className="secondary-link">
            📜 Licensing
          </Link>
        </div>
      </section>

      <FooterBadge />
    </main>
  );
}
