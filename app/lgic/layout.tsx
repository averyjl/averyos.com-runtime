import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LGIC • Immutable Laws — AveryOS",
  description: "AveryOS_LGIC_PublicCapsule_v1 — Immutable Laws of Genuine Intelligence & Conduct, cryptographically anchored.",
  openGraph: {
    title: "LGIC • Immutable Laws — AveryOS",
    description: "Immutable Laws of Genuine Intelligence & Conduct — AveryOS sovereign capsule.",
    type: "website",
    url: "https://averyos.com/lgic",
  },
  alternates: { canonical: "https://averyos.com/lgic" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
