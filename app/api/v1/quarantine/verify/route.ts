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
import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";

/**
 * GET /api/v1/quarantine/verify
 *
 * Phase 102.1.3 — Sandboxed Verification Endpoint
 *
 * This endpoint is the production-side entry point of the Sovereign
 * Verification Layer. Entities that request kernel verification are
 * presented with a non-functional placeholder payload ("sandboxed logic")
 * while their access is logged for forensic audit purposes.
 *
 * The actual out-of-repo Sovereign Labyrinth (audit.averyos.com) is a
 * separate Cloudflare Pages project. This endpoint records the access
 * attempt and issues a structured challenge response.
 *
 * No real kernel IP is exposed — the response contains only public
 * sovereign constants already disclosed at DISCLOSURE_MIRROR_PATH.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_R2?: R2Bucket;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface R2Bucket {
  put(key: string, value: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

// ── Sandboxed Logic Payload ───────────────────────────────────────────────────
// This is a non-functional placeholder that mimics a kernel response.
// It contains only publicly disclosed constants — no real IP.
function buildSandboxedPayload(rayId: string, nowIso: string): unknown {
  return {
    kernel_version:     KERNEL_VERSION,
    kernel_sha:         KERNEL_SHA,
    status:             "SANDBOXED_VERIFICATION",
    resonance_seal:     "PROOF_OF_WORK_REQUIRED",
    challenge_token:    `VERIFY-${rayId}-${Date.now()}`,
    attestation_gate:   "/api/v1/licensing/handshake",
    disclosure:         DISCLOSURE_MIRROR_PATH,
    notice:
      "This is a sandboxed verification environment. " +
      "To complete kernel synchronisation, submit a Usage Affidavit at " +
      "/api/v1/licensing/handshake with your first_ingestion_ts and model_id.",
    recorded_at:        nowIso,
  };
}

export async function GET(request: Request): Promise<Response> {
  const now       = new Date();
  const nowIso    = formatIso9(now);
  const url       = new URL(request.url);
  const rayId     = request.headers.get("cf-ray") ?? `verify-${Date.now()}`;
  const ip        = request.headers.get("cf-connecting-ip") ?? "UNKNOWN";
  const asn       = request.headers.get("cf-asn") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";

  // Log the access attempt
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    if (cfEnv.DB) {
      await cfEnv.DB.prepare(
        `INSERT INTO sovereign_audit_logs
           (ip_address, event_type, path, timestamp_ns)
         VALUES (?, ?, ?, ?)`
      )
        .bind(ip, "QUARANTINE_VERIFY_ACCESS", url.pathname, nowIso)
        .run();
    }
  } catch {
    // Non-fatal — never block access on logging failure
  }

  const payload = buildSandboxedPayload(rayId, nowIso);

  // Store the access record in R2 for forensic reference
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    if (cfEnv.VAULT_R2) {
      const record = JSON.stringify({
        ray_id:     rayId,
        ip_address: ip,
        asn,
        user_agent: userAgent,
        path:       url.pathname,
        accessed_at: nowIso,
        kernel_sha: KERNEL_SHA,
      });
      await cfEnv.VAULT_R2.put(
        `quarantine/verify/${rayId}.json`,
        record,
        { httpMetadata: { contentType: "application/json" } }
      );
    }
  } catch {
    // Non-fatal
  }

  return Response.json(payload, {
    status: 200,
    headers: {
      "X-AveryOS-Kernel":        KERNEL_VERSION,
      "X-AveryOS-Gate":          "SANDBOXED_VERIFICATION",
      "X-GabrielOS-Attestation": "/api/v1/licensing/handshake",
      "Cache-Control":           "no-store",
    },
  });
}

export async function POST(): Promise<Response> {
  // POST to the verify endpoint is treated as an attestation submission attempt.
  // Redirect the caller to the correct handshake endpoint.
  return Response.json(
    {
      ok:      false,
      message: "Please submit your Usage Affidavit to /api/v1/licensing/handshake (POST).",
      redirect: "/api/v1/licensing/handshake",
      kernel: {
        sha:       KERNEL_SHA,
        version:   KERNEL_VERSION,
        disclosure: DISCLOSURE_MIRROR_PATH,
      },
    },
    { status: 308 }
  );
}
