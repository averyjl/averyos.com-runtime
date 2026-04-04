/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * Converts an entity slug (from URL paths or filenames) into a canonical entity ID
 * used in the retroactive_ledger table.
 *
 * Examples:
 *   "msft-oai-notice.pdf" → "MSFT_OAI"
 *   "goog-notice"         → "GOOG"
 *   "meta"                → "META"
 */
export function slugToEntityId(slug: string): string {
  const normalizedSlug = slug.replace(/\.pdf$/, "").replace(/\.html$/, "").toLowerCase();
  if (normalizedSlug.includes("msft") || normalizedSlug.includes("oai") || normalizedSlug.includes("microsoft") || normalizedSlug.includes("openai")) return "MSFT_OAI";
  if (normalizedSlug.includes("goog") || normalizedSlug.includes("google")) return "GOOG";
  if (normalizedSlug.includes("meta") || normalizedSlug.includes("facebook")) return "META";
  if (normalizedSlug.includes("amzn") || normalizedSlug.includes("amazon")) return "AMZN";
  if (normalizedSlug.includes("aapl") || normalizedSlug.includes("apple")) return "AAPL";
  return normalizedSlug.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

/**
 * Converts an entity name (from the DB) into a URL-safe slug for settlement notice links.
 * Example: "MSFT_OAI" → "msft-oai-notice"
 */
export function entityNameToSlug(entityName: string): string {
  return entityName.toLowerCase().replace(/[^a-z0-9]/g, "-");
}
