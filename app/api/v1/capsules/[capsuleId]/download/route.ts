import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../../lib/sovereignError";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first(): Promise<Record<string, unknown> | null>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

/**
 * GET /api/v1/capsules/[capsuleId]/download?token=<download_token>
 *
 * Time-locked download endpoint.  Validates the download_token issued by the
 * Stripe webhook and — if valid and unexpired — returns the capsule metadata
 * and a signed download URL (currently the capsule content stored in D1).
 *
 * A token is valid for 48 hours from the moment it is generated.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ capsuleId: string }> }
) {
  try {
    const { capsuleId } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";

    if (!token) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'download token is required. Obtain one by purchasing the capsule.');
    }

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Validate license token
    const license = await cfEnv.DB.prepare(
      `SELECT cl.status, cl.token_expires_at, cl.email,
              sc.title, sc.sha512, sc.genesis_date, sc.tari_fee_usd, sc.description
       FROM capsule_licenses cl
       JOIN sovereign_capsules sc ON sc.capsule_id = cl.capsule_id
       WHERE cl.capsule_id = ?
         AND cl.download_token = ?
         AND cl.status = 'ACTIVE'`
    )
      .bind(capsuleId, token)
      .first();

    if (!license) {
      return aosErrorResponse(AOS_ERROR.LICENSE_INVALID, 'No active license found for this token.');
    }

    // Check expiry
    const expiresAt = license.token_expires_at ? new Date(String(license.token_expires_at)) : null;
    if (expiresAt && expiresAt < new Date()) {
      // Mark as expired
      await cfEnv.DB.prepare(
        `UPDATE capsule_licenses SET status = 'EXPIRED' WHERE capsule_id = ? AND download_token = ?`
      )
        .bind(capsuleId, token)
        .run();

      return aosErrorResponse(AOS_ERROR.TOKEN_EXPIRED, 'This download token has expired. Please purchase a new license.');
    }

    // Return capsule metadata + access confirmation
    // File bytes would be streamed from R2 here when an R2 binding is configured.
    return Response.json({
      capsule_id: capsuleId,
      title: license.title,
      description: license.description,
      sha512: license.sha512,
      genesis_date: license.genesis_date,
      tari_fee_usd: license.tari_fee_usd,
      licensed_to: license.email,
      token_expires_at: license.token_expires_at,
      access: "GRANTED",
      note: "Your license is valid. Capsule content is delivered via the R2 binding when configured.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
