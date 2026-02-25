"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Primary navigation bar — shows the most important routes.
 * The full route list is available via the Drawer on mobile.
 */
const primaryNavItems = [
  { path: "/", label: "Home", icon: "🏠" },
  { path: "/start", label: "Start", icon: "🚀" },
  { path: "/pay", label: "Pay License", icon: "🔐" },
  { path: "/vault/vaultchain-status", label: "VaultChain™", icon: "⚓" },
  { path: "/verify", label: "Verify", icon: "✅" },
  { path: "/about", label: "About", icon: "ℹ️" },
];

const NavBar = () => {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link href="/" className="navbar-brand">
          <span className="navbar-brand-icon">⚓</span>
          <span className="navbar-brand-text">AveryOS</span>
        </Link>
        <div className="navbar-links">
          {primaryNavItems.map((route) => {
            const isActive =
              route.path === "/"
                ? pathname === "/"
                : (pathname?.startsWith(route.path) ?? false);
            return (
              <Link
                key={route.path}
                href={route.path}
                className={`navbar-link${isActive ? " navbar-link-active" : ""}`}
              >
                <span className="navbar-link-icon">{route.icon}</span>
                <span className="navbar-link-text">{route.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
