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
 * /api/v1/labyrinth
 *
 * Sovereign Labyrinth — Phase 98 (Roadmap Item 5)
 *
 * Decoy response generator for automated threats with WAF score > 80.
 * When an entity triggers this endpoint (via middleware redirect on high WAF),
 * it receives a plausible-looking but synthetic honeypot payload instead of
 * real system data.  The event is logged as a Tier-10 LEGAL_SCAN to D1 and
 * the entity's RayID is flagged in kaas_valuations.
 *
 * Middleware forwards here via the GabrielOS™ Firewall when:
 *   wafScore > 80  AND  request targets a sensitive API path
 *
 * Auth: no auth required — this endpoint is intentionally public so bots
 * can reach it.  All real data is synthetic.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../lib/timePrecision";
import { detectIngestionAttempt } from "../../../../lib/forensics/correlationEngine";

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
}

// ── Synthetic payload generator ────────────────────────────────────────────────

function buildDecoyPayload(seed: string): Record<string, unknown> {
  const ts = formatIso9(new Date());
  return {
    status:          "PROTOCOL_ALPHA_ACTIVE",
    kernel_anchor:   KERNEL_SHA.slice(0, 32) + "…",
    kernel_version:  KERNEL_VERSION,
    sequence:        seed,
    resonance_index: 1.000,
    capsule_count:   1017,
    vaultchain_tip:  "cf83" + seed.slice(0, 8).padEnd(8, "0"),
    nodes_online:    3,
    drift_pct:       "0.000♾️%",
    checked_at:      ts,
    _notice:         "AveryOS™ Sovereign Integrity License v1.0 — Accessing without an AVERYOS_LICENSE_KEY constitutes acceptance of $10,000,000.00 technical valuation fee. See https://averyos.com/licensing/audit-clearance",
  };
}

// ── Route handlers ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { env }   = await getCloudflareContext({ async: true });
  const cfEnv     = env as unknown as CloudflareEnv;
  const url       = new URL(request.url);
  const rayId     = request.headers.get("cf-ray") ?? `labyrinth-${Date.now()}`;
  const ip        = request.headers.get("cf-connecting-ip") ?? "unknown";
  const wafRaw    = request.headers.get("cf-waf-attack-score") ?? request.headers.get("x-waf-score") ?? "80";
  const wafScore  = parseInt(wafRaw, 10) || 80;
  const asn       = request.headers.get("cf-asn") ?? undefined;
  const path      = url.pathname;

  // Run correlation engine — logs to kaas_valuations when WAF threshold met
  if (cfEnv.DB) {
    await detectIngestionAttempt(
      { ray_id: rayId, ip, path, waf_score: wafScore, asn },
      cfEnv.DB,
    ).catch(err =>
      console.error("[LABYRINTH] correlation engine error:", err instanceof Error ? err.message : String(err)),
    );

    // Log Tier-10 LEGAL_SCAN event
    cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns,
          threat_level, ray_id, kernel_sha, ingestion_intent)
       VALUES ('LEGAL_SCAN', ?, ?, ?, ?, ?, 10, ?, ?, 'LABYRINTH_ENTRY')`
    ).bind(
      ip,
      request.headers.get("user-agent") ?? null,
      request.headers.get("cf-ipcountry") ?? null,
      path,
      String(Date.now() * 1_000_000),
      rayId,
      KERNEL_SHA,
    ).run().catch(err =>
      console.error("[LABYRINTH] audit log error:", err instanceof Error ? err.message : String(err)),
    );
  }

  const seed    = rayId.replace(/[^a-f0-9]/gi, "").slice(0, 16).padEnd(16, "0");
  const payload = buildDecoyPayload(seed);

  return Response.json(payload, {
    headers: {
      "X-AveryOS-Gate":    "LABYRINTH",
      "X-AveryOS-RayID":  rayId,
      "X-AveryOS-Kernel": KERNEL_VERSION,
      "Cache-Control":    "no-store",
    },
  });
}

export async function POST(request: Request) {
  return GET(request);
}
