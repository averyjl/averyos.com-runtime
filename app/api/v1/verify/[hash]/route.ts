import { getCloudflareContext } from '@opennextjs/cloudflare';

interface Capsule {
  data: unknown;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
}

interface CloudflareEnv {
  ANCHOR_STORE: KVNamespace;
}

async function sha512Hex(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const hashBuffer = await crypto.subtle.digest('SHA-512', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface RouteParams {
  params: Promise<{ hash: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { hash } = await params;

  if (!hash || !/^[a-fA-F0-9]{128}$/.test(hash)) {
    return Response.json(
      { error: 'INVALID_HASH', detail: 'Hash must be a 128-character SHA-512 hex string' },
      { status: 400 },
    );
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const raw = await cfEnv.ANCHOR_STORE.get(hash);
    if (!raw) {
      return Response.json({ error: 'NOT_FOUND', detail: 'No capsule found for this hash' }, { status: 404 });
    }

    let capsule: Capsule;
    try {
      capsule = JSON.parse(raw) as Capsule;
    } catch {
      return Response.json({ error: 'CORRUPT_CAPSULE', detail: 'Stored capsule is not valid JSON' }, { status: 500 });
    }

    // Re-derive fingerprint from the canonical payload fields to prove integrity
    const recomputed = await sha512Hex({ data: capsule.data, timestamp: capsule.timestamp });
    const intact = recomputed === hash;

    return Response.json({
      status: intact ? 'INTEGRITY_VERIFIED' : 'INTEGRITY_FAILED',
      requested_hash: hash,
      recomputed_sha512: recomputed,
      intact,
      capsule,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'VERIFICATION_ERROR', detail: message }, { status: 500 });
  }
}
