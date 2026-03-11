import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "🔍 Sovereign Alignment Checker — AveryOS™",
  description:
    "Perform a one-button Probabilistic IP Pattern Scan on any URL or text block to detect AveryOS™ kernel patterns and compute an Alignment Drift Score.",
};

export default function AlignmentCheckLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
