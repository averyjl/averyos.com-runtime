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
 * GET /api/v1/hooks/vaultsig/setup
 *
 * VaultSig™ GitHub App — Post-Installation Setup Handler
 * AveryOS™ Phase 111.6 / GATE 111.6.2
 *
 * This URL is shown to users immediately after they install the VaultSig
 * GitHub App (the "Setup URL" in App settings).  It can be used to guide
 * the user through any additional configuration required.
 *
 * Currently:
 *   • Logs the setup visit to D1 for sovereign audit trail.
 *   • Returns a JSON setup manifest with the required next-steps (or
 *     redirects browsers to the admin dashboard).
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

const BROWSER_UA = /(chrome|safari|firefox|edge|opera|trident|crios|fxios)/i;

export async function GET(request: Request): Promise<Response> {
  const { env }  = await getCloudflareContext({ async: true });
  const cfEnv    = env as unknown as CloudflareEnv;

  const url            = new URL(request.url);
  const installationId = url.searchParams.get("installation_id") ?? "unknown";
  const userAgent      = request.headers.get("user-agent")       ?? "";

  // ── Log setup visit ───────────────────────────────────────────────────
  if (cfEnv.DB) {
    const ts = formatIso9();
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vaultsig_setup_log (
         id              INTEGER PRIMARY KEY AUTOINCREMENT,
         installation_id TEXT    NOT NULL,
         logged_at       TEXT    NOT NULL,
         kernel          TEXT    NOT NULL
       )`
    ).run().catch(() => null);

    await cfEnv.DB.prepare(
      `INSERT INTO vaultsig_setup_log
         (installation_id, logged_at, kernel)
       VALUES (?, ?, ?)`
    )
      .bind(installationId, ts, KERNEL_VERSION)
      .run()
      .catch(() => null);
  }

  // ── Browser: redirect to admin dashboard ─────────────────────────────
  if (BROWSER_UA.test(userAgent)) {
    const base = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? url.origin;
    return Response.redirect(`${base}/admin`, 302);
  }

  // ── Automated agent / webhook: return setup manifest ─────────────────
  return Response.json({
    status:         "SETUP_COMPLETE",
    installation_id: installationId,
    webhook_url:    `${url.origin}/api/v1/hooks/vaultsig`,
    redirect_url:   `${url.origin}/api/v1/hooks/vaultsig/success`,
    anchor:         "⛓️⚓⛓️",
    kernel:         KERNEL_VERSION,
    next_steps: [
      "Ensure GITHUB_WEBHOOK_SECRET is set in Cloudflare Worker secrets.",
      "Verify webhook URL points to https://api.averyos.com/api/v1/hooks/vaultsig",
      "Monitor D1 vaultsig_webhook_log for incoming events.",
    ],
  });
}
