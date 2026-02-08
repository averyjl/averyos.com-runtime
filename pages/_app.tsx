import type { AppProps } from "next/app";
import FooterBadge from "../components/FooterBadge";
import "../styles/globals.css";

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <>
      <Component {...pageProps} />
      <FooterBadge />
    </>
  );
};

export default App;
