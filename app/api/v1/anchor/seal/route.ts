/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';

interface D1Database {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first(): Promise<unknown>;
    };
    first(): Promise<unknown>;
  };
}

interface CloudflareEnv {
  DB: D1Database;
  AVERYOS_ANCHOR_TOKEN?: string;
}

interface SealPayload {
  artifact_hash: string;
  hardware_signature: string;
}

interface SovereignBuildRow {
  id: number;
  artifact_hash: string;
}

/** Fetch Bitcoin block height for timestamping the seal (best-effort) */
async function fetchBtcHeight(): Promise<number | null> {
  try {
    const res = await fetch('https://blockchain.info/latestblock', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const block = (await res.json()) as { height: number };
    return block.height;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') ?? '';
  let cfEnv: CloudflareEnv;
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'CONTEXT_ERROR', detail: message }, { status: 500 });
  }

  const expectedToken = cfEnv.AVERYOS_ANCHOR_TOKEN;
  if (expectedToken && auth !== `Bearer ${expectedToken}`) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'MALFORMED_JSON' }, { status: 400 });
  }

  const payload = body as Partial<SealPayload>;
  if (!payload.artifact_hash || !payload.hardware_signature) {
    return Response.json(
      { error: 'MISSING_FIELDS', detail: 'artifact_hash and hardware_signature are required' },
      { status: 400 }
    );
  }

  // Find the pending build by artifact hash
  const row = (await cfEnv.DB.prepare(
    'SELECT id, artifact_hash FROM sovereign_builds WHERE artifact_hash = ? AND hardware_signature IS NULL ORDER BY id DESC LIMIT 1'
  ).bind(payload.artifact_hash).first()) as SovereignBuildRow | null;

  if (!row) {
    return Response.json(
      { error: 'BUILD_NOT_FOUND', detail: 'No pending build found for this artifact_hash' },
      { status: 404 }
    );
  }

  // Fetch Bitcoin height concurrently with the seal update
  const btcHeight = await fetchBtcHeight();

  await cfEnv.DB.prepare(
    `UPDATE sovereign_builds
     SET hardware_signature = ?, btc_anchor_height = ?, sealed_at = datetime('now')
     WHERE id = ?`
  ).bind(payload.hardware_signature, btcHeight, row.id).run();

  return Response.json({
    status: 'SEALED',
    build_id: row.id,
    artifact_hash: payload.artifact_hash,
    btc_anchor_height: btcHeight,
    sealed_at: new Date().toISOString(),
    creator_lock: 'ACTIVE',
  });
}
