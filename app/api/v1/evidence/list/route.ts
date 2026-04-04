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
 * GET /api/v1/evidence/list?prefix=evidence/&cursor=<cursor>&limit=<n>
 *
 * Lists objects in the VAULT_R2 bucket under the `evidence/` prefix.
 * Returns key names, sizes, and last-modified timestamps.
 *
 * Auth: HttpOnly `aos-vault-auth` cookie (VAULTAUTH_TOKEN).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";

interface R2ListOptions {
  prefix?:    string;
  cursor?:    string;
  limit?:     number;
  delimiter?: string;
}

interface R2ObjectKey {
  key:           string;
  size:          number;
  etag:          string;
  uploaded:      string; // ISO string
  httpMetadata?: Record<string, string>;
}

interface R2ListResult {
  objects:       R2ObjectKey[];
  truncated:     boolean;
  cursor?:       string;
  delimitedPrefixes?: string[];
}

interface R2Bucket {
  list(opts?: R2ListOptions): Promise<R2ListResult>;
}

interface CloudflareEnv {
  VAULT_R2?:         R2Bucket;
  VAULT_PASSPHRASE?: string;
  DB?: unknown;
}

function unauthorizedResponse() {
  return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "VaultGate token required", 401);
}

export async function GET(request: Request): Promise<Response> {
  // ── Auth: validate HttpOnly cookie ─────────────────────────────────────────
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch  = cookieHeader.match(/aos-vault-auth=([^;]+)/);
  const cookieToken  = cookieMatch ? cookieMatch[1] : null;

  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  if (!cfEnv.VAULT_PASSPHRASE || !cookieToken) {
    return unauthorizedResponse();
  }
  if (cookieToken !== cfEnv.VAULT_PASSPHRASE) {
    return unauthorizedResponse();
  }

  // ── R2 availability check ───────────────────────────────────────────────────
  if (!cfEnv.VAULT_R2) {
    return aosErrorResponse(
      AOS_ERROR.BINDING_MISSING,
      "VAULT_R2 binding not configured",
      503,
    );
  }

  // ── Query params ────────────────────────────────────────────────────────────
  const url    = new URL(request.url);
  const prefix = url.searchParams.get("prefix") ?? "evidence/";
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "100", 10);
  const limit  = Math.min(Math.max(limitRaw, 1), 1000);

  try {
    const listResult = await cfEnv.VAULT_R2.list({
      prefix,
      cursor,
      limit,
    });

    const objects = listResult.objects.map((obj) => ({
      key:      obj.key,
      size:     obj.size,
      uploaded: typeof obj.uploaded === "string" ? obj.uploaded : new Date(obj.uploaded).toISOString(),
      etag:     obj.etag,
    }));

    return Response.json({
      objects,
      truncated:       listResult.truncated,
      cursor:          listResult.cursor ?? null,
      count:           objects.length,
      prefix,
      kernel_sha:      KERNEL_SHA.slice(0, 16),
      kernel_version:  KERNEL_VERSION,
    });
  } catch (err: unknown) {
    return aosErrorResponse(
      AOS_ERROR.DB_QUERY_FAILED,
      `R2 list failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}
