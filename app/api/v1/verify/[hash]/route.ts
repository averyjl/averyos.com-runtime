import { getCloudflareContext } from '@opennextjs/cloudflare';
import { BADGE_STATUS_ACTIVE } from '../../../../../lib/sovereignConstants';

interface D1PreparedStatement {
  bind(...args: unknown[]): { first<T = unknown>(): Promise<T | null> };
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

interface AlignmentRow {
  partner_id: string;
  partner_name: string | null;
  email: string;
  alignment_type: string;
  settlement_id: string | null;
  tari_reference: string | null;
  valid_until: string | null;
  aligned_at: string;
  status: string;
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

    // Check both alignment_hash (certificate) and badge_hash (legacy badge)
    const row = await cfEnv.DB.prepare(
      `SELECT partner_id, partner_name, email, alignment_type, settlement_id,
              tari_reference, valid_until, aligned_at, status
       FROM sovereign_alignments
       WHERE alignment_hash = ? OR badge_hash = ?
       LIMIT 1`,
    )
      .bind(hash, hash)
      .first<AlignmentRow>();

    if (!row) {
      return Response.json(
        {
          resonance: 'DRIFT_ALERT',
          alignment_hash: hash,
          detail:
            'No sovereign alignment found for this hash. Certificate unknown or not yet issued.',
        },
        { status: 404 },
      );
    }

    if (row.status !== BADGE_STATUS_ACTIVE) {
      return Response.json(
        {
          resonance: 'DRIFT_ALERT',
          alignment_hash: hash,
          partner_id: row.partner_id,
          partner_name: row.partner_name,
          alignment_type: row.alignment_type,
          aligned_at: row.aligned_at,
          status: row.status,
          detail:
            'Alignment certificate has been revoked. Entity is no longer in sovereign alignment.',
        },
        { status: 410 },
      );
    }

    // Check certificate expiry when valid_until is set
    if (row.valid_until) {
      const expiry = new Date(row.valid_until);
      if (!isNaN(expiry.getTime()) && expiry < new Date()) {
        return Response.json(
          {
            resonance: 'DRIFT_ALERT',
            alignment_hash: hash,
            partner_id: row.partner_id,
            partner_name: row.partner_name,
            alignment_type: row.alignment_type,
            valid_until: row.valid_until,
            detail:
              'Alignment certificate has expired. Entity must renew their TARI™ settlement.',
          },
          { status: 410 },
        );
      }
    }

    return Response.json({
      resonance: 'HIGH_FIDELITY_SUCCESS',
      alignment_hash: hash,
      partner_id: row.partner_id,
      partner_name: row.partner_name,
      email: row.email,
      alignment_type: row.alignment_type,
      settlement_id: row.settlement_id,
      tari_reference: row.tari_reference,
      valid_until: row.valid_until,
      aligned_at: row.aligned_at,
      status: row.status,
      verified_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'VERIFICATION_ERROR', detail: message }, { status: 500 });
  }
}
