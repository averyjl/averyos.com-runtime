/**
 * AveryOS™ Sovereign Terminal — Local Uplink Client
 * ⛓️⚓⛓️
 *
 * A local Node.js CLI that bridges your physical environment (YubiKey/USB salt,
 * local Ollama AI) with the AveryOS VaultChain™ Sovereign Cloud (Cloudflare).
 *
 * Features:
 *   1. Ollama Bridge  — captures the latest Ollama prompt/response, hashes it,
 *      and POSTs it to the AveryOS anchor as a "Thought Log".
 *   2. Hardware Seal  — reads /mnt/avery-salt/anchor.key (or a path you specify),
 *      uses it to HMAC-sign a payload, proving physical presence.
 *   3. Release Approval — fetches Pending Builds from the Cloudflare anchor,
 *      lets you approve/reject, and pushes the hardware-signed seal back to
 *      lock (or skip) each build.
 *
 * Usage:
 *   npx ts-node uplink/sovereign-terminal.ts [command]
 *
 * Commands:
 *   ollama   Poll Ollama and anchor the latest thought
 *   seal     Interactively approve pending builds with hardware seal
 *   watch    Run both: anchor thoughts + process pending seals on a loop
 *
 * Environment variables:
 *   AVERYOS_ANCHOR_URL    Base URL of the AveryOS anchor (default: https://averyos.com)
 *   AVERYOS_ANCHOR_TOKEN  Bearer token for the /api/v1/anchor/* endpoints
 *   AVERY_SALT_PATH       Path to the USB salt file (default: /mnt/avery-salt/anchor.key)
 *   OLLAMA_URL            Ollama base URL (default: http://localhost:11434)
 *   OLLAMA_MODEL          Ollama model to query (default: llama3)
 *
 * Author: Jason Lee Avery (ROOT0) — AveryOS™ Sovereign Supply Chain
 */

import 'dotenv/config'; 
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as readline from 'readline';

// ⚓ Define __dirname for ESM Scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🤛🏻 Explicitly load the .env from the ROOT directory (one level up from /uplink)
config({ path: path.join(process.cwd(), '.env'), override: true });
// ─── Configuration ────────────────────────────────────────────────────────────

const ANCHOR_URL   = process.env.AVERYOS_ANCHOR_URL   ?? "";
const ANCHOR_TOKEN = process.env.AVERYOS_ANCHOR_TOKEN ?? "";
const SALT_PATH    = process.env.AVERY_SALT_PATH       ?? "";
const OLLAMA_URL   = process.env.OLLAMA_URL            ?? "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL          ?? "";

const POLL_INTERVAL_MS  = 30_000; // 30 s between Ollama polls
const SEAL_INTERVAL_MS  = 60_000; // 60 s between seal sweeps

// ─── Types ────────────────────────────────────────────────────────────────────

interface OllamaGenerateResponse {
  model: string;
  response: string;
  prompt?: string;
  done: boolean;
}

