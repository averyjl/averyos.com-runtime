/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { formatIso9 } from "../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";

interface CloudflareEnv {
  VAULT_PASSPHRASE?: string;
}

type HandshakeRequest = {
  passphrase?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as HandshakeRequest;
    const provided =
      typeof body.passphrase === "string" ? body.passphrase.trim() : "";

    if (!provided) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'passphrase is required');
    }

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Check against VAULT_PASSPHRASE secret (set via Cloudflare secret store).
    // Trim both sides so trailing whitespace/newlines from env-var editors don't
    // silently break comparison.
    const expected = (cfEnv.VAULT_PASSPHRASE ?? "").trim();

    if (!expected) {
      // No passphrase configured — deny access in all environments
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, 'VAULT_PASSPHRASE secret is not set.');
    }

    if (provided !== expected) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, 'Sovereign handshake denied. Invalid passphrase.');
    }

    return Response.json({
      status: "SOVEREIGN_HANDSHAKE_GRANTED",
      timestamp: formatIso9(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
