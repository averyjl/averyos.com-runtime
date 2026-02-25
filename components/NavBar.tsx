"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationRoutes } from "../lib/navigationRoutes";

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
          {navigationRoutes.map((route) => {
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
