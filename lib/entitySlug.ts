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
