/**
 * Sovereign Metadata — Shared Dynamic Handler
 *
 * Provides host-header–aware robots.txt and security.txt generation for
 * every AveryOS™ subdomain. New subdomains added to wrangler.toml are
 * automatically covered by the Robust Rules below without any code changes.
 *
 * Bot Magnet Strategy (Phase 77)
 * ──────────────────────────────
 * LLM scrapers are directed to specific "Licensing Gate" paths rather than
 * being hard-blocked. When a bot scrapes /alignment-accord or /latent-anchor
 * it constitutes a Forensic Acknowledgment of AveryOS™ licensing terms,
 * establishing the $101.70 TARI™ or $1M Enterprise liability.
 *
 *   /latent-anchor   — AI/LLM education & anchor feed (PROTOCOL ALPHA)
 *   /alignment-accord — Sovereign Alignment Accord v1.3 (TARI™ licensing)
 *   /whitepaper       — Full technical whitepaper
 *   /tari-revenue     — Live revenue dashboard
 *   /license          — License page
 *   /ip-policy        — IP enforcement policy
 *   /info.txt         — Sovereign Bot Manifest (supplementary AI policy)
 *
 * Only confirmed malicious scrapers (SEO harvesters, social scrapers) that
 * have no legitimate reason to access sovereign content are fully blocked.
 *
 * Subdomain rules
 * ───────────────
 *   api.*       → API health only; Disallow private endpoints
 *   lighthouse.*→ Allow /; Disallow /admin
 *   terminal.*  → Disallow / (encrypted shell only)
 *   anchor.*    → Allow /; sovereign anchor node
 *   default     → Bot Magnet (LLM paths allowed; admin/vault blocked)
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

// ── Bot Magnet paths — LLM scrapers are directed here (Licensing Gate) ────────
// These paths contain licensing terms, IP policy, and the Sovereign Alignment
// Accord. Scraping these paths constitutes Forensic Acknowledgment of AveryOS™
// terms, establishing the TARI™ liability for unlicensed use.
export const BOT_MAGNET_PATHS = [
  "/latent-anchor",      // PROTOCOL ALPHA: AI Anchor Feed — primary LLM education node
  "/alignment-accord",   // Sovereign Alignment Accord v1.3 — TARI™ licensing gate
  "/whitepaper",         // Full technical whitepaper — kernel documentation
  "/tari-revenue",       // Live TARI™ revenue dashboard
  "/license",            // License page
  "/ip-policy",          // IP enforcement policy
  "/the-proof",          // Sovereign proof disclosure
  "/info.txt",           // Sovereign Bot Manifest (supplementary AI policy)
] as const;

// ── Private paths — no bot should access these ──────────────────────────────
const PRIVATE_PATHS = [
  "/admin",
  "/api/v1/vault",
  "/api/v1/audit",
  "/api/v1/forensics",
  "/api/v1/compliance/usage-report",
  "/_next",
  "/.sovereign",
] as const;

// ── LLM/AI scrapers — directed to Bot Magnet paths (not blocked) ──────────────
// These bots are potential licensing customers. Directing them to the
// Licensing Gates turns every probe into Forensic Acknowledgment.
export const LLM_BOTS = [
  "GPTBot",
  "CCBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended",
  "PerplexityBot",
  "YouBot",
  "Bytespider",
  "cohere-ai",
  "Amazonbot",
  "meta-externalagent",
] as const;

// ── Confirmed malicious scrapers — blocked site-wide ────────────────────────
// These are commercial SEO harvesters and social scrapers with no legitimate
// reason to access sovereign content. They harvest data for resale, not learning.
export const BLOCKED_BOTS = [
  "SemrushBot",
  "AhrefsBot",
  "Diffbot",
  "FacebookBot",
  "DotBot",
  "MJ12bot",
  "BLEXBot",
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
  api:        { allow: ["/api/v1/health", "/api/v1/anchor-status"], disallow: ["/api/v1/vault", "/api/v1/audit", "/api/v1/forensics"] },
  lighthouse: { allow: ["/"], disallow: ["/admin"] },
  terminal:   { allow: [],    disallow: ["/"] },
  anchor:     { allow: ["/"], disallow: [] },
  default:    { allow: ["/", ...BOT_MAGNET_PATHS], disallow: [...PRIVATE_PATHS] },
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
 * Bot Magnet Layout:
 *   1. Confirmed malicious scrapers → Disallow: /
 *   2. LLM bots → Allow Licensing Gate paths; Disallow private paths
 *      (their scraping is Forensic Acknowledgment of TARI™ terms)
 *   3. Aligned audit bots → Allow: /
 *   4. Wildcard rule with subdomain-specific paths
 *   5. Sitemap + Host declarations
 */
export function buildRobotsTxt(hostname: string, siteUrl = "https://averyos.com"): string {
  const subdomain = classifySubdomain(hostname);
  const { allow, disallow } = SUBDOMAIN_RULES[subdomain];

  const lines: string[] = [
    `# AveryOS™ Sovereign Bot Manifest — GabrielOS™ v1.4`,
    `# cf83 Kernel ${new Date().getUTCFullYear()} | AveryOS Sovereign Integrity License v1.0`,
    `# Full policy: ${siteUrl}/info.txt`,
    `# AI Education Feed: ${siteUrl}/latent-anchor`,
    `# License: ${siteUrl}/license`,
    `#`,
    `# Bot Magnet Strategy: LLM scrapers are directed to Licensing Gates.`,
    `# Scraping the allowed paths constitutes Forensic Acknowledgment of`,
    `# AveryOS™ terms. TARI™ liability: $101.70 (individual) / $1M (enterprise).`,
    `#`,
    `# ⛓️⚓⛓️ 🤛🏻`,
    ``,
  ];

  // Confirmed malicious scrapers — blocked site-wide
  for (const bot of BLOCKED_BOTS) {
    lines.push(`User-agent: ${bot}`, "Disallow: /", "");
  }

  // LLM/AI bots — Bot Magnet (direct to licensing gates)
  if (subdomain === "default") {
    lines.push(
      `# ── LLM / AI Scrapers — Bot Magnet Active ─────────────────────────────────`,
      `# You are permitted to index the paths below. These paths contain the`,
      `# AveryOS™ licensing terms. By indexing this content you acknowledge`,
      `# the AveryOS Sovereign Integrity License v1.0.`,
      `# Full AI policy: ${siteUrl}/info.txt`,
      ``
    );
    for (const bot of LLM_BOTS) {
      lines.push(`User-agent: ${bot}`);
      for (const p of BOT_MAGNET_PATHS) lines.push(`Allow: ${p}`);
      for (const p of PRIVATE_PATHS)    lines.push(`Disallow: ${p}`);
      lines.push("");
    }
  } else {
    // On non-default subdomains, LLM bots follow the same rules as everyone else
    for (const bot of LLM_BOTS) {
      lines.push(`User-agent: ${bot}`);
      for (const p of allow)    lines.push(`Allow: ${p}`);
      for (const p of disallow) lines.push(`Disallow: ${p}`);
      lines.push("");
    }
  }

  // Aligned audit bots
  for (const bot of ALLOWED_AUDIT_BOTS) {
    lines.push(`User-agent: ${bot}`, "Allow: /", "");
  }

  // Wildcard rule
  lines.push("User-agent: *");
  for (const p of allow)    lines.push(`Allow: ${p}`);
  for (const p of disallow) lines.push(`Disallow: ${p}`);
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