interface SovereignBuild {
  id: number;
  repo_name: string;
  commit_sha: string;
  artifact_hash: string;
  sealed: boolean;
  registered_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute SHA-512 hex of a string */
function sha512(input: string): string {
  return crypto.createHash("sha512").update(input, "utf8").digest("hex");
}

/** HMAC-SHA256 sign a message with the hardware salt key */
function hmacSign(salt: string, message: string): string {
  return crypto.createHmac("sha256", salt).update(message, "utf8").digest("hex");
}

/** Read the hardware salt from the USB path. Returns null if unavailable. */
function readHardwareSalt(): string | null {
  try {
    const key = fs.readFileSync(SALT_PATH, "utf8").trim();
    if (!key) {
      console.warn("[uplink] ⚠️  Salt file is empty:", SALT_PATH);
      return null;
    }
    return key;
  } catch {
    console.warn("[uplink] ⚠️  Cannot read salt file:", SALT_PATH);
    console.warn("[uplink]    Mount your USB and ensure the file exists.");
    return null;
  }
}

/**
 * Parse an Ollama response that may be either:
 *   a) A clean JSON object already (parsed by fetch → .json())
 *   b) A raw prose string that may embed a SHA-512 hex somewhere
 *
 * Returns a normalised { thought, thoughtHash } tuple.
 * The hash is either the first 128-char hex substring found in the prose
 * (typical when llama3 emits a thought that contains its own SHA), or a
 * fresh SHA-512 of the full thought text.
 */
function parseOllamaThought(rawResponse: string): { thought: string; thoughtHash: string } {
  const thought = rawResponse.trim();

  // Look for an embedded SHA-512 (128 lowercase hex chars) in the prose
  const sha512Pattern = /\b([0-9a-fA-F]{128})\b/;
  const match = thought.match(sha512Pattern);
  const embeddedHash = match?.[1]?.toLowerCase() ?? null;

  const thoughtHash = embeddedHash ?? sha512(thought);
  return { thought, thoughtHash };
}

/** POST JSON to an AveryOS anchor endpoint */
async function anchorPost(path: string, body: unknown): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ANCHOR_TOKEN) headers["Authorization"] = `Bearer ${ANCHOR_TOKEN}`;

  const res = await fetch(`${ANCHOR_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/** GET JSON from an AveryOS anchor endpoint */
async function anchorGet(path: string): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (ANCHOR_TOKEN) headers["Authorization"] = `Bearer ${ANCHOR_TOKEN}`;

  const res = await fetch(`${ANCHOR_URL}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/** Simple readline prompt */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── 1. Ollama Bridge ─────────────────────────────────────────────────────────

/**
 * Ping Ollama, generate a brief "status thought," hash it, and POST it to the
 * AveryOS anchor as a capsule.  The hash of the thought proves the specific
 * Ollama model output at this moment in time.
 */
async function anchorOllamaThought(): Promise<void> {
  console.log("[ollama] Querying Ollama model:", OLLAMA_MODEL);

  let rawResponse: string;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: "Summarise the current AveryOS sovereign state in one sentence.",
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn("[ollama] ⚠️  Ollama returned HTTP", res.status);
      return;
    }
    // Ollama /api/generate may return JSON OR, with certain models/configs,
    // a prose string.  We normalise both cases here.
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as OllamaGenerateResponse;
      rawResponse = json.response ?? "";
    } else {
      // Fallback: treat as plain text (handles non-standard Ollama wrappers)
      rawResponse = await res.text();
    }
  } catch (err) {
    console.warn("[ollama] ⚠️  Could not reach Ollama:", (err as Error).message);
    return;
  }

  if (!rawResponse) {
    console.warn("[ollama] ⚠️  Empty response from Ollama");
    return;
  }

  const { thought, thoughtHash } = parseOllamaThought(rawResponse);
  const timestamp = new Date().toISOString();

  console.log("[ollama] Thought:", thought.slice(0, 80) + (thought.length > 80 ? "…" : ""));
  console.log("[ollama] SHA-512:", thoughtHash.slice(0, 32) + "…");

  try {
    const result = await anchorPost("/api/v1/anchor", {
      data: {
        type:   "OLLAMA_THOUGHT_LOG",
        model:  OLLAMA_MODEL,
        thought,
        thought_hash: thoughtHash,
      },
      timestamp,
      metadata: { source: "sovereign-terminal", version: "1.0.0" },
    });
    console.log("[ollama] ✅ Thought anchored:", (result as { sha512?: string }).sha512?.slice(0, 24) ?? "OK");
  } catch (err) {
    console.error("[ollama] ❌ Failed to anchor thought:", (err as Error).message);
  }
}

// ─── 2. Hardware Seal ─────────────────────────────────────────────────────────

/**
 * Fetch pending (unsealed) builds from the anchor, present them to the user,
 * and apply a hardware HMAC signature to approve them.
 */
