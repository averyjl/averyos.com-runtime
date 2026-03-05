import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Capsule Diff • AveryOS",
  description: "View and compare historical capsule SHA-512 snapshots. Detect drift and verify integrity.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
