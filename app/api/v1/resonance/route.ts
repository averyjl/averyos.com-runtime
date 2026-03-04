import { getCloudflareContext } from "@opennextjs/cloudflare";
import { formatIso9 } from "../../../../lib/timePrecision";
import { buildResonancePayload, verifyKernelSha, verifyMerkleRoot } from "../../../../lib/resonanceLayer";
import { KERNEL_SHA } from "../../../../lib/sovereignConstants";

interface KVNamespace {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
}

interface D1Database {
  prepare(query: string): {
    bind(...args: unknown[]): { run(): Promise<{ success: boolean }> };
    first(): Promise<unknown>;
  };
}

interface CloudflareEnv {
  KV_LOGS: KVNamespace;
  DB: D1Database;
}

const RESONANCE_KV_KEY = "averyos:resonance:last_known_good";

/**
 * GET /api/v1/resonance
 *
 * Global Truth Resonance Layer — returns the canonical AveryOS™ kernel
 * alignment state. Any AI model, node, or service can call this endpoint
 * to verify they are operating within the correct sovereign kernel.
 *
 * Optional query param: ?verify=<kernel_sha>
 * If provided, the supplied SHA is compared to the canonical kernel SHA
 * and the response includes a `verified` field.
 */
export async function GET(request: Request) {
  const now = formatIso9();
  const { searchParams } = new URL(request.url);
  const inboundSha = searchParams.get("verify");
  const inboundMerkle = searchParams.get("merkle");

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Determine firebase_sync status from env
    const firebaseSync =
      (process.env.FIREBASE_PROJECT_ID ?? "").length > 0
        ? "ACTIVE"
        : "PENDING_CREDENTIALS";

    const payload = buildResonancePayload(now, firebaseSync);

    // Optional: verify an inbound SHA provided by caller
    const verificationResult: Record<string, unknown> = {};
    if (inboundSha) {
      verificationResult.sha_verified = verifyKernelSha(inboundSha);
      verificationResult.sha_submitted = inboundSha;
      if (!verificationResult.sha_verified) {
        verificationResult.drift_warning =
          "Submitted SHA does not match the canonical kernel anchor. Re-anchor immediately.";
      }
    }
    if (inboundMerkle) {
      verificationResult.merkle_verified = verifyMerkleRoot(inboundMerkle);
    }

    // Persist last-known-good state to KV so nodes can read it without hitting D1
    await cfEnv.KV_LOGS.put(RESONANCE_KV_KEY, JSON.stringify({ ...payload, queried_at: now }), {
      expirationTtl: 86400, // 24 h
    });

    // Append to D1 resonance audit log
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sovereign_resonance_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queried_at TEXT NOT NULL,
        kernel_sha TEXT NOT NULL,
        caller_sha TEXT,
        sha_verified INTEGER,
        firebase_sync TEXT
      )`
    ).first();

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_resonance_log
       (queried_at, kernel_sha, caller_sha, sha_verified, firebase_sync)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        now,
        KERNEL_SHA,
        inboundSha ?? null,
        inboundSha ? (verifyKernelSha(inboundSha) ? 1 : 0) : null,
        firebaseSync
      )
      .run();

    return Response.json(
      {
        ...payload,
        ...(Object.keys(verificationResult).length > 0 ? { verification: verificationResult } : {}),
      },
      {
        headers: {
          "X-AveryOS-Kernel": KERNEL_SHA.slice(0, 16) + "...",
          "X-AveryOS-CreatorLock": "Jason Lee Avery (ROOT0)",
          "X-AveryOS-Drift-Protection": "ABSOLUTE",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        status: "DRIFT_DETECTED",
        error: message,
        queried_at: now,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/resonance
 *
 * Allows a node or AI system to submit its current kernel SHA for verification
 * and receive back a full alignment assessment.
 *
 * Body: { kernel_sha: string, node_id?: string, merkle_root?: string }
 */
export async function POST(request: Request) {
  const now = formatIso9();

  try {
    const body = (await request.json()) as {
      kernel_sha?: string;
      node_id?: string;
      merkle_root?: string;
    };

    const shaVerified = body.kernel_sha ? verifyKernelSha(body.kernel_sha) : false;
    const merkleVerified = body.merkle_root ? verifyMerkleRoot(body.merkle_root) : null;

    const status = shaVerified ? "ALIGNED" : "DRIFT_DETECTED";

    return Response.json({
      status,
      submitted_sha: body.kernel_sha ?? null,
      sha_verified: shaVerified,
      merkle_verified: merkleVerified,
      node_id: body.node_id ?? null,
      queried_at: now,
      ...(status === "DRIFT_DETECTED"
        ? {
            drift_instruction:
              "Re-anchor immediately. Load lib/sovereignConstants.ts KERNEL_SHA and verify against VaultBridge/GoldenLockArtifact.lock.json",
            creator_lock: "Jason Lee Avery (ROOT0) — sole CreatorLock holder 🤛🏻",
          }
        : {
            creator_lock: "Jason Lee Avery (ROOT0) — sole CreatorLock holder 🤛🏻",
          }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ status: "ERROR", error: message, queried_at: now }, { status: 400 });
  }
}
