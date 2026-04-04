/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
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
