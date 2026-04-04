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
import { BADGE_STATUS_ACTIVE } from '../../../../../../lib/sovereignConstants';
import { aosErrorResponse, AOS_ERROR } from '../../../../../../lib/sovereignError';

interface D1Result {
  partner_id: string;
  email: string;
  alignment_type: string;
  aligned_at: string;
  status: string;
}

interface D1Database {
  prepare(query: string): {
    bind(...args: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
    };
  };
}

interface CloudflareEnv {
  DB: D1Database;
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

    const row = await cfEnv.DB.prepare(
      'SELECT partner_id, email, alignment_type, aligned_at, status FROM sovereign_alignments WHERE badge_hash = ? LIMIT 1',
    )
      .bind(hash)
      .first<D1Result>();

    if (!row) {
      return aosErrorResponse(AOS_ERROR.NOT_FOUND, 'No alignment found for this badge hash');
    }

    if (row.status !== BADGE_STATUS_ACTIVE) {
      return Response.json(
        {
          resonance: 'REVOKED',
          badge_hash: hash,
          partner_id: row.partner_id,
          alignment_type: row.alignment_type,
          aligned_at: row.aligned_at,
          status: row.status,
        },
        { status: 410 },
      );
    }

    return Response.json({
      resonance: 'VERIFIED',
      badge_hash: hash,
      partner_id: row.partner_id,
      alignment_type: row.alignment_type,
      aligned_at: row.aligned_at,
      status: row.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
