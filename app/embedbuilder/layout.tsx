import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Embed Capsule Builder • AveryOS",
  description: "Build and generate embed code for AveryOS capsule content. Copy iframe snippets for any capsule.",
  openGraph: {
    title: "Embed Capsule Builder • AveryOS",
    description: "Generate embed code for AveryOS capsule content.",
    type: "website",
    url: "https://averyos.com/embedbuilder",
  },
  alternates: { canonical: "https://averyos.com/embedbuilder" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
