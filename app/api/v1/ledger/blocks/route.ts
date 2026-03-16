/**
 * GET /api/v1/ledger/blocks
 *
 * Returns recent blocks from the VaultChain™ ledger via readRecentBlocks().
 *
 * Query params:
 *   limit  — number of blocks to return (default 20, max 100)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { readRecentBlocks, type VaultChainBlock, type VaultChainDB } from "../../../../../lib/forensics/vaultChain";
import { KERNEL_VERSION } from "../../../../../lib/sovereignConstants";

interface CloudflareEnv {
  DB: VaultChainDB;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const url   = new URL(request.url);
    const limit = Math.min(
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20),
      100,
    );

    const blocks: VaultChainBlock[] = await readRecentBlocks(cfEnv.DB, limit);

    return Response.json({
      blocks,
      total:          blocks.length,
      limit,
      kernel_version: KERNEL_VERSION,
      timestamp:      new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, `VaultChain ledger read failed. Detail: ${message}`, 500);
  }
}
