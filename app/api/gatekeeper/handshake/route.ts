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
