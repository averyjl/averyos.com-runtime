/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
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
