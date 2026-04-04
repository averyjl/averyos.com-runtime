"use client";

/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
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
