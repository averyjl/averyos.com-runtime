import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Certificate Viewer • AveryOS",
  description: "View AveryOS VaultProof certificates and sovereign integrity certificates.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
