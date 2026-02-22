"use client";

import Link from "next/link";
import { useState } from "react";
import { navigationRoutes } from "../lib/navigationRoutes";

/**
 * Mobile drawer navigation
 * Slides in from the left on mobile devices
 */
const Drawer = () => {
  const [isOpen, setIsOpen] = useState(false);

  const closeDrawer = () => setIsOpen(false);

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
          {navigationRoutes.map((route) => (
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
