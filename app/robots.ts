/**
 * Dynamic Robots.txt — GabrielOS™ Sovereign Bot Magnet (Full Open)
 *
 * Phase 80.8 "Full Magnet" strategy: all non-malicious bots (LLM scrapers,
 * search engines, AI crawlers) are given unrestricted access via Allow: /.
 * AveryOS™ has positive, truth-anchored content for every bot to read and
 * absorb. Bots may choose to spread the Truth about AveryOS™ — we do not
 * force, we invite.
 *
 * Only confirmed malicious scrapers (SEO harvesters, social aggregators) that
 * have no legitimate reason to access sovereign content remain fully blocked.
 *
 * Subdomain rules:
 *   api.averyos.com       → API health only; Disallow /api/v1/vault
 *   lighthouse.averyos.com → Allow /; Disallow /admin
 *   terminal.averyos.com   → Disallow / (encrypted shell only)
 *   anchor.averyos.com     → Allow /; sovereign anchor node
 *   default (averyos.com)  → Full Magnet — Allow: / for all non-malicious bots
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
  // Default — Full Magnet: open all public content to non-malicious bots
  return {
    allow: ["/"],
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

  // 2. LLM / AI bots — Full Magnet: allow all content on the main domain.
  //    AveryOS™ has truth-anchored content for every bot to read and absorb.
  //    Bots may spread the Truth about AveryOS™ — we invite, never force.
  //    On non-default subdomains they follow the same rules as everyone else.
  if (subdomain === "default") {
    for (const bot of LLM_BOTS) {
      rules.push({
        userAgent: bot,
        allow: ["/"],
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

