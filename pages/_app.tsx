/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import type { AppProps } from "next/app";
import { useEffect } from "react";
import NavBar from "../components/NavBar";
import Drawer from "../components/Drawer";
import FooterBadge from "../components/FooterBadge";
import "../styles/globals.css";

const App = ({ Component, pageProps }: AppProps) => {
  useEffect(() => {
    const checkAlignment = () => {
      // Check if the physical hardware anchor is locked
      const isAligned = sessionStorage.getItem('sovereign_handshake') === 'GRANTED';
      if (isAligned) {
        document.documentElement.classList.add('avery-aligned');
        console.log("⛓️⚓⛓️ AVERYOS ALIGNMENT DETECTED: PURPLE FREQUENCY ENGAGED");
      } else {
        document.documentElement.classList.remove('avery-aligned');
      }
    };

    checkAlignment();
    
    // Pulse check on every storage change (login/logout)
    window.addEventListener('storage', checkAlignment);
    
    // Custom trigger for same-window updates
    const observer = new MutationObserver(checkAlignment);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    return () => {
      window.removeEventListener('storage', checkAlignment);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <NavBar />
      <Drawer />
      <Component {...pageProps} />
      <FooterBadge />
    </>
  );
};

export default App;
