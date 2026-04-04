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
 * /api/v1/forensics/dns-probes
 *
 * DNS Probe Forensics Endpoint — Phase 98.2.3
 *
 * Tracks and surfaces DNS probe events on monitored subdomains:
 *   _amazonses.averyos.com    — potential SES spam exploit
 *   enterpriseregistration.averyos.com — Microsoft Azure/O365 device enrollment
 *
 * POST: Ingest a DNS probe event (called from Cloudflare Workers DNS hooks
 *       or external monitoring scripts).
 * GET:  List recent DNS probe events (requires VAULT_PASSPHRASE Bearer).
 *
 * Body (POST):
 *   { subdomain: string, source_ip?: string, asn?: string, timestamp?: string }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
}

// ── Known probe subdomains and their intent classification ─────────────────────

const PROBE_INTENT: Record<string, string> = {
  "_amazonses":             "SES_REPUTATION_PROBE",
  "enterpriseregistration": "ENTERPRISE_ENROLLMENT_SIGNAL",
  "autodiscover":           "O365_AUTODISCOVER",
  "lyncdiscover":           "SKYPE_FOR_BUSINESS_PROBE",
};

function classifySubdomain(subdomain: string): string {
  for (const [key, intent] of Object.entries(PROBE_INTENT)) {
    if (subdomain.toLowerCase().startsWith(key)) return intent;
  }
  return "UNKNOWN_DNS_PROBE";
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  let body: { subdomain?: unknown; source_ip?: unknown; asn?: unknown; timestamp?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const subdomain = typeof body.subdomain === "string" ? body.subdomain.trim().slice(0, 128) : null;
  if (!subdomain) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "subdomain is required.");
  }

  const sourceIp  = typeof body.source_ip === "string" ? body.source_ip.trim() : (request.headers.get("cf-connecting-ip") ?? "unknown");
  const asn       = typeof body.asn       === "string" ? body.asn.trim()       : (request.headers.get("cf-asn") ?? null);
  const timestamp = typeof body.timestamp === "string" ? body.timestamp        : formatIso9(new Date());
  const intent    = classifySubdomain(subdomain);
  const rayId     = request.headers.get("cf-ray") ?? null;

  if (cfEnv.DB) {
    try {
      await cfEnv.DB.prepare(
        `INSERT INTO sovereign_audit_logs
           (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns,
            threat_level, ray_id, kernel_sha, ingestion_intent)
         VALUES (?, ?, ?, ?, ?, ?, 5, ?, ?, ?)`
      ).bind(
        intent,
        sourceIp,
        request.headers.get("user-agent") ?? `DNS_PROBE/${subdomain}`,
        asn ?? null,
        `/dns-probe/${subdomain}`,
        String(Date.now() * 1_000_000),
        rayId,
        KERNEL_SHA,
        intent,
      ).run();
    } catch (err) {
      console.error("[DNS_PROBES] audit log insert failed:", err instanceof Error ? err.message : String(err));
    }
  }

  return Response.json({
    status:          "DNS_PROBE_LOGGED",
    subdomain,
    intent,
    source_ip:       sourceIp,
    asn,
    timestamp,
    kernel_version:  KERNEL_VERSION,
    logged_at:       formatIso9(new Date()),
  }, { status: 201 });
}

// ── GET handler ────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  const auth        = request.headers.get("authorization") ?? "";
  const isWorker    = request.headers.get("cf-worker") === "true";
  const passphrase  = (env as Record<string, string | undefined>).VAULT_PASSPHRASE ?? "";
  const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!isWorker && (!passphrase || bearerToken !== passphrase)) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Unauthorized.");
  }

  const url   = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  interface DnsProbeRow { event_type: string; ip_address: string | null; geo_location: string | null; target_path: string | null; timestamp_ns: string; ray_id: string | null; ingestion_intent: string | null; }
  let probes: DnsProbeRow[] = [];

  if (cfEnv.DB) {
    try {
      const result = await cfEnv.DB.prepare(
        `SELECT event_type, ip_address, geo_location, target_path, timestamp_ns, ray_id, ingestion_intent
           FROM sovereign_audit_logs
          WHERE ingestion_intent IN ('SES_REPUTATION_PROBE','ENTERPRISE_ENROLLMENT_SIGNAL','O365_AUTODISCOVER','SKYPE_FOR_BUSINESS_PROBE','UNKNOWN_DNS_PROBE')
          ORDER BY timestamp_ns DESC
          LIMIT ?`
      ).bind(limit).all<DnsProbeRow>();
      probes = result.results;
    } catch (err) {
      console.error("[DNS_PROBES] query failed:", err instanceof Error ? err.message : String(err));
    }
  }

  return Response.json({
    status:           "DNS_PROBES_ACTIVE",
    count:            probes.length,
    probes,
    kernel_version:   KERNEL_VERSION,
    checked_at:       formatIso9(new Date()),
  });
}
