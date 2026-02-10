import Link from "next/link";
import { useState } from "react";
import { navigationRoutes } from "../lib/navigationRoutes";

/**
 * Collapsible sidebar navigation
 * Can be toggled open/closed for desktop layouts
 */
const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);

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
          {navigationRoutes.map((route) => (
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
