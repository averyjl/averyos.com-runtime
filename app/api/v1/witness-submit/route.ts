import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";

interface D1Database {
  prepare(query: string): {
    bind(...args: unknown[]): { run(): Promise<{ success: boolean }> };
    run(): Promise<{ success: boolean }>;
  };
}

interface CloudflareEnv {
  DB: D1Database;
}

const SHA512_REGEX = /^[a-fA-F0-9]{128}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 100)
        : null;
    if (!name) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'name is required');
    }

    const statement =
      typeof body.statement === "string" && body.statement.trim()
        ? body.statement.trim().slice(0, 2000)
        : null;
    if (!statement) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'statement is required');
    }

    const shaWitness =
      typeof body.shaWitness === "string" && body.shaWitness.trim()
        ? body.shaWitness.trim()
        : null;
    if (!shaWitness) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'shaWitness is required');
    }
    if (!SHA512_REGEX.test(shaWitness)) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, 'shaWitness must be a valid 128-character SHA-512 hex string');
    }

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Ensure witness_registry table exists
    await cfEnv.DB.prepare(`
      CREATE TABLE IF NOT EXISTS witness_registry (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
        name        TEXT NOT NULL,
        statement   TEXT NOT NULL,
        sha_witness TEXT NOT NULL
      )
    `).run();

    const timestamp = new Date().toISOString();

    await cfEnv.DB.prepare(
      "INSERT INTO witness_registry (timestamp, name, statement, sha_witness) VALUES (?, ?, ?, ?)"
    )
      .bind(timestamp, name, statement, shaWitness)
      .run();

    return Response.json({
      success: true,
      message: "Witness Entry Anchored",
      timestamp,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("⚠️  witness-submit error:", message);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
