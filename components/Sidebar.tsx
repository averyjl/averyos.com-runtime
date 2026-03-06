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
