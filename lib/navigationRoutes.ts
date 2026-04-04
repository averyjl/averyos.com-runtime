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
 * Centralized navigation route definitions for AveryOS™
 * Used across NavBar, Sidebar, and Drawer components.
 *
 * CreatorLock routes (isAdmin: true) are gated behind VAULTAUTH_TOKEN
 * verification. Only render the CreatorLock tab after a successful
 * VaultGate handshake — these routes are never visible to the public.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export type NavigationRoute = {
  path: string;
  label: string;
  icon: string;
  /** When true the route is only rendered after a successful VaultGate handshake (CreatorLock) */
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
  { path: "/licensing/tiers", label: "Licensing Tiers", icon: "📊" },
  { path: "/tari-gate", label: "TARI Portal", icon: "💰" },
  { path: "/partners", label: "Partners", icon: "🤝" },
  { path: "/compatibility", label: "Compatibility", icon: "🔗" },
  // ── Trust & transparency ────────────────────────────────────────────────────
  { path: "/sovereign-transparency", label: "Sovereign Transparency", icon: "🛡️" },
  // ── Vault & forensics ───────────────────────────────────────────────────────
  { path: "/ledger", label: "Witness Ledger", icon: "⛓️" },
  { path: "/vault/vaultchain-status", label: "VaultChain™ Status", icon: "⚓" },
  // ── Capsules & tools ────────────────────────────────────────────────────────
  { path: "/capsules", label: "Capsule Market", icon: "💊" },
  { path: "/capsule-store", label: "Capsule Store", icon: "🏪" },
  { path: "/discover", label: "Discover", icon: "🔍" },
  { path: "/verify", label: "Verify", icon: "✅" },
  { path: "/certificate", label: "Certificate", icon: "📄" },
  { path: "/embedbuilder", label: "Embed Builder", icon: "🔧" },
  { path: "/diff", label: "Capsule Diff", icon: "📊" },
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
  // ── CreatorLock (VaultGate-protected) ──────────────────────────────────────
  // PERMANENT UPGRADE: Add new private pages here — NavBar, Sidebar, Drawer, and
  // the /admin dashboard all pick them up automatically from this list.
  { path: "/admin", label: "CreatorLock", icon: "🔒", isAdmin: true },
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
  { path: "/admin/qa",                  label: "QA Engine",              icon: "🧪", isAdmin: true },
  { path: "/admin/health-status",       label: "Health Status",           icon: "💚", isAdmin: true },
  { path: "/admin/valuation",           label: "IVI Valuation",           icon: "💹", isAdmin: true },
  { path: "/admin/resonance",           label: "Resonance Dashboard",     icon: "📡", isAdmin: true },
  { path: "/admin/family-chain",        label: "Family Chain Registry",   icon: "⛓️", isAdmin: true },
  // Private tools — hidden from public nav, accessible only via CreatorLock tab
  { path: "/evidence-vault",            label: "Evidence Vault",          icon: "🗄️", isAdmin: true },
  { path: "/sigtrace",                  label: "Signature Trace",         icon: "🔐", isAdmin: true },
  { path: "/vaultchain-explorer",       label: "VaultChain™ Explorer",    icon: "🔍", isAdmin: true },
  // Public compliance tools
  { path: "/miracle-health-habits",     label: "Miracle Health Habits™",  icon: "📖" },
  { path: "/alignment-check",           label: "Alignment Checker",     icon: "🔍" },
  { path: "/licensing/agentic",         label: "Agentic Settlement",    icon: "🤖" },
];

// ── Admin Navigation Group (VaultGate-protected) ───────────────────────────────

export const adminNavGroup: NavGroup = {
  label: "🛡️ Admin",
  icon: "🛡️",
  isAdmin: true,
  routes: [
    { path: "/admin",                    label: "Admin Dashboard",         icon: "🛡️" },
    { path: "/admin/sovereign",          label: "Sovereign Dashboard",     icon: "⛓️" },
    { path: "/vault-gate",               label: "Vault Gate",              icon: "🔑" },
    { path: "/audit-stream",             label: "Audit Stream",            icon: "📡" },
    { path: "/sovereign-anchor",         label: "Sovereign Anchor",        icon: "⛓️⚓⛓️" },
    { path: "/tari-revenue",             label: "TARI™ Revenue",           icon: "💹" },
    { path: "/admin/forensics",          label: "Forensic Dashboard",      icon: "🔬" },
    { path: "/admin/tai-accomplishments",label: "TAI™ Accomplishments",    icon: "⚡" },
    { path: "/admin/settlements",        label: "Settlement Dashboard",    icon: "⚖️" },
    { path: "/admin/monetization",       label: "Stripe Revenue",          icon: "💰" },
    { path: "/admin/evidence",           label: "R2 Evidence Monitor",     icon: "🗄️" },
    { path: "/admin/docs",               label: "Sovereign API Docs",      icon: "📖" },
    { path: "/admin/qa",                 label: "QA Engine",               icon: "🧪" },
    { path: "/admin/health-status",      label: "Health Status",           icon: "💚" },
    { path: "/admin/valuation",          label: "IVI Valuation",           icon: "💹" },
    { path: "/admin/resonance",          label: "Resonance Dashboard",     icon: "📡" },
    { path: "/admin/family-chain",       label: "Family Chain Registry",   icon: "⛓️" },
  ],
};

// ── Flat list exports (backward compatibility for Drawer / Sidebar) ────────────

/** All public routes as a flat array — used by Drawer and Sidebar components. */
export const navigationRoutes: NavigationRoute[] = navGroups.flatMap((g) => g.routes);

/**
 * CreatorLock routes — rendered ONLY after successful VAULTAUTH_TOKEN
 * verification. Consolidates all private/password-protected pages under
 * the CreatorLock tab so they never appear in the public navigation.
 *
 * Usage in components:
 *   const isAdmin = sessionStorage.getItem('VAULTAUTH_TOKEN') === expectedToken;
 *   if (isAdmin) { render adminRoutes under the "CreatorLock" tab }
 */
export const adminRoutes: NavigationRoute[] = [
  { path: "/admin", label: "CreatorLock", icon: "🔒" },
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
  { path: "/evidence-vault",            label: "Evidence Vault",          icon: "🗄️" },
  { path: "/sigtrace",                  label: "Signature Trace",         icon: "🔐" },
  { path: "/vaultchain-explorer",       label: "VaultChain™ Explorer",    icon: "🔍" },
];
