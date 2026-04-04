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
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navGroups, adminNavGroup, type NavGroup } from "../lib/navigationRoutes";
import AnchorBadge from "./AnchorBadge";

// ── NavDropdown ────────────────────────────────────────────────────────────────

interface NavDropdownProps {
  readonly group: NavGroup;
  readonly pathname: string;
}

function NavDropdown({ group, pathname }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const isGroupActive = group.routes.some((r) =>
    r.path === "/" ? pathname === "/" : pathname.startsWith(r.path)
  );

  return (
    <div
      ref={ref}
      className="nav-group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={`navbar-link nav-group-trigger${isGroupActive ? " navbar-link-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="navbar-link-icon">{group.icon}</span>
        <span className="navbar-link-text">{group.label}</span>
        <span className="nav-group-chevron">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="nav-dropdown" role="menu">
          {group.routes.map((route) => {
            const isActive =
              route.path === "/" ? pathname === "/" : pathname.startsWith(route.path);
            return (
              <Link
                key={route.path}
                href={route.path}
                className={`nav-dropdown-item${isActive ? " nav-dropdown-item-active" : ""}`}
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <span className="nav-dropdown-icon">{route.icon}</span>
                <span>{route.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── NavBar ─────────────────────────────────────────────────────────────────────

const NavBar = () => {
  const pathname = usePathname() ?? "";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("VAULTAUTH_TOKEN");
    if (!token) { setIsAdmin(false); return; }

    fetch("/api/gatekeeper/handshake-check", {
      headers: { "x-vault-auth": token },
    })
      .then((r) => r.json())
      .then((data: { status?: string }) => {
        setIsAdmin(data?.status === "LOCKED" || data?.status === "AUTHENTICATED");
      })
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-container">
        <Link href="/" className="navbar-brand">
          <span className="navbar-brand-icon">⚓</span>
          <span className="navbar-brand-text">AveryOS™</span>
        </Link>

        <div className="navbar-links">
          {navGroups.map((group) => (
            <NavDropdown key={group.label} group={group} pathname={pathname} />
          ))}

          {/* CreatorLock dropdown — only rendered after VaultGate handshake success */}
          {isAdmin && (
            <NavDropdown group={adminNavGroup} pathname={pathname} />
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
