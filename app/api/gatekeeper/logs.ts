import type { NextApiRequest, NextApiResponse } from 'next';

interface RequestWithContext extends NextApiRequest {
  context?: { env?: { DB?: D1Database } };
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
    return res.status(500).json({ error: "D1 Database Binding Missing" });
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
    return res.status(500).json({ error: "Failed to query VaultChain" });
  }
}
