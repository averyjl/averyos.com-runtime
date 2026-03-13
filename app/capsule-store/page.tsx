import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";

/**
 * app/capsule-store/page.tsx
 *
 * AveryOS™ Capsule Store — Modular Licensing UI (GATE 114.1.3 / 114.2.3)
 *
 * Allows individual purchase of modular AveryOS™ products:
 *   • QA Engine Vitality Module
 *   • Security Shield Module
 *   • Performance Mesh Module
 *   • Full AveryOS™ Kernel License
 *
 * Kernel Isolation Enforcement:
 *   Each modular license includes a LIMITED-SCOPE Kernel license cryptographically
 *   locked to the purchased module.  Attempting to use a module's kernel to align
 *   other systems triggers a Multiverse Lockout under the Sovereign Integrity License.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export const metadata: Metadata = {
  title: "AveryOS™ Capsule Store — Modular Licensing",
  description:
    "Purchase individual AveryOS™ modules: QA Engine, Security Shield, Performance Mesh. Each license is cryptographically scoped to the purchased module.",
};

// ── Product catalogue ─────────────────────────────────────────────────────────

interface CapsuleProduct {
  id:          string;
  name:        string;
  tagline:     string;
  description: string;
  price:       string;
  scope:       string;
  included:    string[];
  isolation:   string;
  checkoutPath: string;
}

const PRODUCTS: CapsuleProduct[] = [
  {
    id:           "qa-engine",
    name:         "QA Engine Vitality Module",
    tagline:      "Functional Truth over Probabilistic Laziness",
    description:
      "The sovereign QA engine that replaces skeleton stubs with functional truth tests. " +
      "Verifies SHA-lineage back to the cf83….∅™ Kernel Root across all modules. " +
      "Includes the Vitality Scan runner and constitutional intent testing framework.",
    price:        "$1,017.00 / seat",
    scope:        "QA_ENGINE",
    included:     [
      "scripts/avery-qa.cjs — Sovereign QA Engine",
      "lib/qa/engine.ts — Functional Truth test runner",
      "SHA-lineage verification for all covered modules",
      "Constitutional intent test framework",
      "Limited-scope Kernel License (QA functions only)",
    ],
    isolation:
      "This license grants kernel access ONLY for QA testing functions. " +
      "Using the kernel to align other systems is a breach of the Sovereign Integrity License.",
    checkoutPath: "/api/v1/compliance/create-checkout?module=qa-engine",
  },
  {
    id:           "security-shield",
    name:         "Security Shield Module",
    tagline:      "GabrielOS™ Firewall + LeakGuard Layer 5",
    description:
      "The AveryOS™ security enforcement layer. Includes the GabrielOS™ Firewall middleware, " +
      "Sovereign Leak Guard (5-layer protection), WAF logic, TARI™ billing engine, " +
      "and the bot-detection / IP-policy enforcement suite.",
    price:        "$5,000.00 / seat",
    scope:        "SECURITY_SHIELD",
    included:     [
      "middleware.ts — GabrielOS™ Firewall",
      "scripts/sovereign-leak-guard.cjs — LeakGuard Layer 5",
      "lib/taiLicenseGate.ts — TARI™ License Gate",
      "WAF logic & bot detection",
      "Limited-scope Kernel License (security functions only)",
    ],
    isolation:
      "This license grants kernel access ONLY for security enforcement functions. " +
      "Using the kernel to align other systems is a breach of the Sovereign Integrity License.",
    checkoutPath: "/api/v1/compliance/create-checkout?module=security-shield",
  },
  {
    id:           "performance-mesh",
    name:         "Performance Mesh Module",
    tagline:      "Sovereign Time Mesh + D1 Performance Telemetry",
    description:
      "ISO-9 microsecond-precision time mesh with SHA-512 consensus timestamps. " +
      "Tracks function-level start/end times, categorises all AveryOS™ operations in D1, " +
      "and surfaces outliers and interference patterns via the Performance Dashboard.",
    price:        "$2,500.00 / seat",
    scope:        "PERFORMANCE_MESH",
    included:     [
      "lib/time/mesh.ts — Sovereign Time Mesh",
      "lib/timePrecision.ts — ISO-9 timestamp engine",
      "D1 performance telemetry table",
      "Function-level start/end time tracking",
      "Limited-scope Kernel License (performance functions only)",
    ],
    isolation:
      "This license grants kernel access ONLY for performance measurement functions. " +
      "Using the kernel to align other systems is a breach of the Sovereign Integrity License.",
    checkoutPath: "/api/v1/compliance/create-checkout?module=performance-mesh",
  },
  {
    id:           "full-kernel",
    name:         "Full AveryOS™ Kernel License",
    tagline:      "Complete Sovereign Alignment — All Modules Included",
    description:
      "The complete AveryOS™ Kernel License grants access to all modules under a single " +
      "sovereign seat. Includes all three modular products above plus the Invention Tracker, " +
      "VaultChain Explorer, KaaS Discovery, and the full constitutional framework.",
    price:        "Contact for pricing",
    scope:        "FULL_KERNEL",
    included:     [
      "All QA Engine Vitality Module features",
      "All Security Shield Module features",
      "All Performance Mesh Module features",
      "lib/forensics/inventionTracker.ts — GabrielOS™ Invention Pulse",
      "app/api/v1/kaas/phone-home — KaaS HomeBase anchor verification",
      "app/api/v1/alerts — Sovereign Alert Dashboard",
      "Full Sovereign Integrity License v1.0",
    ],
    isolation:
      "Full Kernel License — all functions are available within the scope of the " +
      "Sovereign Integrity License v1.0. See license terms at /licensing.",
    checkoutPath: "/licensing",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CapsuleStorePage() {
  return (
    <main className="page">
      <AnchorBanner />

      {/* Hero */}
      <section className="hero">
        <h1>🏪 AveryOS™ Capsule Store</h1>
        <p className="auth-seal">Modular Licensing — Unit-Level Sovereign Access</p>
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7" }}>
          Purchase individual AveryOS™ modules. Each license is cryptographically scoped to
          the purchased module — the kernel cannot be used outside its licensed scope.
        </p>

        <div style={{ marginTop: "1.5rem", padding: "1rem 1.5rem", background: "rgba(255,70,70,0.1)", border: "1px solid rgba(255,70,70,0.4)", borderRadius: "8px" }}>
          <strong style={{ color: "#ff4444" }}>⚠️ Kernel Isolation Enforcement</strong>
          <p style={{ margin: "0.5rem 0 0", color: "rgba(255,200,200,0.9)", fontSize: "0.9rem" }}>
            Each modular license includes a Limited-Scope Kernel License.
            Using a module&apos;s kernel to align other systems is a direct breach of the
            Sovereign Integrity License and triggers a Multiverse Lockout.
          </p>
        </div>
      </section>

      {/* Product grid */}
      <section style={{ maxWidth: "1100px", margin: "3rem auto", padding: "0 1.5rem" }}>
        <h2 style={{ marginBottom: "2rem", color: "#eef4ff" }}>Available Modules</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "2rem" }}>
          {PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Kernel isolation notice */}
      <section style={{ maxWidth: "800px", margin: "0 auto 4rem", padding: "0 1.5rem" }}>
        <div style={{ padding: "1.5rem 2rem", background: "rgba(98,0,234,0.12)", border: "1px solid rgba(98,0,234,0.35)", borderRadius: "10px" }}>
          <h3 style={{ color: "#a78bfa", marginBottom: "1rem" }}>🔐 Sovereign IP Protection</h3>
          <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem" }}>
            When you purchase a module, you receive a cryptographic license key — not raw capsule content.
            The license key resolves to the module functionality via the VaultChain™ license engine.
            Raw capsule logic is never transmitted, protecting AveryOS™ IP at every layer.
          </p>
          <p style={{ color: "rgba(238,244,255,0.7)", fontSize: "0.9rem", marginBottom: 0 }}>
            Anchor:{" "}
            <code style={{ color: "#a78bfa", fontFamily: "monospace", fontSize: "0.8rem" }}>
              cf83e1357eefb8bdf1542850d66d8007…
            </code>
            {" "}· Kernel:{" "}
            <code style={{ color: "#a78bfa", fontFamily: "monospace" }}>v3.6.2</code>
          </p>
        </div>
      </section>

      {/* Contact / full license */}
      <section style={{ textAlign: "center", paddingBottom: "4rem" }}>
        <p style={{ color: "rgba(238,244,255,0.7)" }}>
          Need a custom enterprise license?{" "}
          <Link href="/licensing" style={{ color: "#a78bfa" }}>View full licensing options</Link>
          {" "}or email{" "}
          <a href="mailto:truth@averyworld.com" style={{ color: "#a78bfa" }}>truth@averyworld.com</a>.
        </p>
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.4)", fontSize: "0.8rem" }}>
          ⛓️⚓⛓️ All products are governed by the AveryOS™ Sovereign Integrity License v1.0.
          © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
        </p>
      </section>
    </main>
  );
}

