"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { navigationRoutes } from "../lib/navigationRoutes";

/**
 * Mobile drawer navigation
 * Slides in from the left on mobile devices
 *
 * CreatorLock (admin) routes are hidden until VaultGate handshake succeeds —
 * mirrors the same auth check used in NavBar.
 */
const Drawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check VaultGate handshake — only show CreatorLock routes when authenticated
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

  const closeDrawer = () => setIsOpen(false);

  const visibleRoutes = navigationRoutes.filter((r) => isAdmin || !r.isAdmin);

  return (
    <>
      <button
        className="drawer-toggle"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <span className="drawer-toggle-icon">☰</span>
      </button>

      {/* Backdrop overlay */}
      {isOpen && (
        <div className="drawer-backdrop" onClick={closeDrawer} />
      )}

      {/* Drawer panel */}
      <aside className={`drawer ${isOpen ? "drawer-open" : ""}`}>
        <div className="drawer-header">
          <Link href="/" className="drawer-brand" onClick={closeDrawer}>
            <span className="drawer-brand-icon">⚓</span>
            <span className="drawer-brand-text">AveryOS</span>
          </Link>
          <button
            className="drawer-close"
            onClick={closeDrawer}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="drawer-nav">
          {visibleRoutes.map((route) => (
            <Link
              key={route.path}
              href={route.path}
              className="drawer-link"
              onClick={closeDrawer}
            >
              <span className="drawer-link-icon">{route.icon}</span>
              <span className="drawer-link-text">{route.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Drawer;
