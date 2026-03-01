import { getCloudflareContext } from '@opennextjs/cloudflare';

interface Capsule {
  data: unknown;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

interface D1Database {
  prepare(query: string): {
    bind(...args: unknown[]): { run(): Promise<{ success: boolean }> };
  };
}

interface KVNamespace {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface CloudflareEnv {
  DB: D1Database;
  ANCHOR_STORE: KVNamespace;
}

interface BitcoinBlock {
  hash: string;
  height: number;
}

/** Compute a hex-encoded SHA-512 fingerprint for any JSON-serialisable value.
 *  SHA-512 is the primary sovereign hash. The Bitcoin network uses SHA-256
 *  internally; the Bitcoin block hash retrieved below is already a SHA-256
 *  digest expressed in hex — we carry it verbatim as the "Global Heartbeat"
 *  so AveryOS remains 100 % aligned with global consensus without truncating
 *  our own superior 512-bit fingerprint.
 */
async function sha512Hex(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const hashBuffer = await crypto.subtle.digest('SHA-512', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Fetch the latest Bitcoin block height + hash from Blockchain.com.
 *  Falls back gracefully so the sovereign anchor remains functional if the
 *  external API is unreachable.
 */
async function fetchBitcoinHeartbeat(): Promise<{ block_height: number; block_hash: string } | null> {
  try {
    const res = await fetch('https://blockchain.info/latestblock', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const block = (await res.json()) as BitcoinBlock;
    return { block_height: block.height, block_hash: block.hash };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'MALFORMED_JSON' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body)
  ) {
    return Response.json(
      { error: 'INVALID_CAPSULE', detail: 'Request body must be a JSON object with a "data" field' },
      { status: 400 },
    );
  }

  const capsule = body as Capsule;
  const timestamp = capsule.timestamp ?? new Date().toISOString();

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── 1. Sovereign fingerprint (SHA-512) ──────────────────────────────────
    const fingerprintPayload = { data: capsule.data, timestamp };
    const sha = await sha512Hex(fingerprintPayload);

    // ── 2. Global Heartbeat — Bitcoin block hash (best-effort) ─────────────
    const heartbeat = await fetchBitcoinHeartbeat();

    // ── 3. Compose stored record ────────────────────────────────────────────
    const storedCapsule: Capsule = {
      data: capsule.data,
      timestamp,
      metadata: {
        ...(capsule.metadata ?? {}),
        sovereign_sha512: sha,
        global_heartbeat: heartbeat
          ? {
              source: 'blockchain.info',
              block_height: heartbeat.block_height,
              block_hash: heartbeat.block_hash,
              fetched_at: new Date().toISOString(),
            }
          : { source: 'UNAVAILABLE', fetched_at: new Date().toISOString() },
      },
    };

    // ── 4. Store in ANCHOR_STORE KV (SHA-512 as key) ────────────────────────
    await cfEnv.ANCHOR_STORE.put(sha, JSON.stringify(storedCapsule));

    // ── 5. Record in D1 anchor_audit_logs ───────────────────────────────────
    await cfEnv.DB.prepare(
      'INSERT INTO anchor_audit_logs (anchored_at, sha512, btc_height, btc_hash) VALUES (?, ?, ?, ?)',
    )
      .bind(
        timestamp,
        sha,
        heartbeat?.block_height ?? null,
        heartbeat?.block_hash ?? null,
      )
      .run();

    return Response.json({
      status: 'ANCHORED',
      sha512: sha,
      timestamp,
      global_heartbeat: storedCapsule.metadata?.global_heartbeat,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'ANCHOR_DRIFT', detail: message }, { status: 500 });
  }
}
