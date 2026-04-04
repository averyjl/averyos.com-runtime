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
import { useMemo, useState } from "react";
import { navigationRoutes } from "../lib/navigationRoutes";

/**
 * Collapsible sidebar navigation
 * Can be toggled open/closed for desktop layouts
 *
 * PERMANENT UPGRADE: Admin routes are included automatically from
 * lib/navigationRoutes.ts — add new routes there and they appear here.
 */
const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);

  // Public routes only — admin routes require VaultGate auth (handled by NavBar).
  // Memoised because navigationRoutes is static and this filter need not re-run.
  const publicRoutes = useMemo(() => navigationRoutes.filter((r) => !r.isAdmin), []);

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isOpen ? "◀" : "▶"}
      </button>
      <aside className={`sidebar ${isOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <div className="sidebar-header">
          <Link href="/" className="sidebar-brand">
            <span className="sidebar-brand-icon">⚓</span>
            {isOpen && <span className="sidebar-brand-text">AveryOS</span>}
          </Link>
        </div>
        <nav className="sidebar-nav">
          {publicRoutes.map((route) => (
            <Link key={route.path} href={route.path} className="sidebar-link">
              <span className="sidebar-link-icon">{route.icon}</span>
              {isOpen && <span className="sidebar-link-text">{route.label}</span>}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
