import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getForensicHashesFromLedger, type D1Database } from "../../../../lib/retroactiveLedger";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";

interface CloudflareEnv {
  DB: D1Database;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const { entries } = await getForensicHashesFromLedger(cfEnv.DB, 100);

    const rows = entries.map((entry) => ({
      entity_id: (entry.entity_name ?? "").toUpperCase().replace(/[^A-Z0-9_]/g, ""),
      entity_name: entry.entity_name,
      status: entry.status ?? "Pending",
    }));

    return Response.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
