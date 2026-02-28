import { getCloudflareContext } from "@opennextjs/cloudflare";
import { formatIso9 } from "../../../../lib/timePrecision";

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

type TelemetryRequest = {
  entity_id?: string;
  action?: string;
  forensic_hash?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as TelemetryRequest;
    const entityId = typeof body.entity_id === "string" ? body.entity_id.trim() : "UNKNOWN";
    const action = typeof body.action === "string" ? body.action.trim() : "UNKNOWN_ACTION";

    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const ts = formatIso9();

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS audit_logs (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         entity TEXT NOT NULL,
         ip TEXT NOT NULL,
         status TEXT NOT NULL,
         timestamp TEXT DEFAULT (datetime('now', 'localtime'))
       )`
    ).run();

    await cfEnv.DB.prepare(
      "INSERT INTO audit_logs (entity, ip, status, timestamp) VALUES (?, ?, ?, ?)"
    )
      .bind(entityId, ip, action, ts)
      .run();

    return Response.json({ logged: true, entity: entityId, action, timestamp: ts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "TELEMETRY_ERROR", detail: message }, { status: 500 });
  }
}
