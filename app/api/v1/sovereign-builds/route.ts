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
    all(): Promise<{ results: unknown[] }>;
    first(): Promise<unknown>;
  };
}

interface CloudflareEnv {
  DB: D1Database;
}

interface SovereignBuildRow {
  id: number;
  repo_name: string;
  commit_sha: string;
  artifact_hash: string;
  provenance_data: string | null;
  hardware_signature: string | null;
  btc_anchor_height: number | null;
  registered_at: string;
  sealed_at: string | null;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const result = await cfEnv.DB.prepare(
      `SELECT id, repo_name, commit_sha, artifact_hash, provenance_data,
              hardware_signature, btc_anchor_height, registered_at, sealed_at
       FROM sovereign_builds
       ORDER BY id DESC
       LIMIT 20`
    ).all();

    const rows = (result.results ?? []) as SovereignBuildRow[];

    return Response.json({
      builds: rows.map((r) => ({
        id: r.id,
        repo_name: r.repo_name,
        commit_sha: r.commit_sha,
        artifact_hash: r.artifact_hash,
        sealed: r.hardware_signature !== null,
        btc_anchor_height: r.btc_anchor_height,
        registered_at: r.registered_at,
        sealed_at: r.sealed_at,
      })),
      queried_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
