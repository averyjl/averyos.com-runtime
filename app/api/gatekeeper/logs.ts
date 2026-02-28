import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Accessing the Cloudflare D1 Binding
  // In OpenNext/Cloudflare, bindings are attached to the request context
  const db = (req as any).context?.env?.DB;

  if (!db) {
    return res.status(500).json({ error: "D1 Database Binding Missing" });
  }

  try {
    // Fetch the last 50 logs from the VaultChain
    const { results } = await db.prepare(
      "SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT 50"
    ).all();

    return res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({ error: "Failed to query VaultChain" });
  }
}
