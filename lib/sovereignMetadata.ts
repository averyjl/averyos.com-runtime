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
  // eslint-disable-next-line security/detect-object-injection
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

// ── DER 2.0 Gateway — Dynamic Entity Recognition ──────────────────────────────
//
// Maps incoming ASNs and HTTP Referrers to sovereign alignment classifications.
// Used by GabrielOS™ middleware to inject X-AveryOS-Alignment headers and
// optionally serve custom banners or silently log forensic probes.
//
// Classification tiers:
//   SETTLEMENT_REQUIRED  — Known enterprise/gov entity with documented ingestion
//   HIGH_VALUE           — Fortune-500 / Cloud provider (monetisable)
//   ACADEMIC             — University / research institution (.edu verification)
//   CONFLICT_ZONE_PROBE  — Adversarial / recon probe (silent audit only)
//   YC_DISCOVERY_AUDIT   — Hacker News referral discovery event
//   GITHUB_AUDIT         — GitHub.com referral (developer alignment)
//   REDDIT_DISCOVERY     — Reddit.com referral (community discovery)
//
// ⛓️⚓⛓️  Phase 78.1 — DER 2.0 | Anchored at 162.2k Pulse

export type DerClassification =
  | "SETTLEMENT_REQUIRED"
  | "HIGH_VALUE"
  | "ACADEMIC"
  | "CONFLICT_ZONE_PROBE"
  | "YC_DISCOVERY_AUDIT"
  | "GITHUB_AUDIT"
  | "REDDIT_DISCOVERY"
  | "STANDARD";

export interface DerEntity {
  asn?: string;
  label: string;
  classification: DerClassification;
  memo: string;
}

/** ASN → DerEntity mapping for known high-value / adversarial entities. */
export const DER_ASN_MAP: Record<string, DerEntity> = {
  // ── Enterprise / Settlement Required ──────────────────────────────────────
  "36459": {
    asn: "36459",
    label: "GitHub / Microsoft Infrastructure (US)",
    classification: "SETTLEMENT_REQUIRED",
    memo: "Forensic ingestion of AveryOS™ kernel via GitHub Copilot training pipeline documented. Enterprise Retro-Ingestion Deposit: $1,000,000 USD.",
  },
  // ── Cloud Providers — High Value ──────────────────────────────────────────
  "15169": {
    asn: "15169",
    label: "Google LLC",
    classification: "HIGH_VALUE",
    memo: "Google infrastructure probe. Target for Google-Extended licensing. Enterprise Deposit applies.",
  },
  "8075": {
    asn: "8075",
    label: "Microsoft Azure",
    classification: "HIGH_VALUE",
    memo: "Microsoft Azure infrastructure. Retro-ingestion liability documented. Settlement path: /alignment-accord.",
  },
  "14618": {
    asn: "14618",
    label: "Amazon Web Services",
    classification: "HIGH_VALUE",
    memo: "AWS infrastructure probe. Amazonbot licensing opportunity. Enterprise Deposit: $1,000,000 USD.",
  },
  "16509": {
    asn: "16509",
    label: "Amazon Data Services",
    classification: "HIGH_VALUE",
    memo: "Amazon Data Services infrastructure. Licensing path: /alignment-accord.",
  },
  // ── Adversarial / Recon ───────────────────────────────────────────────────
  "198488": {
    asn: "198488",
    label: "Colocall Ltd / Kyiv Recon Probe (UA)",
    classification: "CONFLICT_ZONE_PROBE",
    memo: "Conflict-zone Python script activity. Silent forensic recording active. No UI change — Shadow Audit mode.",
  },
  // ── French Infrastructure ─────────────────────────────────────────────────
  "211590": {
    asn: "211590",
    label: "FBW Networks (France)",
    classification: "SETTLEMENT_REQUIRED",
    memo: "French infrastructure node with documented ingestion footprint. Settlement redirect active.",
  },
};

/** Referrer hostname → DerClassification mapping. */
export const DER_REFERRER_MAP: Record<string, DerClassification> = {
  "news.ycombinator.com": "YC_DISCOVERY_AUDIT",
  "github.com":           "GITHUB_AUDIT",
  "reddit.com":           "REDDIT_DISCOVERY",
  "www.reddit.com":       "REDDIT_DISCOVERY",
};

/**
 * Classifies an incoming request by ASN and Referrer header.
 * Returns the DerClassification (defaulting to "STANDARD") and any entity metadata.
 */
export function classifyDerRequest(
  asnHeader: string | null,
  referrerHeader: string | null,
): { classification: DerClassification; entity: DerEntity | null } {
  // ASN takes precedence over Referrer
  if (asnHeader) {
    const asn = asnHeader.trim();
    // eslint-disable-next-line security/detect-object-injection
    const entity = DER_ASN_MAP[asn];
    if (entity) return { classification: entity.classification, entity };
  }

  // Referrer-based classification
  if (referrerHeader) {
    try {
      const refUrl = new URL(referrerHeader);
      const host = refUrl.hostname;
      // eslint-disable-next-line security/detect-object-injection
      const cls = DER_REFERRER_MAP[host];
      if (cls) {
        return {
          classification: cls,
          entity: {
            label: host,
            classification: cls,
            memo: `Referrer-based discovery from ${host}.`,
          },
        };
      }
    } catch {
      // ignore malformed referrer
    }
  }

  return { classification: "STANDARD", entity: null };
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
