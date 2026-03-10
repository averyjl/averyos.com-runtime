import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

/**
 * GET /api/v1/vault/evidence?sha512=<hash> | ?ray_id=<id>
 *
 * Retrieves a sealed forensic evidence bundle from R2 VAULT_R2.
 * Used by the VaultChain™ Explorer R2 Evidence Lookup UI.
 *
 * Query parameters:
 *   sha512  — Full SHA-512 of the evidence bundle (stored at evidence/<sha512>.json)
 *   ray_id  — Cloudflare RayID or bundle_id; resolved to sha512 via anchor_audit_logs
 *
 * Returns the evidence bundle JSON or 404 if not found.
 *
 * Auth: Public (read-only — evidence bundles are forensic records, intentionally public).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface R2ObjectBody {
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): {
    first<T = unknown>(): Promise<T | null>;
  };
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  VAULT_R2: R2Bucket;
  DB: D1Database;
}

interface AnchorRow {
  sha512: string;
  ray_id: string | null;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    if (!cfEnv.VAULT_R2) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "VAULT_R2 R2 binding is not configured.");
    }

    const url   = new URL(request.url);
    const sha512Input = url.searchParams.get("sha512")?.trim() ?? "";
    const rayId       = url.searchParams.get("ray_id")?.trim()  ?? "";

    let sha512 = sha512Input;

    // Resolve ray_id → sha512 via anchor_audit_logs
    if (!sha512 && rayId) {
      if (!cfEnv.DB) {
        return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "D1 DB binding is not configured for RayID resolution.");
      }
      const row = await cfEnv.DB.prepare(
        `SELECT sha512, ray_id FROM anchor_audit_logs
         WHERE ray_id = ? OR sha512 = ?
         ORDER BY id DESC LIMIT 1`
      )
        .bind(rayId, rayId)
        .first<AnchorRow>();

      if (row) {
        sha512 = row.sha512;
      }
    }

    if (!sha512) {
      return aosErrorResponse(
        AOS_ERROR.MISSING_FIELD,
        "Provide either sha512 or ray_id query parameter."
      );
    }

    // Validate sha512 format
    if (!/^[a-fA-F0-9]{16,128}$/.test(sha512)) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "sha512 must be a hex string (16–128 chars).");
    }

    const r2Key = `evidence/${sha512}.json`;
    const obj   = await cfEnv.VAULT_R2.get(r2Key);

    if (!obj) {
      return Response.json(
        {
          status:    "EVIDENCE_NOT_FOUND",
          sha512,
          ray_id:    rayId || undefined,
          r2_key:    r2Key,
          detail:    "No forensic evidence bundle found for this SHA-512. The event may not yet be packaged.",
          kernel_sha: KERNEL_SHA.slice(0, 16) + "…",
          kernel_version: KERNEL_VERSION,
        },
        { status: 404 }
      );
    }

    const bundleJson = await obj.text();
    let bundle: unknown;
    try {
      bundle = JSON.parse(bundleJson);
    } catch {
      return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, "Stored evidence bundle is not valid JSON.");
    }

    return Response.json({
      ...(bundle as object),
      _meta: {
        r2_key:         r2Key,
        sha512,
        retrieved_at:   new Date().toISOString(),
        kernel_sha:     KERNEL_SHA.slice(0, 16) + "…",
        kernel_version: KERNEL_VERSION,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
