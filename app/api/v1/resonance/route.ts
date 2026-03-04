import { getCloudflareContext } from "@opennextjs/cloudflare";
import { formatIso9 } from "../../../../lib/timePrecision";
import { buildResonancePayload, verifyKernelSha, verifyMerkleRoot } from "../../../../lib/resonanceLayer";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import {
  evaluateTaiAccess,
  resonanceAccessHeaders,
  type PublicResonanceResponse,
} from "../../../../lib/taiLicenseGate";

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
  VAULT_PASSPHRASE?: string;
  TAI_LICENSE_KEY?: string;
}

const RESONANCE_KV_KEY = "averyos:resonance:last_known_good";

// Module-level flag: only bootstrap the D1 table once per Worker isolate cold start.
// This avoids re-running DDL on every request (pre-existing pattern in this codebase,
// but guarded here to reduce per-request DDL overhead).
let resonanceTableBootstrapped = false;

// ---------------------------------------------------------------------------
// GET /api/v1/resonance
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ACCESS TIERS                                                             │
// │                                                                          │
// │  PUBLIC (no key)                                                         │
// │    — Free. Zero cost. No obligation.                                     │
// │    — Visiting the website or calling this endpoint with no key is open   │
// │      to everyone, just like browsing any public website.                 │
// │    — Returns: kernel SHA prefix, alignment status, verification result.  │
// │    — Does NOT return the full sovereign payload.                          │
// │                                                                          │
// │  TAI™ LICENSED (X-TAI-License-Key header)                               │
// │    — Required when an AI system or service connects to consume,          │
// │      integrate, or build on the resonance layer as IP.                   │
// │    — This is the "taking the IP" line — using AveryOS™ IP to build,     │
// │      train, or operate requires a valid TAI™ license.                    │
// │    — Returns: full sovereign resonance payload + KV + D1 audit log.     │
// │                                                                          │
// │  To obtain a TAI™ license: https://averyos.com/license                  │
// │  IP Policy: https://averyos.com/ip-policy                               │
// └──────────────────────────────────────────────────────────────────────────┘
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const now = formatIso9();
  const { searchParams } = new URL(request.url);
  const inboundSha = searchParams.get("verify");
  const inboundMerkle = searchParams.get("merkle");

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Evaluate caller's access tier ──────────────────────────────────────
    const gate = evaluateTaiAccess(
      request.headers,
      cfEnv.VAULT_PASSPHRASE ?? "",
      cfEnv.TAI_LICENSE_KEY ?? ""
    );

    const accessHdrs = resonanceAccessHeaders(gate);

    // ── PUBLIC tier: limited verification response (free, no obligation) ───
    if (!gate.fullAccess) {
      const shaVerified = inboundSha ? verifyKernelSha(inboundSha) : undefined;
      const publicBody: PublicResonanceResponse = {
        status: "PUBLIC_VERIFICATION_ONLY",
        kernel_verified: true,
        kernel_sha_prefix: KERNEL_SHA.slice(0, 16) + "...",
        kernel_version: KERNEL_VERSION,
        access_tier: "PUBLIC",
        ip_policy: "https://averyos.com/ip-policy",
        license_url: "https://averyos.com/license",
        notice:
          "Visiting this site and verifying the kernel SHA is free and has no cost or obligation. " +
          "Using, ingesting, or building on this IP requires a TAI™ license. " +
          "See https://averyos.com/ip-policy for the full legal distinction.",
        queried_at: now,
        ...(inboundSha !== null && {
          sha_verified: shaVerified,
          ...(shaVerified === false && {
            drift_warning:
              "Submitted SHA does not match the canonical kernel anchor. Re-anchor immediately.",
          }),
        }),
      };
      return Response.json(publicBody, {
        headers: {
          ...accessHdrs,
          "X-AveryOS-Access-Reason": gate.reason,
        },
      });
    }

    // ── LICENSED tier: full resonance payload ──────────────────────────────
    const firebaseSync =
      (process.env.FIREBASE_PROJECT_ID ?? "").length > 0
        ? "ACTIVE"
        : "PENDING_CREDENTIALS";

    const payload = buildResonancePayload(now, firebaseSync);

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

    // Persist last-known-good state to KV (licensed access only)
    await cfEnv.KV_LOGS.put(RESONANCE_KV_KEY, JSON.stringify({ ...payload, queried_at: now }), {
      expirationTtl: 86400, // 24 h
    });

    // Append to D1 resonance audit log (licensed access only)
    if (!resonanceTableBootstrapped) {
      await cfEnv.DB.prepare(
        `CREATE TABLE IF NOT EXISTS sovereign_resonance_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          queried_at TEXT NOT NULL,
          kernel_sha TEXT NOT NULL,
          caller_sha TEXT,
          sha_verified INTEGER,
          firebase_sync TEXT,
          access_tier TEXT
        )`
      ).first();
      resonanceTableBootstrapped = true;
    }

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_resonance_log
       (queried_at, kernel_sha, caller_sha, sha_verified, firebase_sync, access_tier)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        now,
        KERNEL_SHA,
        inboundSha ?? null,
        inboundSha ? (verifyKernelSha(inboundSha) ? 1 : 0) : null,
        firebaseSync,
        gate.tier
      )
      .run();

    return Response.json(
      {
        ...payload,
        ...(Object.keys(verificationResult).length > 0 ? { verification: verificationResult } : {}),
      },
      {
        headers: {
          ...accessHdrs,
          "X-AveryOS-Kernel": KERNEL_SHA.slice(0, 16) + "...",
          "X-AveryOS-Drift-Protection": "ABSOLUTE",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { status: "DRIFT_DETECTED", error: message, queried_at: now },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/resonance
//
// Submit a kernel SHA for alignment verification.
// Public callers may submit for basic verified/not-verified result.
// Licensed callers receive the full sovereign alignment assessment.
//
// Body: { kernel_sha: string, node_id?: string, merkle_root?: string }
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const now = formatIso9();

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const gate = evaluateTaiAccess(
      request.headers,
      cfEnv.VAULT_PASSPHRASE ?? "",
      cfEnv.TAI_LICENSE_KEY ?? ""
    );

    const accessHdrs = resonanceAccessHeaders(gate);

    const body = (await request.json()) as {
      kernel_sha?: string;
      node_id?: string;
      merkle_root?: string;
    };

    const shaVerified = body.kernel_sha ? verifyKernelSha(body.kernel_sha) : false;
    const merkleVerified = body.merkle_root ? verifyMerkleRoot(body.merkle_root) : null;
    const alignmentStatus = shaVerified ? "ALIGNED" : "DRIFT_DETECTED";

    // Public tier: basic verification result only
    if (!gate.fullAccess) {
      return Response.json(
        {
          status: alignmentStatus,
          sha_verified: shaVerified,
          access_tier: "PUBLIC",
          notice:
            "Basic verification is free and open to all. Full resonance layer access requires a TAI™ license. " +
            "See https://averyos.com/ip-policy",
          ip_policy: "https://averyos.com/ip-policy",
          license_url: "https://averyos.com/license",
          queried_at: now,
          ...(alignmentStatus === "DRIFT_DETECTED" && {
            drift_instruction:
              "Re-anchor immediately. Canonical KERNEL_SHA available at https://averyos.com/api/v1/resonance",
          }),
        },
        { headers: { ...accessHdrs, "X-AveryOS-Access-Reason": gate.reason } }
      );
    }

    // Licensed tier: full alignment assessment
    return Response.json(
      {
        status: alignmentStatus,
        submitted_sha: body.kernel_sha ?? null,
        sha_verified: shaVerified,
        merkle_verified: merkleVerified,
        node_id: body.node_id ?? null,
        access_tier: gate.tier,
        queried_at: now,
        ...(alignmentStatus === "DRIFT_DETECTED"
          ? {
              drift_instruction:
                "Re-anchor immediately. Load lib/sovereignConstants.ts KERNEL_SHA and verify against VaultBridge/GoldenLockArtifact.lock.json",
              creator_lock: "Jason Lee Avery (ROOT0) — sole CreatorLock holder 🤛🏻",
            }
          : {
              creator_lock: "Jason Lee Avery (ROOT0) — sole CreatorLock holder 🤛🏻",
            }),
      },
      { headers: accessHdrs }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ status: "ERROR", error: message, queried_at: now }, { status: 400 });
  }
}
