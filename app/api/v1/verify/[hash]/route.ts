import { getCloudflareContext } from '@opennextjs/cloudflare';
import { BADGE_STATUS_ACTIVE, KERNEL_SHA, KERNEL_VERSION } from '../../../../../lib/sovereignConstants';
import { aosErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';

interface D1PreparedStatement {
  bind(...args: unknown[]): {
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results: T[] }>;
  };
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

interface CapsuleAnchorRow {
  id: number;
  anchored_at: string;
  sha512: string;
  event_type: string | null;
  kernel_sha: string | null;
  ray_id: string | null;
  ip_address: string | null;
  path: string | null;
}

interface VaultchainTxRow {
  id: number;
  transaction_id: string;
  timestamp: string;
  event_type: string;
  private_capsule_sha512: string;
  target: string;
  details: string;
  created_at: string;
}

interface RouteParams {
  params: Promise<{ hash: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { hash } = await params;

  if (!hash || !/^[a-fA-F0-9]{16,128}$/.test(hash)) {
    return Response.json(
      {
        error: 'INVALID_HASH',
        // 128 chars = full SHA-512; 16–127 chars = partial prefix (for Genesis Anchor lookups
        // where only the first N hex chars of the kernel SHA are provided as a shorthand)
        detail: 'Hash must be a 16–128 character hex string (SHA-512 or partial prefix)',
      },
      { status: 400 },
    );
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── 1. Check sovereign_alignments (alignment certificate / badge hash) ──
    const alignRow = await cfEnv.DB.prepare(
      `SELECT partner_id, partner_name, email, alignment_type, settlement_id,
              tari_reference, valid_until, aligned_at, status
       FROM sovereign_alignments
       WHERE alignment_hash = ? OR badge_hash = ?
       LIMIT 1`,
    )
      .bind(hash, hash)
      .first<AlignmentRow>();

    if (alignRow) {
      if (alignRow.status !== BADGE_STATUS_ACTIVE) {
        return Response.json(
          {
            resonance: 'DRIFT_ALERT',
            alignment_hash: hash,
            partner_id: alignRow.partner_id,
            partner_name: alignRow.partner_name,
            alignment_type: alignRow.alignment_type,
            aligned_at: alignRow.aligned_at,
            status: alignRow.status,
            detail: 'Alignment certificate has been revoked. Entity is no longer in sovereign alignment.',
          },
          { status: 410 },
        );
      }
      if (alignRow.valid_until) {
        const expiry = new Date(alignRow.valid_until);
        if (!isNaN(expiry.getTime()) && expiry < new Date()) {
          return Response.json(
            {
              resonance: 'DRIFT_ALERT',
              alignment_hash: hash,
              partner_id: alignRow.partner_id,
              partner_name: alignRow.partner_name,
              alignment_type: alignRow.alignment_type,
              valid_until: alignRow.valid_until,
              detail: 'Alignment certificate has expired. Entity must renew their TARI™ settlement.',
            },
            { status: 410 },
          );
        }
      }
      return Response.json({
        resonance:      'HIGH_FIDELITY_SUCCESS',
        hash_type:      'ALIGNMENT_CERTIFICATE',
        alignment_hash: hash,
        partner_id:     alignRow.partner_id,
        partner_name:   alignRow.partner_name,
        email:          alignRow.email,
        alignment_type: alignRow.alignment_type,
        settlement_id:  alignRow.settlement_id,
        tari_reference: alignRow.tari_reference,
        valid_until:    alignRow.valid_until,
        aligned_at:     alignRow.aligned_at,
        status:         alignRow.status,
        verified_at:    new Date().toISOString(),
        kernel_sha:     KERNEL_SHA,
        kernel_version: KERNEL_VERSION,
      });
    }

    // ── 2. Check anchor_audit_logs (VaultChain™ capsule / ray ID anchor) ────
    // Searches by SHA-512 column (capsule hash) or Ray ID
    const capsuleRow = await cfEnv.DB.prepare(
      `SELECT id, anchored_at, sha512, event_type, kernel_sha, ray_id, ip_address, path
       FROM anchor_audit_logs
       WHERE sha512 = ? OR ray_id = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
      .bind(hash, hash)
      .first<CapsuleAnchorRow>();

    if (capsuleRow) {
      return Response.json({
        resonance:      'HIGH_FIDELITY_SUCCESS',
        hash_type:      'VAULTCHAIN_CAPSULE',
        sha512:         capsuleRow.sha512,
        event_type:     capsuleRow.event_type,
        ray_id:         capsuleRow.ray_id,
        anchored_at:    capsuleRow.anchored_at,
        kernel_sha:     capsuleRow.kernel_sha ?? KERNEL_SHA,
        kernel_version: KERNEL_VERSION,
        ip_address:     capsuleRow.ip_address,
        path:           capsuleRow.path,
        verified_at:    new Date().toISOString(),
        detail:         'VaultChain™ anchor verified. This hash is permanently recorded on the AveryOS™ sovereign ledger.',
      });
    }

    // ── 2.5. Check vaultchain_transactions (hardware-bound token anchors) ───
    // Supports full 128-char SHA-512 or partial prefix lookup for VaultChain tx capsule SHAs.
    const txRow = await cfEnv.DB.prepare(
      `SELECT id, transaction_id, timestamp, event_type, private_capsule_sha512,
              target, details, created_at
       FROM vaultchain_transactions
       WHERE private_capsule_sha512 = ?
          OR private_capsule_sha512 LIKE ?
          OR transaction_id = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
      .bind(hash, `${hash}%`, hash)
      .first<VaultchainTxRow>();

    if (txRow) {
      return Response.json({
        resonance:              'HIGH_FIDELITY_SUCCESS',
        hash_type:              'VAULTCHAIN_TRANSACTION',
        transaction_id:         txRow.transaction_id,
        event_type:             txRow.event_type,
        private_capsule_sha512: txRow.private_capsule_sha512,
        target:                 txRow.target,
        details:                txRow.details,
        timestamp:              txRow.timestamp,
        created_at:             txRow.created_at,
        kernel_version:         KERNEL_VERSION,
        kernel_sha:             KERNEL_SHA,
        verified_at:            new Date().toISOString(),
        detail:                 'VaultChain™ transaction verified. This capsule SHA-512 is sealed on the sovereign Public Witness Ledger.',
      });
    }

    // ── 3. Check if it matches the Kernel SHA (Genesis Anchor) ──────────────
    if (KERNEL_SHA.startsWith(hash) || hash === KERNEL_SHA) {
      return Response.json({
        resonance:      'HIGH_FIDELITY_SUCCESS',
        hash_type:      'GENESIS_KERNEL_ANCHOR',
        sha512:         KERNEL_SHA,
        event_type:     'ROOT0_GENESIS',
        anchored_at:    '2026-02-22T00:00:00.000000000Z',
        kernel_version: KERNEL_VERSION,
        detail:         'cf83™ Kernel Root — Genesis Anchor. This is the primary sovereign truth anchor for all AveryOS™ capsules.',
        disclosure_url: `https://averyos.com/witness/disclosure/${KERNEL_SHA}`,
        verified_at:    new Date().toISOString(),
      });
    }

    // ── 4. Not found ─────────────────────────────────────────────────────────
    return Response.json(
      {
        resonance:    'DRIFT_ALERT',
        hash:         hash,
        detail:       'No sovereign alignment found for this hash. Certificate unknown or not yet anchored on VaultChain™.',
        vaultchain_url: 'https://averyos.com/vaultchain-explorer',
        kernel_sha:   KERNEL_SHA,
      },
      { status: 404 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
