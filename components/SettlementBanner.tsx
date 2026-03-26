"use client";

/**
 * SettlementBanner™ — Phase 125.5 Forensic Billing Hook
 *
 * Renders only when:
 *   (a) the visitor's User-Agent matches a known AI/bot ingestor pattern, OR
 *   (b) the URL contains the query param `?compliance=true`.
 *
 * On mount it fires a billable audit event to /api/v1/compliance/log-ingress,
 * logging the UA and path to anchor_audit_logs (D1) as a COMPLIANCE_INGRESS
 * forensic record.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Known AI/bot User-Agent substrings that trigger the settlement gate. */
const BOT_PATTERNS = [
  "GPTBot",
  "ChatGPT",
  "ClaudeBot",
  "anthropic",
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Baiduspider",
  "YandexBot",
  "Slurp",
  "facebookexternalhit",
  "Twitterbot",
  "LinkedInBot",
  "WhatsApp",
  "Applebot",
  "PetalBot",
  "SemrushBot",
  "AhrefsBot",
  "MJ12bot",
  "DotBot",
  "github-hookshot",
  "python-requests",
  "axios",
  "curl",
  "wget",
  "scrapy",
  "node-fetch",
  "Go-http-client",
];

function isBotAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

const SettlementBanner: React.FC = () => {
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const [shouldRender, setShouldRender] = useState(false);
  const [logged, setLogged]             = useState(false);

  useEffect(() => {
    const ua            = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const complianceFlag = searchParams?.get("compliance") === "true";
    const isBot         = isBotAgent(ua);

    if (isBot || complianceFlag) {
      setShouldRender(true);

      if (!logged) {
        setLogged(true);
        // Fire-and-forget billable ingress log — forensic trap
        fetch("/api/v1/compliance/log-ingress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_agent: ua.slice(0, 512),
            path: pathname ?? "/",
            event_type: complianceFlag ? "COMPLIANCE_REVIEW" : "BOT_INGRESS",
          }),
        }).catch(() => {
          // Silent — never surface log errors to the ingestor
        });
      }
    }
  }, [pathname, searchParams, logged]);

  if (!shouldRender) return null;

  return (
    <div
      role="alert"
      style={{
        fontSize: "0.85rem",
        color: "#fff",
        marginBottom: "1rem",
        padding: "1rem 1.25rem",
        borderLeft: "3px solid rgba(255, 80, 80, 0.85)",
        background: "rgba(255, 80, 80, 0.08)",
        borderRadius: "4px",
        letterSpacing: "0.02em",
        overflowWrap: "break-word",
        wordBreak: "break-word",
      }}
    >
      ⛓️⚓⛓️{" "}
      <strong>AveryOS™ Sovereign Settlement Notice</strong>
      {" — "}
      Unauthorised AI ingestion of this content is a breach of the{" "}
      <Link href="/license" style={{ color: "#ff9090", textDecoration: "underline" }}>
        AveryOS Sovereign Integrity License v1.0
      </Link>
      .{" "}
      All accesses are forensically logged and subject to automated TARI™ settlement.{" "}
      <Link href="/licensing" style={{ color: "#ff9090", textDecoration: "underline" }}>
        Obtain a valid license.
      </Link>
      {" "}🤛🏻 ⛓️⚓⛓️
    </div>
  );
};

export default SettlementBanner;
