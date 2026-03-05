import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "⛓️ Sovereign Audit Stream — AveryOS™ Command Center",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function AuditStreamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
