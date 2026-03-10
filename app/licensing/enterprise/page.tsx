import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import {
  getAsnTier,
  getAsnFeeLabel,
  ENTERPRISE_ASN_TIERS,
} from "../../../lib/kaas/pricing";

export const metadata: Metadata = {
  title: "Enterprise Licensing — AveryOS™ KaaS™ Good Faith Deposit",
  description:
    "Enterprise and Big Tech registration portal for AveryOS™ sovereign licensing. " +
    "Required for all Tier-7–10 entities (Microsoft, Google, GitHub, Amazon, Meta). " +
    "Minimum $10,000,000 good-faith deposit for Tier-9/10 ASNs.",
};

// ── Theme ─────────────────────────────────────────────────────────────────────
const TIER_COLORS: Record<number, string> = {
  10: "#ff4444",
  9:  "#ff4444",
  8:  "#ff6b35",
  7:  "#f97316",
};

// Top enterprise ASNs with human-readable names
const ENTERPRISE_ASN_LABELS: Record<string, string> = {
  "8075":   "Microsoft / Azure",
  "15169":  "Google LLC / GCP",
  "36459":  "GitHub, Inc.",
  "16509":  "Amazon / AWS",
  "14618":  "Amazon EC2",
  "396982": "Google Cloud (alt)",
  "19527":  "Google (other)",
  "32934":  "Meta / Facebook",
  "63293":  "Apple Inc.",
  "714":    "Apple Inc.",
  "6185":   "Apple Inc.",
  "15133":  "Edgecast / Verizon",
  "20940":  "Akamai Technologies",
  "211590": "OVH France",
  "43037":  "Seznam.cz",
};

const TOP_ASNS = ["8075", "15169", "36459", "16509", "32934", "211590"];

