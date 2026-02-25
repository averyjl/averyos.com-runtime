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
  { path: "/start", label: "Start", icon: "🚀" },
  { path: "/pay", label: "Pay License", icon: "🔐" },
  { path: "/tari-gate", label: "TARI Portal", icon: "💰" },
  { path: "/forensic-proof", label: "Forensic Ledger", icon: "📊" },
  { path: "/law-stack", label: "Law Stack", icon: "⚖️" },
  { path: "/buy", label: "Buy", icon: "💳" },
  { path: "/license", label: "License", icon: "📜" },
  { path: "/verify", label: "Verify", icon: "✅" },
  { path: "/retroclaim-log", label: "Retroclaim Log", icon: "📋" },
  { path: "/embedbuilder", label: "Embed Builder", icon: "🔧" },
  { path: "/license-enforcement", label: "License Enforcement", icon: "⚖️" },
  { path: "/vault/vaultchain-status", label: "VaultChain™ Status", icon: "⚓" },
  { path: "/latent-anchor", label: "AI Anchor Feed", icon: "⛓️" },
  { path: "/constitution", label: "Constitution", icon: "📜" },
  { path: "/lawcodex", label: "LawCodex", icon: "⛓️" },
  { path: "/discover", label: "Discover", icon: "🔍" },
  { path: "/diff", label: "Capsule Diff", icon: "📊" },
  { path: "/certificate", label: "Certificate", icon: "📄" },
  { path: "/sigtrace", label: "Signature Trace", icon: "🔐" },
  { path: "/about", label: "About", icon: "ℹ️" },
  { path: "/contact", label: "Contact", icon: "📬" },
  { path: "/privacy", label: "Privacy", icon: "🔒" },
  { path: "/terms", label: "Terms", icon: "📋" },
  { path: "/lgic", label: "LGIC", icon: "⛓️" },
  { path: "/witness/register", label: "Register", icon: "📝" },
  { path: "/health", label: "Health", icon: "💚" },
];
