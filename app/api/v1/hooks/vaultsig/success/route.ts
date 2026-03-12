/**
 * GET /api/v1/hooks/vaultsig/success
 *
 * VaultSig™ GitHub App — OAuth Installation Success Handler
 * AveryOS™ Phase 111.6 / GATE 111.6.2
 *
 * Handles the redirect from GitHub after a user successfully installs or
 * authorizes the VaultSig GitHub App.  GitHub appends `code` and
 * `installation_id` query parameters to this URL.
 *
 * This endpoint:
 *   1. Logs the successful installation to D1.
 *   2. Redirects the user to the AveryOS™ Sovereign Dashboard.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_VERSION }       from "../../../../../../lib/sovereignConstants";
import { formatIso9 }           from "../../../../../../lib/timePrecision";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
  NEXT_PUBLIC_SITE_URL?: string;
  SITE_URL?: string;
}

export async function GET(request: Request): Promise<Response> {
  const { env }  = await getCloudflareContext({ async: true });
  const cfEnv    = env as unknown as CloudflareEnv;

  const url            = new URL(request.url);
  const installationId = url.searchParams.get("installation_id") ?? "unknown";
  const setupAction    = url.searchParams.get("setup_action")    ?? "install";

  // ── Log installation event ─────────────────────────────────────────────
  if (cfEnv.DB) {
    const ts = formatIso9();
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vaultsig_installations (
         id              INTEGER PRIMARY KEY AUTOINCREMENT,
         installation_id TEXT    NOT NULL,
         setup_action    TEXT,
         logged_at       TEXT    NOT NULL,
         kernel          TEXT    NOT NULL
       )`
    ).run().catch(() => null);

    await cfEnv.DB.prepare(
      `INSERT INTO vaultsig_installations
         (installation_id, setup_action, logged_at, kernel)
       VALUES (?, ?, ?, ?)`
    )
      .bind(installationId, setupAction, ts, KERNEL_VERSION)
      .run()
      .catch(() => null);
  }

  // ── Redirect to sovereign dashboard ────────────────────────────────────
  const base     = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const redirect = `${base}/admin`;

  return Response.redirect(redirect, 302);
}