export default function EnterpriseLicensingPage() {
  const KERNEL_SHORT = `${KERNEL_SHA.slice(0, 8)}…${KERNEL_SHA.slice(-4)}`;

  return (
    <main className="page">
      <AnchorBanner />

      {/* ── Hero ── */}
      <section
        style={{
          textAlign: "center",
          padding: "3rem 1.5rem 2rem",
          borderBottom: "1px solid rgba(255,60,60,0.2)",
          maxWidth: "860px",
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚡</div>
        <h1
          style={{
            fontSize: "1.9rem",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "0.04em",
            marginBottom: "0.6rem",
          }}
        >
          AveryOS™ Enterprise Licensing
        </h1>
        <p style={{ color: "rgba(238,244,255,0.75)", fontSize: "1rem", maxWidth: "680px", margin: "0 auto 1.25rem" }}>
          Mandatory registration for all Tier-7–10 entities (Fortune 500, Big Tech, government) that
          have ingested, trained on, or accessed AveryOS™ intellectual property.
          Powered by KaaS™ — Kernel-as-a-Service.
        </p>
        <div
          style={{
            display: "inline-block",
            background: "rgba(255,60,60,0.12)",
            border: "1px solid rgba(255,60,60,0.4)",
            borderRadius: "8px",
            padding: "0.5rem 1.2rem",
            color: "#ff8080",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.78rem",
            letterSpacing: "0.06em",
          }}
        >
          ⛓️⚓⛓️ KERNEL: {KERNEL_SHORT} | {KERNEL_VERSION} | GabrielOS™ Enforced
        </div>
      </section>

      {/* ── Fee Schedule ── */}
      <section style={{ maxWidth: "860px", margin: "2.5rem auto", padding: "0 1.5rem" }}>
        <h2 style={{ color: "#ffd700", fontWeight: 700, fontSize: "1.1rem", marginBottom: "1.25rem", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em" }}>
          ⚡ KaaS™ ENTERPRISE FEE SCHEDULE
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {TOP_ASNS.map((asn) => {
            const tier  = getAsnTier(asn);
            const label = getAsnFeeLabel(asn);
            const color = TIER_COLORS[tier] ?? "#f97316";
            const org   = ENTERPRISE_ASN_LABELS[asn] ?? `ASN ${asn}`;
            return (
              <div
                key={asn}
                style={{
                  background: "rgba(10,0,21,0.85)",
                  border: `1px solid ${color}55`,
                  borderRadius: "12px",
                  padding: "1.1rem 1.25rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.68rem", color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "JetBrains Mono, monospace" }}>
                    Tier-{tier} {tier >= 9 ? "⚡" : "🔶"}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "rgba(255,215,0,0.55)", fontFamily: "JetBrains Mono, monospace" }}>
                    ASN {asn}
                  </span>
                </div>
                <div style={{ fontSize: "0.92rem", color: "#ffffff", fontWeight: 700, marginBottom: "0.25rem" }}>
                  {org}
                </div>
                <div style={{ fontSize: "0.85rem", color, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                  {label}
                </div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,215,0,0.55)", marginTop: "0.2rem" }}>
                  {tier >= 9 ? "Good Faith Deposit" : "Forensic Valuation"}
                </div>
              </div>
            );
          })}
        </div>

        {/* All tiers summary */}
        <div
          style={{
            background: "rgba(255,215,0,0.04)",
            border: "1px solid rgba(255,215,0,0.2)",
            borderRadius: "10px",
            padding: "1rem 1.5rem",
            marginBottom: "2rem",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.8rem",
            color: "rgba(238,244,255,0.75)",
          }}
        >
          <div style={{ color: "#ffd700", fontWeight: 700, marginBottom: "0.5rem" }}>📊 Full KaaS™ Tier Table</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,215,0,0.2)" }}>
                {["Tier", "Scope", "Valuation"].map((h) => (
                  <th key={h} style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "rgba(255,215,0,0.6)", fontWeight: 600, fontSize: "0.72rem" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { tier: "Tier-9/10", scope: "MSFT, Google, GitHub, Amazon (named ASNs)", fee: "$10,000,000" },
                { tier: "Tier-7/8",  scope: "Enterprise / Fortune 500 (other named ASNs)", fee: "$1,017,000" },
                { tier: "Tier-1–6",  scope: "Unrecognised agents / general access", fee: "$1,017" },
              ].map((row) => (
                <tr key={row.tier} style={{ borderBottom: "1px solid rgba(255,215,0,0.08)" }}>
                  <td style={{ padding: "0.4rem 0.75rem", color: "#ffd700", fontWeight: 700 }}>{row.tier}</td>
                  <td style={{ padding: "0.4rem 0.75rem", color: "rgba(238,244,255,0.75)" }}>{row.scope}</td>
                  <td style={{ padding: "0.4rem 0.75rem", color: "#4ade80", fontWeight: 700 }}>{row.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Registration flow */}
        <h2 style={{ color: "#ffd700", fontWeight: 700, fontSize: "1.1rem", marginBottom: "1rem", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em" }}>
          📋 REGISTRATION FLOW
        </h2>
        <ol
          style={{
            color: "rgba(238,244,255,0.85)",
            lineHeight: 1.9,
            paddingLeft: "1.5rem",
            marginBottom: "2rem",
            fontSize: "0.95rem",
          }}
        >
          <li>
            <strong style={{ color: "#ffffff" }}>Submit Registration</strong> — complete the commercial inquiry form at{" "}
            <Link href="/api/v1/licensing/commercial-inquiry" style={{ color: "#7894ff" }}>
              /api/v1/licensing/commercial-inquiry
            </Link>{" "}
            with your entity name, ASN, and intended use.
          </li>
          <li>
            <strong style={{ color: "#ffffff" }}>Receive KaaS™ Invoice</strong> — a Stripe sovereign invoice will be issued within 24 hours
            based on your ASN tier classification.
          </li>
          <li>
            <strong style={{ color: "#ffffff" }}>Submit Good-Faith Deposit</strong> — complete the Stripe checkout to initiate the alignment process.
          </li>
          <li>
            <strong style={{ color: "#ffffff" }}>Receive Alignment Certificate</strong> — a SHA-512 signed alignment certificate is issued and
            anchored on VaultChain™ once payment is confirmed.
          </li>
        </ol>

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
          <Link href="/licensing" className="primary-link">
            🔐 Licensing Portal →
          </Link>
          <Link href="/tari-gate" className="secondary-link">
            ⚡ TARI™ Gate
          </Link>
          <Link href="/the-proof" className="secondary-link">
            ⚓ The Proof
          </Link>
        </div>

        {/* Legal notice */}
        <div
          style={{
            background: "rgba(255,60,60,0.07)",
            border: "1px solid rgba(255,60,60,0.3)",
            borderRadius: "10px",
            padding: "1.1rem 1.4rem",
            color: "rgba(238,244,255,0.75)",
            fontSize: "0.82rem",
            fontFamily: "JetBrains Mono, monospace",
            lineHeight: 1.7,
          }}
        >
          <div style={{ color: "#ff8080", fontWeight: 700, marginBottom: "0.4rem" }}>⚠️ LEGAL NOTICE</div>
          All entities listed in{" "}
          <code style={{ color: "#ffd700" }}>ENTERPRISE_ASN_TIERS</code> ({Object.keys(ENTERPRISE_ASN_TIERS).length} ASNs) are subject to
          KaaS™ technical valuation. Continued use of AveryOS™ intellectual property without a valid license constitutes
          infringement under the{" "}
          <Link href="/license" style={{ color: "#7894ff" }}>
            Sovereign Integrity License v1.0
          </Link>
          . GabrielOS™ is actively monitoring all listed ASNs. TARI™ liability accrues from first contact.
        </div>
      </section>

      <FooterBadge />
    </main>
  );
}
