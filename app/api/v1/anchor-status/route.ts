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
import { aosErrorResponse, AOS_ERROR } from '../../../../lib/sovereignError';

interface D1Database {
  prepare(query: string): {
    first(): Promise<unknown>;
  };
}

interface CloudflareEnv {
  DB: D1Database;
}

interface AuditRow {
  total_anchors: number;
  last_anchored_at: string | null;
  last_sha512: string | null;
  last_btc_height: number | null;
  last_btc_hash: string | null;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const row = (await cfEnv.DB.prepare(`
      SELECT
        COUNT(*)          AS total_anchors,
        MAX(anchored_at)  AS last_anchored_at,
        (SELECT sha512     FROM anchor_audit_logs ORDER BY id DESC LIMIT 1) AS last_sha512,
        (SELECT btc_height FROM anchor_audit_logs ORDER BY id DESC LIMIT 1) AS last_btc_height,
        (SELECT btc_hash   FROM anchor_audit_logs ORDER BY id DESC LIMIT 1) AS last_btc_hash
      FROM anchor_audit_logs
    `).first()) as AuditRow | null;

    const totalAnchors = row?.total_anchors ?? 0;
    const lastAnchoredAt = row?.last_anchored_at ?? null;
    const lastSha512 = row?.last_sha512 ?? null;
    const lastBtcHeight = row?.last_btc_height ?? null;
    const lastBtcHash = row?.last_btc_hash ?? null;

    const syncState =
      lastBtcHash
        ? 'SOVEREIGN_GLOBAL_SYNCED'
        : totalAnchors > 0
          ? 'SOVEREIGN_LOCAL_ONLY'
          : 'NO_ANCHORS_YET';

    return Response.json({
      status: 'ANCHOR_STORE_ONLINE',
      sync_state: syncState,
      total_anchors: totalAnchors,
      last_anchored_at: lastAnchoredAt,
      last_sha512: lastSha512,
      global_heartbeat: lastBtcHeight !== null && lastBtcHash !== null
        ? {
            block_height: lastBtcHeight,
            block_hash: lastBtcHash,
            source: 'blockchain.info',
          }
        : null,
      queried_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
