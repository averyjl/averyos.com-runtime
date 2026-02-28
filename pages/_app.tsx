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
