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
    bind(...args: unknown[]): { run(): Promise<{ success: boolean }> };
    first(): Promise<unknown>;
  };
  exec(query: string): Promise<unknown>;
}

interface CloudflareEnv {
  DB: D1Database;
  GITHUB_PAT?: string;
  BLOCKCHAIN_API_KEY?: string;
}

const SHA512_REGEX = /^[a-fA-F0-9]{128}$/;
const NINE_DIGIT_REGEX = /^\d{9}$/;

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Authenticate: require Bearer <GITHUB_PAT>
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!cfEnv.GITHUB_PAT || !token || token !== cfEnv.GITHUB_PAT) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, 'Unauthorized');
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const build_version =
      typeof body.build_version === 'string' && body.build_version.trim()
        ? body.build_version.trim().slice(0, 64)
        : null;
    if (!build_version) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'build_version is required');
    }

    const kernel_resonance_hash =
      typeof body.kernel_resonance_hash === 'string' && body.kernel_resonance_hash.trim()
        ? body.kernel_resonance_hash.trim()
        : null;
    if (!kernel_resonance_hash) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'kernel_resonance_hash is required');
    }
    if (!SHA512_REGEX.test(kernel_resonance_hash)) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, 'kernel_resonance_hash must be a valid 128-character SHA-512 hex string');
    }

    const build_timestamp_ms =
      typeof body.build_timestamp_ms === 'string' && NINE_DIGIT_REGEX.test(body.build_timestamp_ms.trim())
        ? body.build_timestamp_ms.trim()
        : null;
    if (!build_timestamp_ms) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, 'build_timestamp_ms must be a 9-digit numeric string');
    }

    const updated_at = new Date().toISOString();

    // Apply Bitcoin block height as a salt to the build_timestamp_ms (9-digit entropy field)
    let salted_timestamp_ms = build_timestamp_ms;
    if (cfEnv.BLOCKCHAIN_API_KEY) {
      try {
        const btcRes = await fetch(
          "https://api.blockcypher.com/v1/btc/main",
          { headers: { Authorization: `Bearer ${cfEnv.BLOCKCHAIN_API_KEY}` } }
        );
        if (btcRes.ok) {
          const btcData = (await btcRes.json()) as { height?: number };
          const blockHeight = btcData.height ?? 0;
          // Use BigInt XOR to avoid 32-bit integer truncation, then keep 9 digits
          const salted =
            (BigInt(build_timestamp_ms) ^ BigInt(blockHeight)) %
            BigInt(1_000_000_000);
          salted_timestamp_ms = String(salted).padStart(9, "0");
        }
      } catch {
        // Salt is best-effort; proceed with original timestamp on failure
      }
    }

    // Ensure kernel_metadata table exists
    await cfEnv.DB.exec(`
      CREATE TABLE IF NOT EXISTS kernel_metadata (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        build_version         TEXT    NOT NULL,
        kernel_resonance_hash TEXT    NOT NULL,
        build_timestamp_ms    TEXT    NOT NULL,
        tari_pulse_peers      INTEGER NOT NULL DEFAULT 0,
        updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Check if a row already exists
    const existing = await cfEnv.DB.prepare(
      'SELECT id FROM kernel_metadata ORDER BY id ASC LIMIT 1'
    ).first() as { id: number } | null;

    if (existing) {
      await cfEnv.DB.prepare(
        'UPDATE kernel_metadata SET build_version = ?, kernel_resonance_hash = ?, build_timestamp_ms = ?, updated_at = ? WHERE id = ?'
      )
        .bind(build_version, kernel_resonance_hash, salted_timestamp_ms, updated_at, existing.id)
        .run();
    } else {
      await cfEnv.DB.prepare(
        'INSERT INTO kernel_metadata (build_version, kernel_resonance_hash, build_timestamp_ms, tari_pulse_peers, updated_at) VALUES (?, ?, ?, 0, ?)'
      )
        .bind(build_version, kernel_resonance_hash, salted_timestamp_ms, updated_at)
        .run();
    }

    return Response.json({
      success: true,
      message: 'Build provenance anchored',
      build_version,
      kernel_resonance_hash,
      build_timestamp_ms: salted_timestamp_ms,
      updated_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('⚠️  update-build error:', message);
    return aosErrorResponse(AOS_ERROR.DRIFT_DETECTED, `Handshake Drift: ${message}`);
  }
}
