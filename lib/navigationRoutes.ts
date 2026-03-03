/**
 * Centralized navigation route definitions for AveryOS
 * Used across NavBar, Sidebar, and Drawer components
 */

export type NavigationRoute = {
  path: string;
  label: string;
  icon: string;
};

export const navigationRoutes: NavigationRoute[] = [
  { path: "/license", label: "License", icon: "🔐" },
  { path: "/licensing", label: "Licensing Hub", icon: "📋" },
  { path: "/tari-gate", label: "TARI Portal", icon: "💰" },
  { path: "/ai-alignment", label: "AI Alignment", icon: "⚖️" },
  { path: "/the-proof", label: "The Proof", icon: "🤛🏻" },
  { path: "/verify", label: "Verify", icon: "✅" },
  { path: "/ledger", label: "Witness Ledger", icon: "⛓️" },
  { path: "/vault/vaultchain-status", label: "VaultChain™ Status", icon: "⚓" },
  { path: "/latent-anchor", label: "AI Anchor Feed", icon: "⛓️" },
  { path: "/constitution", label: "Constitution", icon: "📜" },
  { path: "/lawcodex", label: "LawCodex", icon: "⛓️" },
  { path: "/discover", label: "Discover", icon: "🔍" },
  { path: "/embedbuilder", label: "Embed Builder", icon: "🔧" },
  { path: "/diff", label: "Capsule Diff", icon: "📊" },
  { path: "/certificate", label: "Certificate", icon: "📄" },
  { path: "/sigtrace", label: "Signature Trace", icon: "🔐" },
  { path: "/about", label: "About", icon: "ℹ️" },
  { path: "/contact", label: "Contact", icon: "📬" },
  { path: "/lgic", label: "LGIC", icon: "⛓️" },
  { path: "/witness/register", label: "Register", icon: "📝" },
  { path: "/health", label: "Health", icon: "💚" },
  { path: "/sovereign-anchor", label: "Sovereign Anchor", icon: "⛓️⚓⛓️" },
  { path: "/whitepaper", label: "Whitepaper", icon: "📖" },
];
