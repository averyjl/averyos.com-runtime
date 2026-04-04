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

interface D1PreparedStatement {
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

export interface PartnerRow {
  partner_id: string;
  partner_name: string | null;
  alignment_type: string;
  alignment_hash: string | null;
  badge_hash: string;
  tari_reference: string | null;
  aligned_at: string;
  valid_until: string | null;
  status: string;
}

const MAX_PARTNERS_PER_REQUEST = 100;

/**
 * GET /api/v1/partners
 * Returns all ACTIVE sovereign alignment records for the Partner Directory.
 */
export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const { results } = await cfEnv.DB.prepare(
      `SELECT partner_id, partner_name, alignment_type, alignment_hash, badge_hash,
              tari_reference, aligned_at, valid_until, status
       FROM sovereign_alignments
       WHERE status = 'ACTIVE'
       ORDER BY aligned_at DESC
       LIMIT ${MAX_PARTNERS_PER_REQUEST}`,
    ).all<PartnerRow>();

    return Response.json({ partners: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
