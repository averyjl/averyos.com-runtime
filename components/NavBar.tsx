// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * NavBar.tsx — AveryOS™ Sovereign Navigation
 *
 * GATE 130.9 — Categorized dropdown nav: 30+ flat links → 5 grouped dropdowns.
 * Dramatically reduces vertical space used by navigation on all screen sizes.
 *
 * Categories: Knowledge | Licensing | Trust | Tools | Site
 * Admin: Only shown after VaultGate handshake verification.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navigationRoutes, NAV_CATEGORIES, adminRoutes } from "../lib/navigationRoutes";
import AnchorBadge from "./AnchorBadge";

const NavBar = () => {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenCategory(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setOpenCategory(null);
    setMobileOpen(false);
  }, [pathname]);

  const publicRoutes = navigationRoutes.filter((r) => !r.isAdmin);

  return (
    <nav className="navbar" ref={navRef}>
      <div className="navbar-container">
        <Link href="/" className="navbar-brand">
          <span className="navbar-brand-icon">⚓</span>
          <span className="navbar-brand-text">AveryOS™</span>
        </Link>

        {/* Desktop categorized nav */}
        <div className="navbar-links navbar-links-desktop">
          {NAV_CATEGORIES.map((cat) => {
            const catRoutes = publicRoutes.filter((r) => r.category === cat.key);
            const isCatActive = catRoutes.some((r) =>
              r.path === "/" ? pathname === "/" : pathname?.startsWith(r.path)
            );
            const isOpen = openCategory === cat.key;

            return (
              <div key={cat.key} className="navbar-dropdown-group">
                <button
                  className={`navbar-link navbar-dropdown-trigger${isCatActive ? " navbar-link-active" : ""}`}
                  onClick={() => setOpenCategory(isOpen ? null : cat.key)}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  aria-label={`${cat.label} navigation`}
                >
                  <span className="navbar-link-icon">{cat.icon}</span>
                  <span className="navbar-link-text">{cat.label}</span>
                  <span style={{ fontSize: "0.6rem", marginLeft: "0.25rem", opacity: 0.7 }}>
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>
                {isOpen && (
                  <div className="navbar-dropdown-menu" role="menu">
                    {catRoutes.map((route) => {
                      const isActive =
                        route.path === "/"
                          ? pathname === "/"
                          : (pathname?.startsWith(route.path) ?? false);
                      return (
                        <Link
                          key={route.path}
                          href={route.path}
                          className={`navbar-dropdown-item${isActive ? " navbar-dropdown-item-active" : ""}`}
                          role="menuitem"
                        >
                          <span>{route.icon}</span>
                          <span>{route.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Admin dropdown — only after VaultGate handshake */}
          {isAdmin && (
            <div className="navbar-dropdown-group">
              <button
                className={`navbar-link navbar-dropdown-trigger${pathname?.startsWith("/admin") ? " navbar-link-active" : ""}`}
                onClick={() => setOpenCategory(openCategory === "admin" ? null : "admin")}
                aria-expanded={openCategory === "admin"}
                aria-haspopup="true"
                aria-label="Admin navigation"
              >
                <span className="navbar-link-icon">🛡️</span>
                <span className="navbar-link-text">Admin</span>
                <span style={{ fontSize: "0.6rem", marginLeft: "0.25rem", opacity: 0.7 }}>
                  {openCategory === "admin" ? "▲" : "▼"}
                </span>
              </button>
              {openCategory === "admin" && (
                <div className="navbar-dropdown-menu" role="menu">
                  {adminRoutes.map((route) => {
                    const isActive = pathname?.startsWith(route.path) ?? false;
                    return (
                      <Link
                        key={route.path}
                        href={route.path}
                        className={`navbar-dropdown-item${isActive ? " navbar-dropdown-item-active" : ""}`}
                        role="menuitem"
                      >
                        <span>{route.icon}</span>
                        <span>{route.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: AnchorBadge + mobile hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto" }}>
          <AnchorBadge />
          {/* Mobile hamburger */}
          <button
            className="navbar-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{mobileOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="navbar-mobile-menu">
          {NAV_CATEGORIES.map((cat) => {
            const catRoutes = publicRoutes.filter((r) => r.category === cat.key);
            return (
              <div key={cat.key} className="navbar-mobile-section">
                <div className="navbar-mobile-section-header">
                  {cat.icon} {cat.label}
                </div>
                {catRoutes.map((route) => {
                  const isActive =
                    route.path === "/"
                      ? pathname === "/"
                      : (pathname?.startsWith(route.path) ?? false);
                  return (
                    <Link
                      key={route.path}
                      href={route.path}
                      className={`navbar-mobile-item${isActive ? " navbar-mobile-item-active" : ""}`}
                    >
                      <span>{route.icon}</span>
                      <span>{route.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
          {isAdmin && (
            <div className="navbar-mobile-section">
              <div className="navbar-mobile-section-header">🛡️ Admin</div>
              {adminRoutes.map((route) => (
                <Link
                  key={route.path}
                  href={route.path}
                  className={`navbar-mobile-item${pathname?.startsWith(route.path) ? " navbar-mobile-item-active" : ""}`}
                >
                  <span>{route.icon}</span>
                  <span>{route.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default NavBar;
