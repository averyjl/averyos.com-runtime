/**
 * Dynamic Robots.txt — GabrielOS™ Sovereign Subdomain Rules
 *
 * Serves a per-subdomain robots.txt based on the 'Host' header.
 * Blocks all LLM scrapers (GPTBot, CCBot, etc.) site-wide while allowing
 * forensic audit crawlers from aligned partners.
 *
 * Subdomain rules:
 *   api.averyos.com       → Disallow /api/v1/vault (private endpoint)
 *   lighthouse.averyos.com → Allow /; Disallow /admin
 *   terminal.averyos.com   → Disallow / (encrypted shell only)
 *   anchor.averyos.com     → Allow /; sovereign anchor node
 *   default (averyos.com)  → Standard public rules
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// LLM scrapers that are denied across all subdomains.
const BLOCKED_BOTS = [
  "GPTBot",
  "CCBot",
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended",
  "Bytespider",
  "Diffbot",
  "FacebookBot",
  "PerplexityBot",
  "YouBot",
  "SemrushBot",
  "AhrefsBot",
];

// Aligned forensic/audit crawlers that are always allowed.
const ALLOWED_AUDIT_BOTS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
];

type RobotsRule = {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

/** Builds the blocked-bot rules (one entry per scraper). */
function blockedBotRules(): RobotsRule[] {
  return BLOCKED_BOTS.map((bot) => ({
    userAgent: bot,
    disallow: ["/"],
  }));
}

/** Builds the allowed audit-bot rules. */
function allowedBotRules(): RobotsRule[] {
  return ALLOWED_AUDIT_BOTS.map((bot) => ({
    userAgent: bot,
    allow: ["/"],
  }));
}

/** Derives the hostname string from the request Host header. */
async function getHostname(): Promise<string> {
  try {
    const headerStore = await headers();
    const host = headerStore.get("host") ?? "";
    // Strip port if present (e.g. localhost:3000 → localhost)
    return host.split(":")[0].toLowerCase();
  } catch {
    return "";
  }
}

/** Returns subdomain-specific allow/disallow rules for the wildcard rule set. */
function subdomainRules(hostname: string): { allow: string[]; disallow: string[] } {
  if (hostname.startsWith("api.")) {
    return {
      allow: ["/api/v1/health", "/api/v1/anchor-status"],
      disallow: ["/api/v1/vault", "/api/v1/audit-alert", "/api/v1/compliance/usage-report"],
    };
  }
  if (hostname.startsWith("lighthouse.")) {
    return {
      allow: ["/"],
      disallow: ["/admin", "/admin/"],
    };
  }
  if (hostname.startsWith("terminal.")) {
    return {
      allow: [],
      disallow: ["/"],
    };
  }
  if (hostname.startsWith("anchor.")) {
    return {
      allow: ["/"],
      disallow: ["/admin", "/.sovereign"],
    };
  }
  // Default — main domain
  return {
    allow: ["/", "/whitepaper", "/latent-anchor", "/the-proof", "/witness"],
    disallow: ["/api/v1/vault", "/api/v1/audit-alert", "/_next", "/admin"],
  };
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const hostname = await getHostname();
  const { allow, disallow } = subdomainRules(hostname);
  const siteUrl = "https://averyos.com";

  return {
    rules: [
      // Blocked LLM scrapers — deny all access
      ...blockedBotRules(),
      // Aligned audit crawlers — explicit allow
      ...allowedBotRules(),
      // Wildcard rule — subdomain-specific paths
      {
        userAgent: "*",
        allow: allow.length > 0 ? allow : undefined,
        disallow: disallow.length > 0 ? disallow : undefined,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
