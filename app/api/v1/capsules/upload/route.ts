import { getCloudflareContext } from "@opennextjs/cloudflare";
import { signCapsule } from "../../../../../lib/CapsuleSigner";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { safeEqual } from "../../../../../lib/taiLicenseGate";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  all(): Promise<{ results: Record<string, unknown>[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_PASSPHRASE?: string;
}

/**
 * POST /api/v1/capsules/upload
 *
 * Sovereign-only endpoint for uploading a .aoscap capsule to D1.
 *
 * Security:
 *   • Requires the Authorization header: Bearer <VAULT_PASSPHRASE>
 *   • The Physical AveryOS™ Anchor Salt is verified against the Root0 SHA-512
 *
 * Body (multipart/form-data or JSON):
 *   capsule_id   string   unique slug / filename stem
 *   title        string
 *   description  string   (optional)
 *   genesis_date string   ISO-8601 date
 *   tari_fee_usd number   TARI™ Alignment Fee in USD
 *   content      string   raw .aoscap file content (used for SHA-512 + signing)
 */
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Authentication: VAULT_PASSPHRASE Bearer token ──────────────────────
    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    const expected = cfEnv.VAULT_PASSPHRASE ?? "";
    if (!expected) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, 'VAULT_PASSPHRASE secret is not set.');
    }
    if (!safeEqual(token, expected)) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, 'Invalid or missing passphrase.');
    }

    // ── Parse body ─────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = (await request.json()) as Record<string, unknown>;
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      body = Object.fromEntries(
        Array.from(form.entries()).map(([k, v]) => [k, typeof v === "string" ? v : v.toString()])
      );
    } else {
      body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    }

    const capsule_id = typeof body.capsule_id === "string" ? body.capsule_id.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const genesis_date = typeof body.genesis_date === "string" ? body.genesis_date.trim() : "";
    const tari_fee_usd = typeof body.tari_fee_usd === "number"
      ? body.tari_fee_usd
      : parseFloat(String(body.tari_fee_usd ?? "1.00"));
    const content = typeof body.content === "string" ? body.content : JSON.stringify(body);

    if (!capsule_id || !title || !genesis_date) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'All required fields must be provided.');
    }

    // Slugify capsule_id: replace any non-alphanumeric char with a hyphen.
    // The sanitised ID is returned in the response so uploaders know what
    // was actually stored (e.g. spaces become hyphens).
    const safeId = capsule_id.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase().slice(0, 128);

    // ── Sign the capsule ───────────────────────────────────────────────────
    const signature = await signCapsule(safeId, content);

    // ── Compute SHA-512 of the content via Web Crypto ──────────────────────
    const encoded = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-512", encoded);
    const sha512 = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const uploadedAt = new Date().toISOString();

    // ── Ensure table exists ───────────────────────────────────────────────
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sovereign_capsules (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        capsule_id      TEXT    NOT NULL UNIQUE,
        title           TEXT    NOT NULL,
        description     TEXT,
        sha512          TEXT    NOT NULL,
        genesis_date    TEXT    NOT NULL,
        tari_fee_usd    REAL    NOT NULL DEFAULT 1.00,
        file_key        TEXT,
        status          TEXT    NOT NULL DEFAULT 'ACTIVE',
        uploaded_at     TEXT    NOT NULL,
        uploaded_by     TEXT    NOT NULL DEFAULT 'SOVEREIGN_ADMIN'
      )`
    ).run();

    // ── Insert into D1 ─────────────────────────────────────────────────────
    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_capsules
         (capsule_id, title, description, sha512, genesis_date, tari_fee_usd, status, uploaded_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 'SOVEREIGN_ADMIN')
       ON CONFLICT(capsule_id) DO UPDATE SET
         title        = excluded.title,
         description  = excluded.description,
         sha512       = excluded.sha512,
         genesis_date = excluded.genesis_date,
         tari_fee_usd = excluded.tari_fee_usd,
         uploaded_at  = excluded.uploaded_at`
    )
      .bind(safeId, title, description, sha512, genesis_date, isNaN(tari_fee_usd) ? 1.00 : tari_fee_usd, uploadedAt)
      .run();

    return Response.json({
      success: true,
      capsule_id: safeId,
      sha512,
      signature,
      uploaded_at: uploadedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
