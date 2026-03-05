import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signature Trace • AveryOS Runtime",
  description: "Trace and audit cryptographic SHA-512 signatures across the AveryOS capsule chain.",
  openGraph: {
    title: "Signature Trace • AveryOS Runtime",
    description: "Trace and audit cryptographic signatures across the capsule chain.",
    type: "website",
    url: "https://averyos.com/sigtrace",
  },
  alternates: { canonical: "https://averyos.com/sigtrace" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
