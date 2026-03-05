import type { NextApiRequest, NextApiResponse } from 'next';

interface SyncLogRow {
  timestamp: string;
  [key: string]: unknown;
}

interface LocalD1PreparedStatement {
  first(): Promise<SyncLogRow | null>;
}

interface LocalD1Database {
  prepare(query: string): LocalD1PreparedStatement;
}

interface RequestWithContext extends NextApiRequest {
  context?: { env?: { DB?: LocalD1Database } };
}

/**
 * ⛓️⚓⛓️ AveryOS Physical Handshake Verification
 * Queries D1 sync_logs for recent Hardware Signature events.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = (req as RequestWithContext).context?.env?.DB;

  if (!db) {
    return res.status(500).json({ status: "UNANCHORED", reason: "DB_MISSING" });
  }

  try {
    const lastSync = await db.prepare(
      "SELECT timestamp FROM sync_logs WHERE event_type = 'HARDWARE_PERSISTENCE_SYNC' ORDER BY timestamp DESC LIMIT 1"
    ).first();

    if (lastSync) {
      // AveryOS Standard: 24-hour verification window
      const syncTime = new Date(lastSync.timestamp).getTime();
      const now = Date.now();
      const isRecent = (now - syncTime) < (24 * 60 * 60 * 1000);

      if (isRecent) {
        return res.status(200).json({ 
          status: "LOCKED", 
          glyph: "⛓️⚓⛓️", 
          label: "PHYSICAL ANCHOR: ACTIVE",
          ts_precision: lastSync.timestamp 
        });
      }
    }

    return res.status(200).json({ status: "DRIFT_DETECTED", label: "PLATFORM_ONLY" });
  } catch {
    return res.status(500).json({ status: "ERROR", message: "VAULTCHAIN_OFFLINE" });
  }
}
