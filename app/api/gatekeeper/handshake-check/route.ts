import { getCloudflareContext } from "@opennextjs/cloudflare";

interface D1Database {
  prepare(query: string): { first: () => Promise<{ timestamp: string } | null> };
}

interface CloudflareEnv {
  DB?: D1Database;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as unknown as CloudflareEnv).DB;

    if (!db) {
      return Response.json({ status: "DRIFT_DETECTED", reason: "DB_MISSING" });
    }

    const lastSync = await db
      .prepare(
        "SELECT timestamp FROM sync_logs WHERE event_type = 'HARDWARE_PERSISTENCE_SYNC' ORDER BY timestamp DESC LIMIT 1"
      )
      .first();

    if (lastSync) {
      const syncTime = new Date(lastSync.timestamp).getTime();
      const isRecent = Date.now() - syncTime < 24 * 60 * 60 * 1000;
      if (isRecent) {
        return Response.json({
          status: "LOCKED",
          glyph: "⛓️⚓⛓️",
          precision_ts: lastSync.timestamp,
        });
      }
    }

    return Response.json({ status: "DRIFT_DETECTED" });
  } catch {
    return Response.json({ status: "DRIFT_DETECTED", reason: "VAULTCHAIN_OFFLINE" });
  }
}
