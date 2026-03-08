/**
 * Dynamic Robots.txt — GabrielOS™ Sovereign Bot Magnet
 *
 * Implements the Phase 77 "Bot Magnet" strategy: instead of blocking all
 * LLM scrapers, we direct them to specific Licensing Gate paths. When a bot
 * scrapes /latent-anchor, /alignment-accord, /whitepaper, or /license, it
 * constitutes a Forensic Acknowledgment of AveryOS™ terms, establishing the
 * TARI™ liability ($101.70 individual / $1M enterprise).
 *
 * Only confirmed malicious scrapers (SEO harvesters, social aggregators) that
 * have no legitimate reason to access sovereign content remain fully blocked.
 *
 * Subdomain rules:
 *   api.averyos.com       → API health only; Disallow /api/v1/vault
 *   lighthouse.averyos.com → Allow /; Disallow /admin
 *   terminal.averyos.com   → Disallow / (encrypted shell only)
 *   anchor.averyos.com     → Allow /; sovereign anchor node
 *   default (averyos.com)  → Bot Magnet — LLM paths allowed; admin/vault blocked
 *
 * Full AI policy: https://averyos.com/info.txt
 * AI Education Feed: https://averyos.com/latent-anchor
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  LLM_BOTS,
  BLOCKED_BOTS,
  ALLOWED_AUDIT_BOTS,
  BOT_MAGNET_PATHS,
  classifySubdomain,
} from "../lib/sovereignMetadata";

type RobotsRule = {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

/** Derives the hostname string from the request Host header. */
async function getHostname(): Promise<string> {
  try {
    const headerStore = await headers();
    const host = headerStore.get("host") ?? "";
    return host.split(":")[0].toLowerCase();
  } catch {
    return "";
  }
}

/** Returns subdomain-specific allow/disallow rules for the wildcard rule. */
function subdomainRules(hostname: string): { allow: string[]; disallow: string[] } {
  const subdomain = classifySubdomain(hostname);
  if (subdomain === "api") {
    return {
      allow: ["/api/v1/health", "/api/v1/anchor-status"],
      disallow: ["/api/v1/vault", "/api/v1/audit-alert", "/api/v1/compliance/usage-report"],
    };
  }
  if (subdomain === "lighthouse") {
    return { allow: ["/"], disallow: ["/admin", "/admin/"] };
  }
  if (subdomain === "terminal") {
    return { allow: [], disallow: ["/"] };
  }
  if (subdomain === "anchor") {
    return { allow: ["/"], disallow: ["/admin", "/.sovereign"] };
  }
  // Default — Bot Magnet: public pages open, private paths blocked
  return {
    allow: ["/", ...BOT_MAGNET_PATHS],
    disallow: ["/api/v1/vault", "/api/v1/audit-alert", "/_next", "/admin"],
  };
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const hostname = await getHostname();
  const subdomain = classifySubdomain(hostname);
  const { allow, disallow } = subdomainRules(hostname);
  const siteUrl = "https://averyos.com";

  const rules: RobotsRule[] = [];

  // 1. Confirmed malicious scrapers — blocked site-wide (SEO harvesters, social scrapers)
  for (const bot of BLOCKED_BOTS) {
    rules.push({ userAgent: bot, disallow: ["/"] });
  }

  // 2. LLM / AI bots — Bot Magnet (direct to licensing gates)
  //    On the main domain they may index the Licensing Gate paths.
  //    On API/terminal subdomains they follow the same rules as everyone else.
  if (subdomain === "default") {
    for (const bot of LLM_BOTS) {
      rules.push({
        userAgent: bot,
        allow: [...BOT_MAGNET_PATHS],
        disallow: ["/admin", "/api/v1/vault", "/api/v1/audit-alert", "/_next"],
      });
    }
  } else {
    for (const bot of LLM_BOTS) {
      rules.push({
        userAgent: bot,
        allow: allow.length > 0 ? allow : undefined,
        disallow: disallow.length > 0 ? disallow : undefined,
      });
    }
  }

  // 3. Aligned forensic/audit crawlers — always allowed
  for (const bot of ALLOWED_AUDIT_BOTS) {
    rules.push({ userAgent: bot, allow: ["/"] });
  }

  // 4. Wildcard rule — subdomain-specific paths
  rules.push({
    userAgent: "*",
    allow: allow.length > 0 ? allow : undefined,
    disallow: disallow.length > 0 ? disallow : undefined,
  });

  return {
    rules,
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

