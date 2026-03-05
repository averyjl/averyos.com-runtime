import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover • AveryOS™ Runtime",
  description: "Discover and explore capsules across the AveryOS™ sovereign ecosystem.",
  openGraph: {
    title: "Discover • AveryOS™ Runtime",
    description: "Discover capsules and modules in the AveryOS™ ecosystem",
    type: "website",
    url: "https://averyos.com/discover",
  },
  alternates: { canonical: "https://averyos.com/discover" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