async function processPendingSeals(interactive: boolean): Promise<void> {
  const salt = readHardwareSalt();
  if (!salt) {
    console.warn("[seal] ⚠️  Hardware salt unavailable — skipping seal sweep");
    return;
  }

  let data: unknown;
  try {
    data = await anchorGet("/api/v1/sovereign-builds");
  } catch (err) {
    console.error("[seal] ❌ Cannot fetch builds:", (err as Error).message);
    return;
  }

  const allBuilds = ((data as { builds?: SovereignBuild[] }).builds ?? []) as SovereignBuild[];
  const pending   = allBuilds.filter((b) => !b.sealed);

  if (pending.length === 0) {
    console.log("[seal] ✅ No pending builds — all sealed");
    return;
  }

  console.log(`[seal] 📦 ${pending.length} pending build(s):`);
  for (const build of pending) {
    console.log(`\n  ID:           ${build.id}`);
    console.log(`  Repo:         ${build.repo_name}`);
    console.log(`  Commit:       ${build.commit_sha}`);
    console.log(`  Artifact:     ${build.artifact_hash.slice(0, 32)}…`);
    console.log(`  Registered:   ${build.registered_at}`);

    let approve = !interactive;

    if (interactive) {
      const answer = await prompt(`  → Approve and seal this build? [y/N] `);
      approve = answer.toLowerCase() === "y";
    }

    if (!approve) {
      console.log("  ⏭  Skipped.");
      continue;
    }

    // Sign: HMAC(salt, artifact_hash)
    const signature = hmacSign(salt, build.artifact_hash);
    console.log("  🔑 Hardware signature:", signature.slice(0, 32) + "…");

    try {
      const result = await anchorPost("/api/v1/anchor/seal", {
        artifact_hash:      build.artifact_hash,
        hardware_signature: signature,
      });
      const sealed = result as { status?: string; btc_anchor_height?: number };
      console.log(
        `  ✅ SEALED — BTC block ${sealed.btc_anchor_height ?? "??"}`
      );
    } catch (err) {
      console.error("  ❌ Seal failed:", (err as Error).message);
    }
  }
}

// ─── 3. Release Approval (interactive mode) ──────────────────────────────────

async function interactiveSeal(): Promise<void> {
  console.log("\n⛓️⚓⛓️  AveryOS™ Sovereign Terminal — Release Approval Mode\n");
  await processPendingSeals(true);
  console.log("\n[seal] Done.\n");
}

// ─── 4. Watch loop ───────────────────────────────────────────────────────────

async function watchLoop(): Promise<void> {
  console.log("\n⛓️⚓⛓️  AveryOS™ Sovereign Terminal — Watch Mode\n");
  console.log(`[watch] Ollama polling every ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[watch] Seal sweep every ${SEAL_INTERVAL_MS / 1000}s`);
  console.log("[watch] Press Ctrl+C to exit\n");

  // First run immediately
  await anchorOllamaThought();
  await processPendingSeals(false);

  const ollamaTimer = setInterval(() => void anchorOllamaThought(), POLL_INTERVAL_MS);
  const sealTimer   = setInterval(() => void processPendingSeals(false), SEAL_INTERVAL_MS);

  // Clean up on SIGINT
  process.on("SIGINT", () => {
    clearInterval(ollamaTimer);
    clearInterval(sealTimer);
    console.log("\n[watch] Shutdown complete. ⛓️⚓⛓️\n");
    process.exit(0);
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const command = process.argv[2] ?? "watch";

  switch (command) {
    case "ollama":
      await anchorOllamaThought();
      break;
    case "seal":
      await interactiveSeal();
      break;
    case "watch":
      await watchLoop();
      break;
    default:
      console.error(`[uplink] Unknown command: ${command}`);
      console.error("         Usage: ts-node uplink/sovereign-terminal.ts [ollama|seal|watch]");
      process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error("[uplink] Fatal:", err.message);
  process.exit(1);
});
