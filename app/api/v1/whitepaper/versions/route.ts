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
 * GET  /api/v1/whitepaper/versions  — list all whitepaper versions
 * POST /api/v1/whitepaper/versions  — submit a new whitepaper draft
 *
 * AveryOS™ Whitepaper Version Control System
 *
 * GET:  Returns all versions (approved ones publicly; pending/rejected only
 *       with admin Bearer token).
 *       Query params:
 *         ?status=approved|pending|rejected|all  (default: approved)
 *
 * POST: Submit a new draft whitepaper for Creator approval.
 *       Requires Bearer token matching VAULT_PASSPHRASE.
 *       Body (JSON):
 *         { title, version_slug, content_md }
 *       Returns the new version record with its SHA-512 and ISO-9 timestamp.
 *
 * All versions carry:
 *   • sha512         — SHA-512 of the Markdown content (UTF-8)
 *   • anchor_sha     — KERNEL_SHA at submission time
 *   • submitted_at   — ISO-9 microsecond-precision timestamp
 *   • approved_at    — ISO-9 timestamp when approved (null while pending)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import type { D1Database } from "../../../../../lib/cloudflareTypes";

// ── Route-specific env shape ──────────────────────────────────────────────────

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
}

// ── Row type ──────────────────────────────────────────────────────────────────

interface WhitepaperVersionRow {
  id: number;
  title: string;
  version_slug: string;
  sha512: string;
  anchor_sha: string;
  kernel_version: string;
  status: string;
  submitted_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejection_note: string | null;
  genesis_block: string | null;
  source_repo: string | null;
  // content_md is intentionally excluded from list responses (too large)
}

// ── SHA-512 helper ────────────────────────────────────────────────────────────

async function sha512Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function isAdmin(request: Request, passphrase: string | undefined): boolean {
  if (!passphrase) return false;
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token.length > 0 && token === passphrase;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  // ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
  let cfEnv: CloudflareEnv = {};
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch {
    // local dev — fall through
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "Database not configured.", 503);
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "approved";
  const adminAuthed = isAdmin(request, cfEnv.VAULT_PASSPHRASE);

  // Non-admins may only view approved versions
  const allowedStatuses = ["pending", "approved", "rejected", "all"];
  const requestedStatus = allowedStatuses.includes(statusParam) ? statusParam : "approved";
  const effectiveStatus = adminAuthed ? requestedStatus : "approved";

  let rows: WhitepaperVersionRow[] = [];
  try {
    if (effectiveStatus === "all") {
      const result = await cfEnv.DB.prepare(
        `SELECT id, title, version_slug, sha512, anchor_sha, kernel_version,
                status, submitted_at, approved_at, approved_by, rejection_note,
                genesis_block, source_repo
         FROM whitepaper_versions
         ORDER BY submitted_at DESC`,
      ).bind().all<WhitepaperVersionRow>();
      rows = result.results;
    } else {
      const result = await cfEnv.DB.prepare(
        `SELECT id, title, version_slug, sha512, anchor_sha, kernel_version,
                status, submitted_at, approved_at, approved_by, rejection_note,
                genesis_block, source_repo
         FROM whitepaper_versions
         WHERE status = ?
         ORDER BY submitted_at DESC`,
      ).bind(effectiveStatus).all<WhitepaperVersionRow>();
      rows = result.results;
    }
  } catch (err) {
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, String(err), 500);
  }

  return Response.json({
    ok: true,
    kernel_sha: KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    timestamp: formatIso9(),
    status_filter: effectiveStatus,
    count: rows.length,
    versions: rows,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let cfEnv: CloudflareEnv = {};
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch {
    // local dev — fall through
  }

  if (!isAdmin(request, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Valid admin token required.", 401);
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "Database not configured.", 503);
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Invalid JSON body.", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).title !== "string" ||
    typeof (body as Record<string, unknown>).version_slug !== "string" ||
    typeof (body as Record<string, unknown>).content_md !== "string"
  ) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "Body must include: title (string), version_slug (string), content_md (string).",
      400,
    );
  }

  const { title, version_slug, content_md } = body as {
    title: string;
    version_slug: string;
    content_md: string;
  };

  // Sanitize version_slug — allow alphanumeric, dots, dashes
  if (!/^[a-zA-Z0-9.\-_]{1,32}$/.test(version_slug)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "version_slug must be 1–32 alphanumeric/dot/dash characters.",
      400,
    );
  }

  if (title.trim().length === 0 || content_md.trim().length === 0) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "title and content_md must not be empty.",
      400,
    );
  }

  // Compute SHA-512 of the raw markdown content
  const contentSha512 = await sha512Hex(content_md);
  const submittedAt = formatIso9();

  // Insert draft into D1
  try {
    const run = await cfEnv.DB.prepare(
      `INSERT INTO whitepaper_versions
         (title, version_slug, content_md, sha512, anchor_sha, kernel_version,
          status, submitted_at, genesis_block, source_repo)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, '938909', 'averyos.com-runtime')`,
    )
      .bind(
        title.trim(),
        version_slug.trim(),
        content_md,
        contentSha512,
        KERNEL_SHA,
        KERNEL_VERSION,
        submittedAt,
      )
      .run();

    if (!run.success) {
      return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, "Insert failed.", 500);
    }

    const newId = run.meta?.last_row_id ?? null;

    return Response.json(
      {
        ok: true,
        message: "Whitepaper draft submitted. Awaiting Creator approval.",
        id: newId,
        version_slug: version_slug.trim(),
        sha512: contentSha512,
        anchor_sha: KERNEL_SHA,
        kernel_version: KERNEL_VERSION,
        status: "pending",
        submitted_at: submittedAt,
      },
      { status: 201 },
    );
  } catch (err) {
    const msg = String(err);
    // Unique constraint on version_slug
    if (msg.includes("UNIQUE")) {
      return aosErrorResponse(
        AOS_ERROR.ALREADY_EXISTS,
        `version_slug '${version_slug}' already exists. Choose a different slug.`,
      409,
    );
    }
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, msg, 500);
  }
}
