import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import AnchorBanner from "../../components/AnchorBanner";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Creator Lock • averyos.com",
  description: "Creator Lock - Part of the Truthforce initiative for AveryOS.com",
  openGraph: {
    title: "Creator Lock • averyos.com",
    description: "Creator Lock - Truthforce Pages powered by AveryOS Capsule Runtime",
    type: "article",
    url: "https://averyos.com/creator-lock",
  },
  alternates: { canonical: "https://averyos.com/creator-lock" },
};

export default function CreatorLockPage() {
  const rawContent = readFileSync(join(process.cwd(), "content", "creator-lock.md"), "utf8");
  const html = sanitizeHtml(marked(rawContent, { async: false }) as string);

  const features = ["CapsuleEcho Active", "Glyph Injected", "PerspectiveLock Enforced"];

  return (
    <main className="page">
      <AnchorBanner />

      <div style={{
        fontSize: "0.85rem",
        color: "rgba(122, 170, 255, 0.85)",
        marginBottom: "1rem",
        padding: "0.5rem 1rem",
        borderLeft: "3px solid rgba(120, 148, 255, 0.6)",
        background: "rgba(9, 16, 34, 0.6)",
        borderRadius: "0 6px 6px 0",
      }}>
        ⛓️⚓ {features.join(" | ")}
      </div>

      <article
        className="truthforce-content"
        style={{
          background: "rgba(9, 16, 34, 0.85)",
          border: "1px solid rgba(120, 148, 255, 0.25)",
          borderRadius: "16px",
          padding: "2.5rem",
          lineHeight: "1.7",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div style={{
        marginTop: "2rem",
        paddingTop: "1rem",
        borderTop: "1px solid rgba(120, 148, 255, 0.15)",
        fontSize: "0.85rem",
        color: "rgba(238, 244, 255, 0.5)",
      }}>
        <p>
          <strong style={{ color: "rgba(122, 170, 255, 0.8)" }}>Truthforce Pages</strong> — deployed via AveryOS Capsule Runtime | AveryAnchored™
        </p>
      </div>
    </main>
  );
}
