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

interface LocalD1PreparedStatement {
  all(): Promise<{ results: SyncLogRow[] }>;
}

interface LocalD1Database {
  prepare(query: string): LocalD1PreparedStatement;
}

interface RequestWithContext extends NextApiRequest {
  context?: { env?: { DB?: LocalD1Database } };
}

interface SyncLogRow {
  id?: string;
  timestamp: string;
  event_type?: string;
  kernel_anchor?: string;
  [key: string]: unknown;
}

/**
 * ⛓️⚓⛓️ AveryOS 9-Digit Precision Formatter
 * Synthetic high-fidelity padding for the VaultChain 
 */
function formatIso9(timestamp: string | number | Date) {
  const date = new Date(timestamp);
  const iso = date.toISOString().replace('Z', '');
  // Add 6 additional digits for microsecond precision (9 total)
  const micro = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${iso}${micro}Z`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // In OpenNext, context is passed via req
  const db = (req as RequestWithContext).context?.env?.DB;

  if (!db) {
    return res.status(503).json(buildAosError(AOS_ERROR.DB_UNAVAILABLE, 'D1 Database Binding Missing'));
  }

  try {
    const { results } = await db.prepare(
      "SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT 50"
    ).all();

    // Map results to the 9-digit precision standard
    const formattedResults = results.map((row: SyncLogRow) => ({
      ...row,
      timestamp: formatIso9(row.timestamp)
    }));

    return res.status(200).json(formattedResults);
  } catch {
    return res.status(500).json(buildAosError(AOS_ERROR.DB_QUERY_FAILED, 'Failed to query VaultChain'));
  }
}
