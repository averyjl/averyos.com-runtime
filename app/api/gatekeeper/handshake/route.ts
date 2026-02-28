import { getCloudflareContext } from "@opennextjs/cloudflare";
import { formatIso9 } from "../../../../lib/timePrecision";

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
      return Response.json({ error: "PASSPHRASE_REQUIRED" }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Check against VAULT_PASSPHRASE secret (set via Cloudflare secret store)
    // Falls back to GITHUB_PAT if VAULT_PASSPHRASE is not set (for dev/staging)
    const expected = cfEnv.VAULT_PASSPHRASE ?? "";

    if (!expected) {
      // No passphrase configured — deny access in all environments
      return Response.json(
        { error: "VAULT_NOT_CONFIGURED", detail: "VAULT_PASSPHRASE secret is not set." },
        { status: 503 },
      );
    }

    if (provided !== expected) {
      return Response.json(
        { error: "SOVEREIGN_HANDSHAKE_DENIED", timestamp: formatIso9() },
        { status: 401 },
      );
    }

    return Response.json({
      status: "SOVEREIGN_HANDSHAKE_GRANTED",
      timestamp: formatIso9(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "HANDSHAKE_ERROR", detail: message }, { status: 500 });
  }
}
