import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Capsule License",
  description: "Validate AveryOS capsule licenses by capsule ID, customer email, or hash.",
  openGraph: {
    title: "Verify Capsule License",
    description: "Validate AveryOS capsule licenses by capsule ID, customer email, or hash.",
    type: "website",
    url: "https://averyos.com/verify",
  },
  alternates: { canonical: "https://averyos.com/verify" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
