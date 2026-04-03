"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navigationRoutes } from "../lib/navigationRoutes";
import AnchorBadge from "./AnchorBadge";

const NavBar = () => {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check VaultGate handshake — only show admin routes when authenticated
  useEffect(() => {
    const token = sessionStorage.getItem("VAULTAUTH_TOKEN");
    if (!token) { setIsAdmin(false); return; }

    fetch("/api/gatekeeper/handshake-check", {
      headers: { "x-vault-auth": token },
    })
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(data?.status === "LOCKED" || data?.status === "AUTHENTICATED");
      })
      .catch(() => setIsAdmin(false));
  }, []);

  const publicRoutes = navigationRoutes.filter((r) => !r.isAdmin);
  const adminRoutes  = navigationRoutes.filter((r) => r.isAdmin);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link href="/" className="navbar-brand">
          <span className="navbar-brand-icon">⚓</span>
          <span className="navbar-brand-text">AveryOS</span>
        </Link>
        <div className="navbar-links">
          {publicRoutes.map((route) => {
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

          {/* CreatorLock Tab — only rendered after VaultGate handshake success */}
          {isAdmin && (
            <div className="navbar-admin-group">
              <Link
                href="/admin"
                className={`navbar-link${pathname?.startsWith("/admin") ? " navbar-link-active" : ""}`}
              >
                <span className="navbar-link-icon">🔒</span>
                <span className="navbar-link-text">CreatorLock</span>
              </Link>
              <div className="navbar-admin-dropdown">
                {adminRoutes.map((route) => {
                  const isActive = pathname?.startsWith(route.path) ?? false;
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
          )}
        </div>
        <div style={{ marginLeft: "auto", paddingLeft: "1rem", display: "flex", alignItems: "center" }}>
          <AnchorBadge />
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
