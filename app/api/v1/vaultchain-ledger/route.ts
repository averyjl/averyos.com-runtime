/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * app/api/v1/vaultchain-ledger/route.ts
 *
 * GET  /api/v1/vaultchain-ledger          — read recent VaultChain™ blocks
 * POST /api/v1/vaultchain-ledger          — append a new block
 *
 * Query params (GET):
 *   limit  — number of blocks to return (default 20, max 100)
 *
 * GATE 119.9.4 — VaultChain™ Explorer Ledger API
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { d1ErrorResponse, aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import {
  readRecentBlocks,
  countBlocks,
  writeBlock,
  type VaultChainDB,
  type WriteBlockInput,
} from "../../../../lib/forensics/vaultChain";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../lib/timePrecision";

interface CloudflareEnv {
  DB: VaultChainDB;
}

// ── GET — read recent blocks ───────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    const url     = new URL(request.url);
    const limit   = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);

    const [blocks, total] = await Promise.all([
      readRecentBlocks(cfEnv.DB, limit),
      countBlocks(cfEnv.DB),
    ]);

    return Response.json({
      blocks,
      total,
      limit,
      kernel_version:    KERNEL_VERSION,
      kernel_sha_prefix: KERNEL_SHA.slice(0, 16),
      timestamp:         formatIso9(new Date()),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "vaultchain_ledger");
  }
}

// ── POST — append a block ──────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Content-Type must be application/json", 400);
    }

    const body = await request.json() as Partial<WriteBlockInput>;

    if (!body.payload || typeof body.payload !== "string" || body.payload.trim() === "") {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "payload is required and must be a non-empty string", 400);
    }

    const validTypes = new Set(["GENESIS", "RECORD", "CORRECTION", "ANCHOR"]);
    if (body.block_type && !validTypes.has(body.block_type)) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, `block_type must be one of: ${[...validTypes].join(", ")}`, 400);
    }

    const newId = await writeBlock(cfEnv.DB, {
      block_type:   body.block_type ?? "RECORD",
      payload:      body.payload.trim(),
      ref_block_id: typeof body.ref_block_id === "number" ? body.ref_block_id : null,
      author:       body.author ?? "ROOT0",
    });

    if (newId === null) {
      return d1ErrorResponse("Failed to insert block", "vaultchain_ledger");
    }

    return Response.json({
      success:   true,
      block_id:  newId,
      timestamp: formatIso9(new Date()),
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "vaultchain_ledger");
  }
}
