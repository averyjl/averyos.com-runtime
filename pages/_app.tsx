import type { AppProps } from "next/app";
import NavBar from "../components/NavBar";
import Drawer from "../components/Drawer";
import FooterBadge from "../components/FooterBadge";
import "../styles/globals.css";

const App = ({ Component, pageProps }: AppProps) => {
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
