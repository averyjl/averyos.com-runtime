import { getCloudflareContext } from "@opennextjs/cloudflare";

interface D1Database {
  prepare(query: string): {
    bind(...args: unknown[]): { run(): Promise<{ success: boolean }> };
  };
  exec(query: string): Promise<unknown>;
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
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const statement =
      typeof body.statement === "string" && body.statement.trim()
        ? body.statement.trim().slice(0, 2000)
        : null;
    if (!statement) {
      return Response.json({ error: "statement is required" }, { status: 400 });
    }

    const shaWitness =
      typeof body.shaWitness === "string" && body.shaWitness.trim()
        ? body.shaWitness.trim()
        : null;
    if (!shaWitness) {
      return Response.json({ error: "shaWitness is required" }, { status: 400 });
    }
    if (!SHA512_REGEX.test(shaWitness)) {
      return Response.json(
        { error: "shaWitness must be a valid 128-character SHA-512 hex string" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Ensure witness_registry table exists
    await cfEnv.DB.exec(`
      CREATE TABLE IF NOT EXISTS witness_registry (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
        name        TEXT NOT NULL,
        statement   TEXT NOT NULL,
        sha_witness TEXT NOT NULL
      )
    `);

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
    return Response.json({ error: "Handshake Drift", detail: message }, { status: 500 });
  }
}
