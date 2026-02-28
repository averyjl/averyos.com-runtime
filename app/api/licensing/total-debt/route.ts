import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRetroactiveDebtSummary, type D1Database } from "../../../../lib/retroactiveLedger";
import { formatIso9 } from "../../../../lib/timePrecision";

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
    return Response.json({ error: "TOTAL_DEBT_ERROR", detail: message }, { status: 500 });
  }
}
