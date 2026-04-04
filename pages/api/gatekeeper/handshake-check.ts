/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildAosError, AOS_ERROR } from '../../../lib/sovereignError';

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
    return res.status(503).json(buildAosError(AOS_ERROR.DB_UNAVAILABLE, 'D1 database binding is not available.'));
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
    return res.status(500).json(buildAosError(AOS_ERROR.DB_QUERY_FAILED, 'VaultChain query failed.'));
  }
}
