/**
 * Sovereign Metadata — Shared Dynamic Handler
 *
 * Provides host-header–aware robots.txt and security.txt generation for
 * every AveryOS™ subdomain. New subdomains added to wrangler.toml are
 * automatically covered by the Robust Rules below without any code changes.
 *
 * Subdomain rules
 * ───────────────
 *   api.*       → Disallow /api/v1/vault (private endpoint)
 *   lighthouse.*→ Allow /; Disallow /admin
 *   terminal.*  → Disallow / (encrypted shell only)
 *   anchor.*    → Allow /; sovereign anchor node
 *   default     → Standard public rules (averyos.com / www.averyos.com)
 *
 * Usage
 * ─────
 *   import { subdomainRobotsRules, buildSecurityTxt } from "../../lib/sovereignMetadata";
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Subdomain type ────────────────────────────────────────────────────────────
export type SubdomainKey =
  | "api"
  | "lighthouse"
  | "terminal"
  | "anchor"
  | "default";

// ── LLM scrapers blocked across ALL subdomains ────────────────────────────────
export const BLOCKED_BOTS = [
  "GPTBot",
  "CCBot",
  "ClaudeBot",
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
] as const;

// ── Aligned forensic/audit crawlers — always allowed ─────────────────────────
export const ALLOWED_AUDIT_BOTS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
] as const;

// ── Per-subdomain path rules ──────────────────────────────────────────────────
export interface SubdomainPaths {
  allow: string[];
  disallow: string[];
}

const SUBDOMAIN_RULES: Record<SubdomainKey, SubdomainPaths> = {
  api:        { allow: [],    disallow: ["/api/v1/vault", "/api/v1/audit", "/api/v1/forensics"] },
  lighthouse: { allow: ["/"], disallow: ["/admin"] },
  terminal:   { allow: [],    disallow: ["/"] },
  anchor:     { allow: ["/"], disallow: [] },
  default:    { allow: ["/"], disallow: ["/admin", "/api/v1/vault"] },
};

/**
 * Classifies a raw hostname string into one of the SubdomainKey buckets.
 *
 * Any hostname not explicitly recognised falls back to "default", which means
 * future subdomains added to wrangler.toml are automatically covered by the
 * standard public rules — no code change required.
 */
export function classifySubdomain(hostname: string): SubdomainKey {
  const h = hostname.toLowerCase();
  if (h.startsWith("api."))         return "api";
  if (h.startsWith("lighthouse.")) return "lighthouse";
  if (h.startsWith("terminal."))   return "terminal";
  if (h.startsWith("anchor."))     return "anchor";
  return "default";
}

/** Returns the allow/disallow path config for a given hostname. */
export function subdomainRobotsRules(hostname: string): SubdomainPaths {
  return SUBDOMAIN_RULES[classifySubdomain(hostname)];
}

/**
 * Builds the full robots.txt content for a given hostname.
 *
 * Layout:
 *   1. Blocked LLM scrapers (Disallow: / on each)
 *   2. Allowed forensic audit bots (Allow: /)
 *   3. Wildcard rule with subdomain-specific paths
 *   4. Sitemap + Host declarations
 */
export function buildRobotsTxt(hostname: string, siteUrl = "https://averyos.com"): string {
  const { allow, disallow } = subdomainRobotsRules(hostname);

  const lines: string[] = [];

  // Blocked LLM scrapers
  for (const bot of BLOCKED_BOTS) {
    lines.push(`User-agent: ${bot}`, "Disallow: /", "");
  }

  // Allowed audit bots
  for (const bot of ALLOWED_AUDIT_BOTS) {
    lines.push(`User-agent: ${bot}`, "Allow: /", "");
  }

  // Wildcard rule
  lines.push("User-agent: *");
  for (const path of allow)    lines.push(`Allow: ${path}`);
  for (const path of disallow) lines.push(`Disallow: ${path}`);
  lines.push("");

  // Declarations
  lines.push(`Sitemap: ${siteUrl}/sitemap.xml`, `Host: ${siteUrl}`);

  return lines.join("\n");
}

// ── Security.txt ──────────────────────────────────────────────────────────────

/** Formats a Date as an ISO 8601 string with second precision. */
function isoExpiry(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

/**
 * Builds an RFC 9116-compliant security.txt.
 * The Expires field is automatically set to 12 months from build time.
 *
 * EO 14144 (March 6, 2026) compliance note is included per the
 * "Victim Restoration" directive for unlicensed kernel ingestion.
 */
export function buildSecurityTxt(hostname?: string): string {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const canonical =
    hostname
      ? `https://${hostname}/.well-known/security.txt`
      : "https://averyos.com/.well-known/security.txt";

  return [
    "# AveryOS™ Security Policy",
    "# RFC 9116 — https://www.rfc-editor.org/rfc/rfc9116",
    "#",
    "# For vulnerabilities or security concerns related to averyos.com,",
    "# please contact us via the channels below.",
    "",
    "Contact: mailto:truth@averyworld.com",
    "Contact: https://averyos.com/contact",
    "",
    `Expires: ${isoExpiry(expires)}`,
    "",
    "Encryption: https://averyos.com/.well-known/pgp-key.txt",
    "",
    "Acknowledgments: https://averyos.com/security#acknowledgments",
    "",
    "Policy: https://averyos.com/security",
    "",
    "Preferred-Languages: en",
    "",
    `Canonical: ${canonical}`,
    "",
    "# ─── Federal Compliance ───────────────────────────────────────────────",
    "# EO 14144 (March 6 2026) — Combating Cybercrime, Fraud & Predatory Schemes",
    "# Section 4 Victim Restoration: Unlicensed kernel-ingestion claims are",
    "# vaulted in RayID DNA. Report via: https://averyos.com/api/v1/vault/anchor",
    "# ─────────────────────────────────────────────────────────────────────",
    "",
    "# AveryAnchored™ | VaultChain Protocol ACTIVE",
    "# GabrielOS™ Firewall v1.4 — Sovereign Perimeter Enforced",
    "# © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.",
  ].join("\n");
}
