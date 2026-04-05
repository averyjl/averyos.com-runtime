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
 * GET /.well-known/pgp-key.txt
 *
 * Serves the AveryOS™ Creator PGP public key (Jason Lee Avery / ROOT0).
 *
 * Referenced by:
 *   • /.well-known/security.txt  — RFC 9116 §2.5.4 Encryption field
 *   • /.well-known/did.json      — PGP verification method
 *   • /.well-known/averyos.json  — Sovereign Identity Document
 *
 * Key details:
 *   UID:         Jason Lee Avery (AveryOS) <cf83@averyos.com>
 *   Fingerprint: C8C5CBDD 150AEA02 F26A8F0B 481AAA30 DF1373E4
 *   Key ID:      481AAA30DF1373E4
 *   Algorithm:   Ed25519 / Curve25519 (OpenPGP v4)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { PGP_PUBLIC_KEY, PGP_KEY_FINGERPRINT, PGP_KEY_ID } from "../../../lib/sovereignConstants";

export async function GET(): Promise<Response> {
  return new Response(PGP_PUBLIC_KEY + "\n", {
    status: 200,
    headers: {
      "Content-Type":           "application/pgp-keys; charset=utf-8",
      "Cache-Control":          "public, max-age=86400, s-maxage=86400",
      "Content-Disposition":    'inline; filename="pgp-key.txt"',
      "X-AveryOS-Anchor":       "cf83-v3.6.2",
      "X-PGP-Fingerprint":      PGP_KEY_FINGERPRINT,
      "X-PGP-Key-ID":           PGP_KEY_ID,
    },
  });
}
