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
 * POST /api/v1/whitepaper/approve/[id]
 *
 * Creator approval / rejection endpoint for whitepaper drafts.
 *
 * Only Jason Lee Avery (ROOT0) can approve or reject a draft.
 * Authentication: Bearer token matching VAULT_PASSPHRASE env var.
 *
 * Body (JSON):
 *   {
 *     action: "approve" | "reject",
 *     approved_by?: string,      // identifier of the approver (default: "ROOT0")
 *     rejection_note?: string    // required when action = "reject"
 *   }
 *
 * Responses:
 *   200 — version updated; returns full version record
 *   400 — missing/invalid body fields
 *   401 — missing or invalid admin token
 *   404 — version not found
 *   409 — version already approved or rejected
 *
 * Business rules:
 *   • Only `pending` versions may be approved or rejected.
 *   • Approved versions become immediately visible at /whitepaper.
 *   • Rejected versions are archived; they can be re-submitted as a new slug.
 *   • The approved_at timestamp is set to the current ISO-9 microsecond time.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../../lib/sovereignError";
import type { D1Database } from "../../../../../../lib/cloudflareTypes";

// ── Route-specific env shape ──────────────────────────────────────────────────

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
}

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
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAdmin(request: Request, passphrase: string | undefined): boolean {
  if (!passphrase) return false;
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token.length > 0 && token === passphrase;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  // ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (!Number.isFinite(id) || id <= 0) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "id must be a positive integer.", 400);
  }

  let cfEnv: CloudflareEnv = {};
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch {
    // local dev
  }

  if (!isAdmin(request, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "CreatorLock: admin token required.", 401);
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "Database not configured.", 503);
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Invalid JSON body.", 400);
  }

  if (typeof body !== "object" || body === null) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Body must be a JSON object.", 400);
  }

  const rec = body as Record<string, unknown>;
  const action = rec.action;

  if (action !== "approve" && action !== "reject") {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      'action must be "approve" or "reject".',
      400,
    );
  }

  const approvedBy = typeof rec.approved_by === "string" && rec.approved_by.trim()
    ? rec.approved_by.trim()
    : "ROOT0";

  const rejectionNote = typeof rec.rejection_note === "string" ? rec.rejection_note.trim() : null;

  if (action === "reject" && !rejectionNote) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "rejection_note is required when action = reject.",
      400,
    );
  }

  // Fetch the version
  const existing = await cfEnv.DB.prepare(
    `SELECT id, title, version_slug, sha512, anchor_sha, kernel_version,
            status, submitted_at, approved_at, approved_by, rejection_note
     FROM whitepaper_versions WHERE id = ?`,
  ).bind(id).first<WhitepaperVersionRow>();

  if (!existing) {
    return aosErrorResponse(AOS_ERROR.NOT_FOUND, `Whitepaper version #${id} not found.`, 404);
  }

  if (existing.status !== "pending") {
    return aosErrorResponse(
      AOS_ERROR.ALREADY_EXISTS,
      `Version #${id} is already '${existing.status}'. Only pending versions can be actioned.`,
      409,
    );
  }

  const now = formatIso9();

  // Apply the action
  if (action === "approve") {
    await cfEnv.DB.prepare(
      `UPDATE whitepaper_versions
       SET status = 'approved', approved_at = ?, approved_by = ?
       WHERE id = ?`,
    ).bind(now, approvedBy, id).run();
  } else {
    await cfEnv.DB.prepare(
      `UPDATE whitepaper_versions
       SET status = 'rejected', approved_at = ?, approved_by = ?, rejection_note = ?
       WHERE id = ?`,
    ).bind(now, approvedBy, rejectionNote, id).run();
  }

  // Return updated record
  const updated = await cfEnv.DB.prepare(
    `SELECT id, title, version_slug, sha512, anchor_sha, kernel_version,
            status, submitted_at, approved_at, approved_by, rejection_note
     FROM whitepaper_versions WHERE id = ?`,
  ).bind(id).first<WhitepaperVersionRow>();

  return Response.json({
    ok: true,
    action,
    message: action === "approve"
      ? `Whitepaper version '${existing.version_slug}' approved. Now live at /whitepaper.`
      : `Whitepaper version '${existing.version_slug}' rejected.`,
    kernel_sha: KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    actioned_at: now,
    version: updated,
  });
}
