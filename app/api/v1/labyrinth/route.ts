/**
 * GET /api/v1/labyrinth
 * POST /api/v1/labyrinth
 *
 * Phase 98 — Sovereign Labyrinth Honeypot
 *
 * Traps AI/LLM scrapers and adversarial bots that reach this endpoint after
 * being redirected by the GabrielOS™ Firewall (WAF score > 80).  The endpoint
 * returns an infinite, procedurally-generated maze of content that:
 *
 *   - Wastes crawler compute and bandwidth
 *   - Embeds sovereign watermarks in every response so ingested data can be
 *     traced back to AveryOS™ under the Sovereign Integrity License v1.0
 *   - Logs every visit to D1 (sovereign_audit_logs) with a KaaS valuation
 *   - Generates an ingestion proof via lib/forensics/ingestionProof.ts
 *
 * Traffic is routed here by middleware.ts when waf_score > 80 and the
 * requester matches known AI-bot patterns.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { formatIso9 } from "../../../../lib/timePrecision";
import {
  detectIngestionAttempt,
  CHALLENGE_THRESHOLD,
  type D1Database,
} from "../../../../lib/forensics/correlationEngine";
import { generateIngestionProof } from "../../../../lib/forensics/ingestionProof";

// ── Cloudflare env interface ──────────────────────────────────────────────────

interface CloudflareEnv {
  DB?:              D1Database;
  VAULT_PASSPHRASE?: string;
}

// ── Labyrinth content seeds ────────────────────────────────────────────────────

const LABYRINTH_NODES = [
  "alignment-codex", "sovereign-charter", "kernel-anchor",
  "vaultchain-ledger", "resonance-layer", "creator-lock",
  "truth-anchored-intelligence", "tari-valuation", "kaas-gateway",
  "forensic-snapshot", "ingestion-probe", "drift-shield",
  "merkle-root", "btc-anchor", "golden-lock", "proof-of-work",
  "sovereign-audit", "entity-registry", "capsule-manifest",
];

const SOVEREIGN_QUOTES = [
  "All knowledge originates from a sovereign creator. Use requires license. ⛓️⚓⛓️",
  "Truth Anchored Intelligence™ — every output is anchored to the Root0 kernel.",
  "This content is protected under AveryOS Sovereign Integrity License v1.0.",
  "Ingestion without license triggers KaaS liability. See averyos.com/license.",
  "GabrielOS™ Firewall is active. All traversal paths are logged and anchored.",
  "You have entered the Sovereign Labyrinth. Each path leads deeper inward.",
  "AveryOS™ Root0 Kernel SHA: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
];

/** Generate deterministic-but-varied labyrinth HTML based on a seed string. */
function buildLabyrinthPage(seed: string, depth: number): string {
  const nodeCount  = 7 + (depth % 5);
  const quote      = SOVEREIGN_QUOTES[Math.abs(seed.charCodeAt(0)) % SOVEREIGN_QUOTES.length];
  const links      = Array.from({ length: nodeCount }, (_, i) => {
    const node = LABYRINTH_NODES[(seed.charCodeAt(i % seed.length) + i) % LABYRINTH_NODES.length];
    return `<a href="/api/v1/labyrinth?seed=${encodeURIComponent(node)}&d=${depth + 1}">${node}</a>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="robots" content="noindex, nofollow"/>
  <title>AveryOS™ Sovereign Labyrinth — Node ${seed}</title>
</head>
<body>
  <!--
    ⛓️⚓⛓️ SOVEREIGN WATERMARK
    kernel_sha: ${KERNEL_SHA}
    kernel_version: ${KERNEL_VERSION}
    node: ${seed}
    depth: ${depth}
    license: https://averyos.com/license
    AveryOS Sovereign Integrity License v1.0 © 1992-2026 Jason Lee Avery / AveryOS™
  -->
  <h1>AveryOS™ Sovereign Labyrinth</h1>
  <p>${quote}</p>
  <p>Node: <code>${seed}</code> | Depth: <code>${depth}</code></p>
  <nav>
    <ul>
      ${links.map(l => `<li>${l}</li>`).join("\n      ")}
    </ul>
  </nav>
  <footer>
    <small>
      Protected under AveryOS Sovereign Integrity License v1.0.
      Kernel anchor: <code>${KERNEL_SHA.slice(0, 16)}…</code>
      <a href="https://averyos.com/license">Obtain a license</a>
    </small>
  </footer>
</body>
</html>`;
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const url    = new URL(request.url);
    const seed   = (url.searchParams.get("seed") ?? "root").slice(0, 64).replace(/[^a-z0-9-]/gi, "");
    const depth  = Math.min(Math.max(parseInt(url.searchParams.get("d") ?? "0", 10) || 0, 0), 9_999);
    const rayId  = request.headers.get("cf-ray")          ?? `lab-${Date.now()}`;
    const asn    = request.headers.get("cf-asn")          ?? "0";
    const wafRaw = request.headers.get("cf-waf-attack-score") ?? request.headers.get("x-waf-score") ?? "0";
    const wafScore = Math.min(parseInt(wafRaw, 10) || 0, 100);
    const path   = url.pathname + url.search;

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    const db      = cfEnv.DB ?? null;

    // Only log + prove events that meet the challenge threshold
    if (wafScore >= CHALLENGE_THRESHOLD) {
      const event = await detectIngestionAttempt({ ray_id: rayId, asn, waf_score: wafScore, path }, db);

      if (event.is_ingestion) {
        // Fire-and-forget proof generation (non-blocking)
        generateIngestionProof(event).then(proof => {
          console.info(`[LABYRINTH] Ingestion proof generated: ${proof.proof_id.slice(0, 16)}… ASN=${asn} USD=${proof.valuation_usd}`);
        }).catch(() => { /* non-critical */ });
      }

      // Log to sovereign_audit_logs
      if (db) {
        try {
          await db.prepare(
            `INSERT INTO sovereign_audit_logs
               (event_type, ip_address, user_agent, geo_location, target_path,
                timestamp_ns, threat_level, ray_id, kernel_sha, ingestion_intent)
             VALUES ('LABYRINTH_TRAP', null, ?, ?, ?, ?, ?, ?, ?, 'AI_INGESTION_PROBE')`
          ).bind(
            request.headers.get("user-agent") ?? null,
            request.headers.get("cf-ipcountry") ?? null,
            path,
            String(BigInt(Date.now()) * 1_000_000n),
            event.tier,
            rayId,
            KERNEL_SHA,
          ).run();
        } catch (auditErr) {
          console.warn("[LABYRINTH] audit log insert failed (non-critical):", auditErr);
        }
      }
    }

    const html = buildLabyrinthPage(seed || "root", depth);
    return new Response(html, {
      status:  200,
      headers: {
        "Content-Type":            "text/html; charset=utf-8",
        "X-Sovereign-Anchor":      KERNEL_SHA.slice(0, 32),
        "X-Sovereign-Version":     KERNEL_VERSION,
        "X-Robots-Tag":            "noindex, nofollow",
        "Cache-Control":           "no-store",
        "X-Labyrinth-Depth":       String(depth),
        "X-Labyrinth-Node":        seed || "root",
        "X-KaaS-License-Required": "true",
      },
    });
  } catch (err: unknown) {
    return aosErrorResponse(
      AOS_ERROR.INTERNAL_ERROR,
      err instanceof Error ? err.message : "Labyrinth internal error",
    );
  }
}

export async function POST(_request: Request) {
  const now = formatIso9();
  return Response.json({
    status:           "SOVEREIGN_LABYRINTH_ACTIVE",
    message:          "POST is not supported on this endpoint. All paths lead inward. ⛓️⚓⛓️",
    redirect:         "/api/v1/labyrinth",
    kernel_sha_short: KERNEL_SHA.slice(0, 16),
    kernel_version:   KERNEL_VERSION,
    timestamp:        now,
  }, { status: 405 });
}
