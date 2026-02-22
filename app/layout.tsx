import type { ReactNode } from "react";
import NavBar from "../components/NavBar";
import Drawer from "../components/Drawer";
import FooterBadge from "../components/FooterBadge";
import "../styles/globals.css";

export const metadata = {
  title: "AveryOS",
  description: "AveryOS Sovereign Runtime",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavBar />
        <Drawer />
        {children}
        <FooterBadge />
      </body>
    </html>
  );
}
