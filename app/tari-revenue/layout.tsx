import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "⚡ TARI™ Revenue Dashboard — AveryOS™",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function TariRevenueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