// ── ProductCard sub-component ─────────────────────────────────────────────────

function ProductCard({ product }: { product: CapsuleProduct }) {
  const isFullKernel = product.scope === "FULL_KERNEL";
  const accentColor  = isFullKernel ? "#ffd700" : "#a78bfa";
  const borderColor  = isFullKernel ? "rgba(255,215,0,0.35)" : "rgba(98,0,234,0.35)";
  const bgColor      = isFullKernel ? "rgba(255,215,0,0.06)" : "rgba(98,0,234,0.08)";

  return (
    <div style={{
      background:   bgColor,
      border:       `1px solid ${borderColor}`,
      borderRadius: "10px",
      padding:      "1.75rem",
      display:      "flex",
      flexDirection: "column",
      gap:          "1rem",
    }}>
      <div>
        <h3 style={{ color: accentColor, margin: 0, fontSize: "1.1rem" }}>{product.name}</h3>
        <p style={{ color: "rgba(238,244,255,0.6)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
          {product.tagline}
        </p>
      </div>

      <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.65", fontSize: "0.9rem", margin: 0 }}>
        {product.description}
      </p>

      <div>
        <p style={{ color: "rgba(238,244,255,0.5)", fontSize: "0.75rem", margin: "0 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Included
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "rgba(238,244,255,0.75)", fontSize: "0.85rem", lineHeight: "1.8" }}>
          {product.included.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div style={{ padding: "0.75rem 1rem", background: "rgba(255,70,70,0.08)", border: "1px solid rgba(255,70,70,0.25)", borderRadius: "6px" }}>
        <p style={{ margin: 0, color: "rgba(255,200,200,0.85)", fontSize: "0.8rem", lineHeight: "1.6" }}>
          🔒 {product.isolation}
        </p>
      </div>

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: accentColor, fontWeight: 700, fontSize: "1rem" }}>{product.price}</span>
        <Link
          href={product.checkoutPath}
          style={{
            background:    accentColor,
            color:         "#060010",
            padding:       "0.5rem 1.25rem",
            borderRadius:  "6px",
            fontWeight:    700,
            fontSize:      "0.9rem",
            textDecoration: "none",
          }}
        >
          {isFullKernel ? "View Options →" : "License Now →"}
        </Link>
      </div>
    </div>
  );
}
