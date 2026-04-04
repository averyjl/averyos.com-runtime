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
 * GET /api/v1/evidence/file?key=evidence%2F<rayid>.json
 *
 * Fetches the content of a single evidence object from VAULT_R2.
 * Returns the raw JSON body as a parsed response.
 *
 * Auth: HttpOnly `aos-vault-auth` cookie (VAULTAUTH_TOKEN).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

interface R2Object {
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  body:        ReadableStream;
  size:        number;
  etag:        string;
  uploaded:    Date;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
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
  // ── Auth ───────────────────────────────────────────────────────────────────
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

  if (!cfEnv.VAULT_R2) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "VAULT_R2 binding not configured", 503);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "key query parameter required", 400);
  }

  // Restrict to evidence/ prefix — never allow arbitrary R2 key access
  if (!key.startsWith("evidence/")) {
    return aosErrorResponse(AOS_ERROR.FORBIDDEN, "key must be under evidence/ prefix", 403);
  }

  try {
    const obj = await cfEnv.VAULT_R2.get(key);
    if (!obj) {
      return aosErrorResponse(AOS_ERROR.NOT_FOUND, `Object not found: ${key}`, 404);
    }
    const raw  = await obj.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
    return Response.json({
      key,
      size:     obj.size,
      uploaded: obj.uploaded.toISOString(),
      etag:     obj.etag,
      data:     parsed,
    });
  } catch (err: unknown) {
    return aosErrorResponse(
      AOS_ERROR.DB_QUERY_FAILED,
      `R2 get failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}
