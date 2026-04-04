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
 * NavGroups define the top-level dropdown tabs in the NavBar.
 * Each group contains child routes shown in the dropdown.
 * Admin routes are gated behind VAULTAUTH_TOKEN verification.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export type NavigationRoute = {
  path: string;
  label: string;
  icon: string;
  /** When true the route is only rendered after VaultGate handshake success */
  isAdmin?: boolean;
};

/** A grouped nav category for dropdown rendering in the NavBar. */
export type NavGroup = {
  /** Top-level label shown in the NavBar */
  label: string;
  /** Emoji icon for the group */
  icon: string;
  /** Child routes shown in the dropdown */
  routes: NavigationRoute[];
  /** When true this group is only shown after VaultGate handshake */
  isAdmin?: boolean;
};

// ── Public Navigation Groups ────────────────────────────────────────────────────

export const navGroups: NavGroup[] = [
  {
    label: "Core",
    icon: "⚓",
    routes: [
      { path: "/whitepaper",           label: "Whitepaper",              icon: "📖" },
      { path: "/constitution",         label: "AveryOS™ Constitution",   icon: "📜" },
      { path: "/the-proof",            label: "The Proof",               icon: "🤛🏻" },
      { path: "/ai-alignment",         label: "AI Alignment",            icon: "⚖️" },
      { path: "/about",                label: "About",                   icon: "ℹ️" },
      { path: "/latent-anchor",        label: "AI Anchor Feed",          icon: "📡" },
    ],
  },
  {
    label: "Licensing",
    icon: "📋",
    routes: [
      { path: "/licensing",            label: "Licensing Hub",           icon: "📋" },
      { path: "/license",              label: "License",                 icon: "🔐" },
      { path: "/licensing/tiers",      label: "Licensing Tiers",         icon: "📊" },
      { path: "/tari-gate",            label: "TARI™ Portal",            icon: "💰" },
      { path: "/ip-policy",            label: "IP Policy",               icon: "🛡️" },
      { path: "/alignment-check",      label: "Alignment Checker",       icon: "🔍" },
      { path: "/licensing/agentic",    label: "Agentic Settlement",      icon: "🤖" },
      { path: "/compatibility",        label: "Compatibility",           icon: "🔗" },
      { path: "/partners",             label: "Partners",                icon: "🤝" },
    ],
  },
  {
    label: "Vault",
    icon: "⛓️",
    routes: [
      { path: "/ledger",               label: "Witness Ledger",          icon: "⛓️" },
      { path: "/vault/vaultchain-status", label: "VaultChain™ Status",   icon: "⚓" },
      { path: "/evidence-vault",       label: "Evidence Vault",          icon: "🗄️" },
      { path: "/sovereign-transparency", label: "Sovereign Transparency",icon: "🛡️" },
      { path: "/verify",               label: "Verify",                  icon: "✅" },
      { path: "/certificate",          label: "Certificate",             icon: "📄" },
      { path: "/sigtrace",             label: "Signature Trace",         icon: "🔐" },
    ],
  },
  {
    label: "CapsuleStore",
    icon: "🏪",
    routes: [
      { path: "/capsule-store",        label: "CapsuleStore",            icon: "🏪" },
      { path: "/discover",             label: "Discover",                icon: "🔍" },
      { path: "/embedbuilder",         label: "Embed Builder",           icon: "🔧" },
      { path: "/diff",                 label: "Capsule Diff",            icon: "📊" },
      { path: "/lgic",                 label: "LGIC",                    icon: "⛓️" },
    ],
  },
  {
    label: "Reference",
    icon: "📚",
    routes: [
      { path: "/lawcodex",             label: "LawCodex™",               icon: "⚖️" },
      { path: "/creator-lock",         label: "Creator Lock",            icon: "🔒" },
      { path: "/miracle-health-habits",label: "Miracle Health Habits™",  icon: "💊" },
      { path: "/health",               label: "Site Health",             icon: "💚" },
      { path: "/contact",              label: "Contact",                 icon: "📬" },
      { path: "/privacy",              label: "Privacy",                 icon: "🔏" },
      { path: "/terms",                label: "Terms",                   icon: "📃" },
      { path: "/witness/register",     label: "Register",                icon: "📝" },
    ],
  },
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
 * Sovereign Admin routes — used by Drawer and Sidebar after VaultGate auth.
 */
export const adminRoutes: NavigationRoute[] = adminNavGroup.routes;
