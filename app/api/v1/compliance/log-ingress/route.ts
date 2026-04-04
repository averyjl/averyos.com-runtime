/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * POST /api/v1/compliance/log-ingress
 *
 * Sovereign Forensic Billing Hook — logs every bot/AI ingress event to the
 * D1 anchor_audit_logs table.  Called by the SettlementBanner client component
 * whenever it renders for a detected bot or a ?compliance=true visitor.
 *
 * Payload (JSON body):
 *   user_agent  string   — UA string of the ingestor
 *   path        string   — page path that triggered the banner
 *   event_type  string?  — defaults to "COMPLIANCE_INGRESS"
 *
 * D1 columns used:
 *   anchored_at     — ISO-9 timestamp
 *   sha512          — KERNEL_SHA (sovereign anchor)
 *   event_type      — COMPLIANCE_INGRESS | BOT_INGRESS | COMPLIANCE_REVIEW
 *   kernel_sha      — KERNEL_SHA (duplicate for indexed queries)
 *   path            — page path from body
 *   ip_address      — cf-connecting-ip from edge headers (real ingestor IP)
 *   thought_summary — User-Agent string of the ingestor (forensic record)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";

interface D1Database {
  prepare(sql: string): {
    bind(...args: unknown[]): { run(): Promise<{ success: boolean }> };
  };
}

interface CloudflareEnv {
  DB?: D1Database;
}

interface IngressBody {
  user_agent?: string;
  path?: string;
  event_type?: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: IngressBody = {};
  try {
    body = (await request.json()) as IngressBody;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.", 400);
  }

  const user_agent  = (body.user_agent ?? "unknown").slice(0, 512);
  const path        = (body.path       ?? "/").slice(0, 512);
  const event_type  = (body.event_type ?? "COMPLIANCE_INGRESS").slice(0, 64);
  const anchored_at = formatIso9();
  // Real connecting IP from Cloudflare edge headers (forensic record)
  const ip_address  = (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")  ??
    "unknown"
  ).slice(0, 64);

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;
    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 binding unavailable.", 503);
    }

    await cfEnv.DB.prepare(
      `INSERT INTO anchor_audit_logs
         (anchored_at, sha512, event_type, kernel_sha, path, ip_address, thought_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        anchored_at,
        KERNEL_SHA,
        event_type,
        KERNEL_SHA,
        path,
        ip_address,
        user_agent,
      )
      .run();

    return Response.json({
      ok: true,
      anchored_at,
      event_type,
      kernel_version: KERNEL_VERSION,
    });
  } catch (err) {
    return aosErrorResponse(
      AOS_ERROR.DB_QUERY_FAILED,
      `Ingress log failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}
