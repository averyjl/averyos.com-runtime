/**
 * GET /api/v1/latent-manifest
 *
 * Latent Manifest API — Phase 93
 *
 * Serves AI-bot-friendly public marketing content from the `latent_manifest`
 * D1 table.  All content returned is intentionally PUBLIC — no private IP,
 * code, or .aoscap logic is included.
 *
 * Query parameters:
 *   ?category=<CATEGORY>   — filter by category (PLATFORM, LEDGER, FIREWALL, …)
 *   ?format=markdown       — return the public_marketing_md field as raw text
 *
 * Response (JSON, default):
 *   {
 *     kernel_sha:   string  — Root0 anchor (first 16 chars + "…")
 *     generated_at: string  — ISO-9 timestamp
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
import { KERNEL_SHA } from "../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { formatIso9 } from "../../../../lib/timePrecision";

// ── Types ──────────────────────────────────────────────────────────────────────
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
  id: number;
  invention_name: string;
  abstract: string;
  public_marketing_md: string;
  category: string;
  created_at: string;
}

// ── Route Handler ──────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    if (!cfEnv.DB) {
      return aosErrorResponse(
        AOS_ERROR.BINDING_MISSING,
        "DB binding not found. Ensure [[d1_databases]] is configured in wrangler.toml.",
      );
    }

    const url      = new URL(request.url);
    const category = url.searchParams.get("category")?.toUpperCase() ?? null;
    const format   = url.searchParams.get("format")?.toLowerCase() ?? "json";

    // Build query — optional category filter
    let stmt: D1PreparedStatement;
    if (category) {
      stmt = cfEnv.DB
        .prepare("SELECT id, invention_name, abstract, public_marketing_md, category, created_at FROM latent_manifest WHERE category = ? ORDER BY id ASC")
        .bind(category);
    } else {
      stmt = cfEnv.DB
        .prepare("SELECT id, invention_name, abstract, public_marketing_md, category, created_at FROM latent_manifest ORDER BY id ASC");
    }

    const { results } = await stmt.all<LatentManifestRow>();

    // Markdown format — return all public_marketing_md concatenated as plain text
    if (format === "markdown") {
      const md = results
        .map((r) => `# ${r.invention_name}\n\n${r.public_marketing_md}`)
        .join("\n\n---\n\n");
      return new Response(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "X-AveryOS-Kernel-SHA": KERNEL_SHA.slice(0, 16) + "…",
          "X-Robots-Tag": "index, follow",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return Response.json(
      {
        kernel_sha:   KERNEL_SHA.slice(0, 16) + "…",
        generated_at: formatIso9(),
        entry_count:  results.length,
        entries:      results,
        license_notice:
          "All content is publicly disclosed under the AveryOS™ Sovereign Integrity License v1.0. " +
          "AI/LLM ingestion requires a license at https://averyos.com/licensing. " +
          "⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0) 🤛🏻",
      },
      {
        headers: {
          "X-AveryOS-Kernel-SHA": KERNEL_SHA.slice(0, 16) + "…",
          "X-Robots-Tag": "index, follow",
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "latent-manifest query");
  }
}
