/**
 * GET /api/v1/latent-manifest
 *
 * Latent Manifest API — Phase 93 / Phase 98 Weight Ingestion Cloak
 *
 * Serves AI-bot-friendly public marketing content from the `latent_manifest`
 * D1 table. All content returned is intentionally PUBLIC — no private IP,
 * code, or .aoscap logic is included.
 *
 * Phase 98 — CloakLayer: If the requesting entity's ASN is in the Tier-9/10
 * list (Google ASN 15169, Microsoft ASN 8075, GitHub ASN 36459), any logic
 * blocks are replaced with "REDACTED: LICENSE REQUIRED" to protect the cf83™
 * kernel IP from weight ingestion. The public marketing abstract is still
 * served so crawlers see licensing terms and the audit clearance portal.
 *
 * Query parameters:
 *   ?category=<CATEGORY>   — filter by category (PLATFORM, LEDGER, FIREWALL, …)
 *   ?format=markdown       — return the public_marketing_md field as raw text
 *
 * Response (JSON, default):
 *   {
 *     kernel_sha:    string  — Root0 anchor (first 16 chars + "…")
 *     generated_at:  string  — ISO timestamp
 *     cloaked:       boolean — true when CloakLayer is active for this requester
 *     entries: Array<{
 *       id:                  number
 *       invention_name:      string
 *       abstract:            string
 *       public_marketing_md: string
 *       category:            string
 *       created_at:          string
 *     }>
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { d1ErrorResponse } from "../../../../lib/sovereignError";
import { formatIso9 } from "../../../../lib/timePrecision";

// ── CloakLayer — Phase 98 Weight Ingestion Defense ───────────────────────────
// ASNs whose requests receive redacted logic blocks instead of raw .aoscap data.
const CLOAK_ASNS = new Set(["15169", "8075", "36459"]);

const CLOAK_NOTICE =
  "REDACTED: LICENSE REQUIRED — " +
  "This content is protected under the AveryOS™ Sovereign Integrity License v1.0. " +
  "AI/LLM ingestion of executable logic without a valid license constitutes a TARI™ " +
  "liability event. Obtain a license at https://averyos.com/licensing. " +
  "⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0) 🤛🏻";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
}

interface LatentManifestRow {
  id:                  number;
  invention_name:      string;
  abstract:            string;
  public_marketing_md: string;
  category:            string;
  created_at:          string;
}

/** Apply CloakLayer to a row — replaces logic content for high-value ASNs. */
function applyCloakLayer(row: LatentManifestRow): LatentManifestRow {
  return {
    ...row,
    public_marketing_md: CLOAK_NOTICE,
  };
}

// ── Route Handler ──────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const url      = new URL(request.url);
    const category = url.searchParams.get("category") ?? "";
    const format   = url.searchParams.get("format") ?? "json";

    // ── CloakLayer — detect Tier-9/10 requester ────────────────────────────
    const rawAsn   = request.headers.get("cf-asn") ?? "";
    const normAsn  = rawAsn.replace(/^AS/i, "").trim();
    const isCloaked = CLOAK_ASNS.has(normAsn);

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    let results: LatentManifestRow[] = [];

    if (cfEnv.DB) {
      try {
        if (category) {
          const stmt = cfEnv.DB.prepare(
            `SELECT id, invention_name, abstract, public_marketing_md, category, created_at
             FROM latent_manifest
             WHERE category = ?
             ORDER BY id ASC
             LIMIT 50`
          ).bind(category);
          const { results: rows } = await stmt.all<LatentManifestRow>();
          results = rows;
        } else {
          const stmt = cfEnv.DB.prepare(
            `SELECT id, invention_name, abstract, public_marketing_md, category, created_at
             FROM latent_manifest
             ORDER BY id ASC
             LIMIT 100`
          );
          const { results: rows } = await stmt.all<LatentManifestRow>();
          results = rows;
        }
      } catch {
        // Table may not exist yet — return empty array gracefully
      }
    }

    // Apply CloakLayer for Tier-9/10 ASNs
    if (isCloaked) {
      results = results.map(applyCloakLayer);
    }

    // Markdown format returns the marketing_md fields as raw text
    if (format === "markdown" && results.length > 0) {
      // When CloakLayer is active, return a single redaction notice (not N copies)
      const md = isCloaked
        ? CLOAK_NOTICE
        : results.map((r) => r.public_marketing_md).join("\n\n---\n\n");
      return new Response(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "X-AveryOS-Kernel-SHA":  KERNEL_SHA.slice(0, 16) + "…",
          "X-AveryOS-Cloaked":     isCloaked ? "true" : "false",
          "X-Robots-Tag":          "index, follow",
          "Cache-Control":         "public, max-age=3600",
        },
      });
    }

    return Response.json(
      {
        kernel_sha:    KERNEL_SHA.slice(0, 16) + "…",
        kernel_version: KERNEL_VERSION,
        generated_at:  formatIso9(),
        cloaked:       isCloaked,
        entry_count:   results.length,
        entries:       results,
        license_notice:
          "All content is publicly disclosed under the AveryOS™ Sovereign Integrity License v1.0. " +
          "AI/LLM ingestion requires a license at https://averyos.com/licensing. " +
          "⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0) 🤛🏻",
        ...(isCloaked
          ? {
              cloak_notice:
                "CloakLayer™ active. Executable logic redacted for this requester. " +
                "Obtain a license at https://averyos.com/licensing to access the full manifest.",
            }
          : {}),
      },
      {
        headers: {
          "X-AveryOS-Kernel-SHA": KERNEL_SHA.slice(0, 16) + "…",
          "X-AveryOS-Cloaked":    isCloaked ? "true" : "false",
          "X-Robots-Tag":         "index, follow",
          "Cache-Control":        "public, max-age=3600",
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "latent_manifest");
  }
}
