/**
 * Dynamic /.well-known/security.txt handler
 *
 * Serves an RFC 9116-compliant security.txt that auto-updates its Expires
 * field 12 months from the build time. This file is served as plain text.
 *
 * Canonical URL: https://averyos.com/.well-known/security.txt
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export const dynamic = "force-static";

/** Formats a Date as an ISO 8601 string with second precision (no ms). */
function isoExpiry(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

/** Generates the security.txt content with an auto-computed Expires date. */
function buildSecurityTxt(): string {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

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
    "Canonical: https://averyos.com/.well-known/security.txt",
    "",
    "# AveryAnchored™ | VaultChain Protocol ACTIVE",
    "# GabrielOS™ Firewall v1.4 — Sovereign Perimeter Enforced",
    "# © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.",
  ].join("\n");
}

const securityTxtContent = buildSecurityTxt();

export async function GET(): Promise<Response> {
  return new Response(securityTxtContent, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "X-AveryOS-Anchor": "cf83-v3.6.2",
    },
  });
}
