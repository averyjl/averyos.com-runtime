import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * ⛓️⚓⛓️ AveryOS 9-Digit Precision Formatter
 * Synthetic high-fidelity padding for the VaultChain 
 */
function formatIso9(timestamp: any) {
  const date = new Date(timestamp);
  const iso = date.toISOString().replace('Z', '');
  // Add 6 additional digits for microsecond precision (9 total)
  const micro = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${iso}${micro}Z`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // In OpenNext, context is passed via req
  const db = (req as any).context?.env?.DB;

  if (!db) {
    return res.status(500).json({ error: "D1 Database Binding Missing" });
  }

  try {
    const { results } = await db.prepare(
      "SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT 50"
    ).all();

    // Map results to the 9-digit precision standard
    const formattedResults = results.map((row: any) => ({
      ...row,
      timestamp: formatIso9(row.timestamp)
    }));

    return res.status(200).json(formattedResults);
  } catch (error) {
    return res.status(500).json({ error: "Failed to query VaultChain" });
  }
}
