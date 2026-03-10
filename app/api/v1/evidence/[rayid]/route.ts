import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA, KERNEL_VERSION } from '../../../../../lib/sovereignConstants';
import { aosErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';

/**
 * GET /api/v1/evidence/[rayid]
 *
 * Fetches the raw Cloudflare telemetry JSON evidence bundle for a given
 * Cloudflare RayID from VAULT_R2 (stored at evidence/${rayid}.json).
 *
 * Auth: Bearer token matching VAULT_PASSPHRASE
 *       (same gate as /api/v1/audit-stream).
 *
 * Returns the full JSON metadata object captured by logSovereignAudit()
 * in middleware.ts, including WAF scores, edge timestamps, geolocation,
 * INGESTION_INTENT classification, and kernel_sha anchor.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface R2Object {
  text(): Promise<string>;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

interface CloudflareEnv {
  VAULT_R2?: R2Bucket;
  VAULT_PASSPHRASE?: string;
}

interface RouteParams {
  params: Promise<{ rayid: string }>;
}

const RAY_ID_RE = /^[a-zA-Z0-9]{16,32}$/;

export async function GET(request: Request, { params }: RouteParams) {
  const { rayid } = await params;

  if (!rayid || !RAY_ID_RE.test(rayid)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD,
      'rayid must be a 16–32 character alphanumeric Cloudflare RayID');
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  const vaultPassphrase = cfEnv.VAULT_PASSPHRASE;
  if (vaultPassphrase) {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token !== vaultPassphrase) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH,
        'Valid Bearer token required to access forensic evidence');
    }
  }

  // ── R2 Fetch ──────────────────────────────────────────────────────────────
  if (!cfEnv.VAULT_R2) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING,
      'VAULT_R2 binding is not configured');
  }

  const key = `evidence/${rayid}.json`;
  const obj = await cfEnv.VAULT_R2.get(key).catch(() => null);

  if (!obj) {
    return aosErrorResponse(AOS_ERROR.NOT_FOUND,
      `No evidence bundle found for RayID: ${rayid}. Evidence is only stored for requests that triggered logSovereignAudit().`);
  }

  const raw = await obj.text();

  return Response.json({
    resonance:    'HIGH_FIDELITY_SUCCESS',
    kernel_sha:   KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    ray_id:       rayid,
    r2_key:       key,
    evidence:     JSON.parse(raw) as Record<string, unknown>,
    retrieved_at: new Date().toISOString(),
  });
}
