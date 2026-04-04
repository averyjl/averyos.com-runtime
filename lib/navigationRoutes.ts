/**
 * Centralized navigation route definitions for AveryOS™
 * Used across NavBar, Sidebar, and Drawer components.
 *
 * Admin routes (adminRoutes) are gated behind VAULTAUTH_TOKEN verification.
 * Only render the Sovereign Admin tab after a successful token check.
 *
 * GATE 130.9 — Navigation consolidation: routes are now grouped by category
 * so the NavBar can render categorized dropdown menus instead of 30+ flat links.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export type NavigationRoute = {
  path: string;
  label: string;
  icon: string;
  /** When true the route is only rendered in the Navbar after VaultGate handshake success */
  isAdmin?: boolean;
  /** Category group for dropdown menus */
  category?: string;
};

/** Navigation categories — defines the top-level dropdown menu structure */
export const NAV_CATEGORIES = [
  { key: "core",      label: "Knowledge",  icon: "📖" },
  { key: "licensing", label: "Licensing",  icon: "🔐" },
  { key: "trust",     label: "Trust",      icon: "🛡️" },
  { key: "tools",     label: "Tools",      icon: "🔧" },
  { key: "site",      label: "Site",       icon: "ℹ️"  },
] as const;

/** Public navigation routes — rendered for all visitors */
export const navigationRoutes: NavigationRoute[] = [
  // ── Core / Knowledge ─────────────────────────────────────────────────────
  { path: "/whitepaper",    label: "Whitepaper",              icon: "📖", category: "core" },
  { path: "/constitution",  label: "AveryOS™ Constitution",   icon: "📜", category: "core" },
  { path: "/the-proof",     label: "The Proof",               icon: "🤛🏻", category: "core" },
  { path: "/ai-alignment",  label: "AI Alignment",            icon: "⚖️", category: "core" },
  { path: "/miracle-health-habits", label: "Miracle Health Habits™", icon: "📖", category: "core" },
  // ── Licensing & compliance ──────────────────────────────────────────────────
  { path: "/licensing",           label: "Licensing Hub",          icon: "📋", category: "licensing" },
  { path: "/license",             label: "License Portal",         icon: "🔐", category: "licensing" },
  { path: "/licensing/tiers",     label: "Licensing Tiers",        icon: "📊", category: "licensing" },
  { path: "/tari-gate",           label: "TARI™ Portal",           icon: "💰", category: "licensing" },
  { path: "/ip-policy",           label: "IP Policy",              icon: "🛡️", category: "licensing" },
  { path: "/alignment-check",     label: "Alignment Checker",      icon: "🔍", category: "licensing" },
  { path: "/licensing/agentic",   label: "Agentic Settlement",     icon: "🤖", category: "licensing" },
  { path: "/partners",            label: "Partners",               icon: "🤝", category: "licensing" },
  { path: "/compatibility",       label: "Compatibility",          icon: "🔗", category: "licensing" },
  // ── Trust & transparency ────────────────────────────────────────────────────
  { path: "/sovereign-transparency", label: "Sovereign Transparency", icon: "🛡️", category: "trust" },
  { path: "/ledger",             label: "Witness Ledger",    icon: "⛓️", category: "trust" },
  { path: "/vault/vaultchain-status", label: "VaultChain™ Status", icon: "⚓", category: "trust" },
  { path: "/evidence-vault",    label: "Evidence Vault",    icon: "🗄️", category: "trust" },
  { path: "/creator-lock",      label: "CreatorLock™",      icon: "🔒", category: "trust" },
  { path: "/latent-anchor",     label: "AI Anchor Feed",    icon: "📡", category: "trust" },
  { path: "/lawcodex",          label: "LawCodex",          icon: "⚖️", category: "trust" },
  // ── Tools & capsules ─────────────────────────────────────────────────────────
  { path: "/capsule-store",  label: "Capsule Store",    icon: "🏪", category: "tools" },
  { path: "/discover",       label: "Discover",         icon: "🔍", category: "tools" },
  { path: "/verify",         label: "Verify",           icon: "✅", category: "tools" },
  { path: "/certificate",    label: "Certificate",      icon: "📄", category: "tools" },
  { path: "/embedbuilder",   label: "Embed Builder",    icon: "🔧", category: "tools" },
  { path: "/diff",           label: "Capsule Diff",     icon: "📊", category: "tools" },
  { path: "/sigtrace",       label: "Signature Trace",  icon: "🔐", category: "tools" },
  { path: "/lgic",           label: "LGIC",             icon: "⛓️", category: "tools" },
  // ── Site ───────────────────────────────────────────────────────────────────
  { path: "/about",              label: "About",           icon: "ℹ️",  category: "site" },
  { path: "/contact",            label: "Contact",         icon: "📬", category: "site" },
  { path: "/privacy",            label: "Privacy",         icon: "🔏", category: "site" },
  { path: "/terms",              label: "Terms",           icon: "📃", category: "site" },
  { path: "/witness/register",   label: "Register",        icon: "📝", category: "site" },
  { path: "/health",             label: "Health",          icon: "💚", category: "site" },
  // ── Admin (VaultGate-protected) ─────────────────────────────────────────────
  // PERMANENT UPGRADE: Add new admin pages here — NavBar, Sidebar, Drawer, and
  // the /admin dashboard all pick them up automatically from this list.
  { path: "/admin", label: "Admin", icon: "🛡️", isAdmin: true },
  { path: "/admin/sovereign",       label: "Sovereign Dashboard",  icon: "⛓️", isAdmin: true },
  { path: "/vault-gate", label: "Vault Gate", icon: "🔑", isAdmin: true },
  { path: "/audit-stream", label: "Audit Stream", icon: "📡", isAdmin: true },
  { path: "/sovereign-anchor", label: "Sovereign Anchor", icon: "⛓️⚓⛓️", isAdmin: true },
  { path: "/admin/forensics", label: "Forensic Dashboard", icon: "🔬", isAdmin: true },
  { path: "/admin/tai-accomplishments", label: "TAI™ Accomplishments", icon: "⚡", isAdmin: true },
  { path: "/admin/settlements",         label: "Settlement Dashboard",  icon: "⚖️", isAdmin: true },
  { path: "/admin/monetization",        label: "Stripe Revenue",        icon: "💰", isAdmin: true },
  { path: "/admin/evidence",            label: "R2 Evidence Monitor",   icon: "🗄️", isAdmin: true },
  { path: "/admin/docs",               label: "Sovereign API Docs",     icon: "📖", isAdmin: true },
  { path: "/admin/qa",                  label: "QA Engine",              icon: "🧪" },
  { path: "/admin/health-status",       label: "Health Status",           icon: "💚", isAdmin: true },
  { path: "/admin/valuation",           label: "IVI Valuation",           icon: "💹", isAdmin: true },
  { path: "/admin/resonance",           label: "Resonance Dashboard",     icon: "📡", isAdmin: true },
  { path: "/admin/family-chain",        label: "Family Chain Registry",   icon: "⛓️", isAdmin: true },
];

