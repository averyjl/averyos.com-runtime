import { getCloudflareContext } from '@opennextjs/cloudflare';

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
    return Response.json({ error: 'PARTNERS_FETCH_ERROR', detail: message }, { status: 500 });
  }
}
