import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = (req as any).context?.env?.DB;
  if (!db) return res.status(500).json({ status: "UNANCHORED", reason: "DB_MISSING" });

  try {
    // Check for a recent YubiKey/Hardware sync event
    const lastSync = await db.prepare(
      "SELECT timestamp FROM sync_logs WHERE event_type = 'HARDWARE_PERSISTENCE_SYNC' ORDER BY timestamp DESC LIMIT 1"
    ).first();

    if (lastSync) {
      const syncTime = new Date(lastSync.timestamp).getTime();
      const now = Date.now();
      const isRecent = (now - syncTime) < (24 * 60 * 60 * 1000); // 24-hour validity

      if (isRecent) {
        return res.status(200).json({ 
          status: "LOCKED", 
          glyph: "⛓️⚓⛓️", 
          label: "PHYSICAL ANCHOR: ACTIVE",
          precision_ts: lastSync.timestamp 
        });
      }
    }

    return res.status(200).json({ status: "DRIFT_DETECTED", label: "PLATFORM_ONLY_MODE" });
  } catch (error) {
    return res.status(500).json({ status: "ERROR", message: "VAULTCHAIN_OFFLINE" });
  }
}