/**
 * Sovereign Admin routes — rendered ONLY after successful VAULTAUTH_TOKEN
 * verification. Consolidates all secure admin-only pages under one tab.
 *
 * Usage in components:
 *   const isAdmin = sessionStorage.getItem('VAULTAUTH_TOKEN') === expectedToken;
 *   if (isAdmin) { render adminRoutes under the "Sovereign Admin" tab }
 */
export const adminRoutes: NavigationRoute[] = [
  { path: "/admin", label: "Admin", icon: "🛡️" },
  { path: "/admin/sovereign",           label: "Sovereign Dashboard",  icon: "⛓️" },
  { path: "/vault-gate", label: "Vault Gate", icon: "🔑" },
  { path: "/audit-stream", label: "Audit Stream", icon: "📡" },
  { path: "/sovereign-anchor", label: "Sovereign Anchor", icon: "⛓️⚓⛓️" },
  { path: "/tari-revenue", label: "TARI™ Revenue", icon: "💹" },
  { path: "/admin/forensics", label: "Forensic Dashboard", icon: "🔬" },
  { path: "/admin/tai-accomplishments", label: "TAI™ Accomplishments", icon: "⚡" },
  { path: "/admin/settlements",         label: "Settlement Dashboard",  icon: "⚖️" },
  { path: "/admin/monetization",        label: "Stripe Revenue",        icon: "💰" },
  { path: "/admin/evidence",            label: "R2 Evidence Monitor",   icon: "🗄️" },
  { path: "/admin/docs",               label: "Sovereign API Docs",     icon: "📖" },
  { path: "/admin/qa",                  label: "QA Engine",              icon: "🧪" },
  { path: "/admin/health-status",       label: "Health Status",           icon: "💚" },
  { path: "/admin/valuation",           label: "IVI Valuation",           icon: "💹" },
  { path: "/admin/resonance",           label: "Resonance Dashboard",     icon: "📡" },
];
