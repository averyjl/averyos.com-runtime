import Link from "next/link";
import { navigationRoutes } from "../lib/navigationRoutes";

/**
 * Classic horizontal navigation bar with icons
 * Displays all navigation routes in a responsive horizontal layout
 */
const NavBar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link href="/" className="navbar-brand">
          <span className="navbar-brand-icon">⚓</span>
          <span className="navbar-brand-text">AveryOS</span>
        </Link>
        <div className="navbar-links">
          {navigationRoutes.map((route) => (
            <Link key={route.path} href={route.path} className="navbar-link">
              <span className="navbar-link-icon">{route.icon}</span>
              <span className="navbar-link-text">{route.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
