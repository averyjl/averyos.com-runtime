import { getCloudflareContext } from '@opennextjs/cloudflare';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

interface AlignmentRecord {
  partner_id: string;
  origin_domain: string;
  badge_hash: string;
}

interface RouteParams {
  params: Promise<{ hash: string }>;
}

/** CORS headers — badge verification is open-public so any partner site can call it. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Strip leading protocol and normalise www. prefix for domain comparison. */
function normalizeDomain(raw: string): string {
  return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request, { params }: RouteParams) {
  const { hash } = await params;

  if (!hash || !/^[a-fA-F0-9]{128}$/.test(hash)) {
    return Response.json(
      { error: 'INVALID_HASH', detail: 'Hash must be a 128-character SHA-512 hex string' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Extract the presenting domain from the Referer header for domain-lock check
  const refererHeader = request.headers.get('Referer') ?? '';
  let refererDomain = '';
  try {
    if (refererHeader) {
      refererDomain = normalizeDomain(new URL(refererHeader).hostname);
    }
  } catch {
    // malformed Referer — leave refererDomain empty; verification will fail
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Ensure table exists (idempotent bootstrap)
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sovereign_alignments (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        partner_id   TEXT NOT NULL,
        origin_domain TEXT NOT NULL,
        badge_hash   TEXT NOT NULL UNIQUE,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ).run();

    const record = await cfEnv.DB.prepare(
      'SELECT partner_id, origin_domain, badge_hash FROM sovereign_alignments WHERE badge_hash = ?',
    )
      .bind(hash)
      .first<AlignmentRecord>();

    if (!record) {
      return Response.json(
        { error: 'BADGE_NOT_FOUND', detail: 'No alignment record found for this badge hash' },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    const storedDomain = normalizeDomain(record.origin_domain);
    const domainMatch = storedDomain === refererDomain;

    return Response.json(
      {
        status: domainMatch ? 'BADGE_VERIFIED' : 'DOMAIN_MISMATCH',
        partner_id: record.partner_id,
        origin_domain: record.origin_domain,
        referer_domain: refererDomain || null,
        domain_locked: domainMatch,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: 'BADGE_VERIFY_ERROR', detail: message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
