/**
 * Centralized navigation route definitions for AveryOS™
 * Used across NavBar, Sidebar, and Drawer components.
 *
 * Admin routes (adminRoutes) are gated behind VAULTAUTH_TOKEN verification.
 * Only render the Sovereign Admin tab after a successful token check.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export type NavigationRoute = {
  path: string;
  label: string;
  icon: string;
  /** When true the route is only rendered in the Navbar after VaultGate handshake success */
  isAdmin?: boolean;
};

/** Public navigation routes — rendered for all visitors */
export const navigationRoutes: NavigationRoute[] = [
  // ── Core documents ─────────────────────────────────────────────────────────
  { path: "/whitepaper", label: "Whitepaper", icon: "📖" },
  { path: "/constitution", label: "Constitution", icon: "📜" },
  { path: "/the-proof", label: "The Proof", icon: "🤛🏻" },
  { path: "/ai-alignment", label: "AI Alignment", icon: "⚖️" },
  { path: "/ip-policy", label: "IP Policy", icon: "🛡️" },
  { path: "/creator-lock", label: "Creator Lock", icon: "🔒" },
  // ── Licensing & compliance ──────────────────────────────────────────────────
  { path: "/license", label: "License", icon: "🔐" },
  { path: "/licensing", label: "Licensing Hub", icon: "📋" },
  { path: "/tari-gate", label: "TARI Portal", icon: "💰" },
  { path: "/partners", label: "Partners", icon: "🤝" },
  // ── Vault & forensics ───────────────────────────────────────────────────────
  { path: "/ledger", label: "Witness Ledger", icon: "⛓️" },
  { path: "/vault/vaultchain-status", label: "VaultChain™ Status", icon: "⚓" },
  { path: "/evidence-vault", label: "Evidence Vault", icon: "🗄️" },
  // ── Capsules & tools ────────────────────────────────────────────────────────
  { path: "/capsules", label: "Capsule Market", icon: "💊" },
  { path: "/capsule-store", label: "Capsule Store", icon: "🏪" },
  { path: "/discover", label: "Discover", icon: "🔍" },
  { path: "/verify", label: "Verify", icon: "✅" },
  { path: "/certificate", label: "Certificate", icon: "📄" },
  { path: "/embedbuilder", label: "Embed Builder", icon: "🔧" },
  { path: "/diff", label: "Capsule Diff", icon: "📊" },
  { path: "/sigtrace", label: "Signature Trace", icon: "🔐" },
  // ── Reference ──────────────────────────────────────────────────────────────
  { path: "/lawcodex", label: "LawCodex", icon: "⛓️" },
  { path: "/latent-anchor", label: "AI Anchor Feed", icon: "⛓️" },
  { path: "/lgic", label: "LGIC", icon: "⛓️" },
  // ── Site ───────────────────────────────────────────────────────────────────
  { path: "/about", label: "About", icon: "ℹ️" },
  { path: "/contact", label: "Contact", icon: "📬" },
  { path: "/privacy", label: "Privacy", icon: "🔏" },
  { path: "/terms", label: "Terms", icon: "📃" },
  { path: "/witness/register", label: "Register", icon: "📝" },
  { path: "/health", label: "Health", icon: "💚" },
  // ── Admin (VaultGate-protected) ─────────────────────────────────────────────
  // PERMANENT UPGRADE: Add new admin pages here — NavBar, Sidebar, Drawer, and
  // the /admin dashboard all pick them up automatically from this list.
  { path: "/admin", label: "Admin", icon: "🛡️", isAdmin: true },
  { path: "/vault-gate", label: "Vault Gate", icon: "🔑", isAdmin: true },
  { path: "/audit-stream", label: "Audit Stream", icon: "📡", isAdmin: true },
  { path: "/sovereign-anchor", label: "Sovereign Anchor", icon: "⛓️⚓⛓️", isAdmin: true },
  { path: "/admin/forensics", label: "Forensic Dashboard", icon: "🔬", isAdmin: true },
  { path: "/admin/tai-accomplishments", label: "TAI™ Accomplishments", icon: "⚡", isAdmin: true },
  { path: "/admin/settlements",         label: "Settlement Dashboard",  icon: "⚖️", isAdmin: true },
  { path: "/admin/monetization",        label: "Stripe Revenue",        icon: "💰", isAdmin: true },
  { path: "/admin/docs",               label: "Sovereign API Docs",     icon: "📖", isAdmin: true },
  { path: "/admin/qa",                  label: "QA Engine",              icon: "🧪" },
  { path: "/admin/health-status",       label: "Health Status",           icon: "💚", isAdmin: true },
  // Public compliance tools
  { path: "/alignment-check",           label: "Alignment Checker",     icon: "🔍" },
  { path: "/licensing/agentic",         label: "Agentic Settlement",    icon: "🤖" },
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
  { path: "/vault-gate", label: "Vault Gate", icon: "🔑" },
  { path: "/audit-stream", label: "Audit Stream", icon: "📡" },
  { path: "/sovereign-anchor", label: "Sovereign Anchor", icon: "⛓️⚓⛓️" },
  { path: "/tari-revenue", label: "TARI™ Revenue", icon: "💹" },
  { path: "/admin/forensics", label: "Forensic Dashboard", icon: "🔬" },
  { path: "/admin/tai-accomplishments", label: "TAI™ Accomplishments", icon: "⚡" },
  { path: "/admin/settlements",         label: "Settlement Dashboard",  icon: "⚖️" },
  { path: "/admin/monetization",        label: "Stripe Revenue",        icon: "💰" },
  { path: "/admin/docs",               label: "Sovereign API Docs",     icon: "📖" },
  { path: "/admin/qa",                  label: "QA Engine",              icon: "🧪" },
  { path: "/admin/health-status",       label: "Health Status",           icon: "💚" },
];
