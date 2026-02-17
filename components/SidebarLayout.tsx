import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Drawer from "./Drawer";
import FooterBadge from "./FooterBadge";

type SidebarLayoutProps = {
  children: ReactNode;
};

/**
 * Alternative layout using Sidebar navigation instead of top NavBar
 * Sidebar is collapsible on desktop, and Drawer is used for mobile
 * 
 * To use this layout, import it in _app.tsx instead of individual components:
 * 
 * import SidebarLayout from "../components/SidebarLayout";
 * 
 * const App = ({ Component, pageProps }: AppProps) => {
 *   return (
 *     <SidebarLayout>
 *       <Component {...pageProps} />
 *     </SidebarLayout>
 *   );
 * };
 */
const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  return (
    <div className="sidebar-layout">
      <Sidebar />
      <Drawer />
      <div className="sidebar-layout-content">
        {children}
        <FooterBadge />
      </div>
    </div>
  );
};

export default SidebarLayout;
