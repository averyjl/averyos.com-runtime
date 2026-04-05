/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRetroactiveDebtSummary, type D1Database } from "../../../../lib/retroactiveLedger";
import { formatIso9 } from "../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";

interface CloudflareEnv {
  DB: D1Database;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const summary = await getRetroactiveDebtSummary(cfEnv.DB);
    const baseDebtUsd = summary.totalDebtUsd;
    const multiplierRate = 10;
    const revShareRate = 0.01;
    const multiplierDebtUsd = baseDebtUsd * multiplierRate;
    const revShareUsd = baseDebtUsd * revShareRate;
    const hardenedDebtUsd = multiplierDebtUsd + revShareUsd;

    return Response.json({
      total_debt_usd: hardenedDebtUsd,
      total_debt_precision_9: hardenedDebtUsd.toFixed(9),
      base_debt_usd: baseDebtUsd,
      genesis_multiplier_rate: multiplierRate,
      genesis_multiplier_debt_usd: multiplierDebtUsd,
      genesis_rev_share_rate: revShareRate,
      genesis_rev_share_usd: revShareUsd,
      row_count: summary.rowCount,
      schema: {
        exists: summary.schema.exists,
        columns: summary.schema.columns,
        entity_column: summary.schema.entityColumn,
        debt_column: summary.schema.debtColumn,
      },
      timestamp: formatIso9(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, `TOTAL_DEBT_ERROR: ${message}`);
  }
}
