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
  { path: "/buy", label: "Buy", icon: "💳" },
  { path: "/license", label: "License", icon: "📜" },
  { path: "/verify", label: "Verify", icon: "✅" },
  { path: "/retroclaim-log", label: "Retroclaim Log", icon: "📋" },
  { path: "/embedbuilder", label: "Embed Builder", icon: "🔧" },
  { path: "/license-enforcement", label: "License Enforcement", icon: "⚖️" },
  { path: "/vault/vaultchain-status", label: "VaultChain Status", icon: "⚓" },
  { path: "/latent-anchor", label: "AI Anchor Feed", icon: "⛓️" },
  { path: "/discover", label: "Discover", icon: "🔍" },
  { path: "/diff", label: "Capsule Diff", icon: "📊" },
  { path: "/certificate", label: "Certificate", icon: "📄" },
  { path: "/sigtrace", label: "Signature Trace", icon: "🔐" },
  { path: "/about", label: "About", icon: "ℹ️" },
  { path: "/contact", label: "Contact", icon: "📬" },
  { path: "/privacy", label: "Privacy", icon: "🔒" },
  { path: "/terms", label: "Terms", icon: "📋" },
  { path: "/lawcodex", label: "LawCodex", icon: "⚖️" },
  { path: "/witness/register", label: "Register", icon: "📝" },
  {
    path: "/witness/disclosure/cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    label: "Disclosure Mirror",
    icon: "⛓️",
  },
];
