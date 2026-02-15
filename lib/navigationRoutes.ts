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
  { path: "/discover", label: "Discover", icon: "🔍" },
  { path: "/diff", label: "Capsule Diff", icon: "📊" },
  { path: "/certificate", label: "Certificate", icon: "📄" },
  { path: "/sigtrace", label: "Signature Trace", icon: "🔐" },
];
