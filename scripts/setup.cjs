#!/usr/bin/env node
/**
 * AveryOS™ Installation Bootstrap — scripts/setup.cjs
 *
 * Run once after `npm install` (or any time) to generate the private local
 * files that the sovereign runtime requires.  All generated files are
 * gitignored and must NEVER be committed.
 *
 *  Generated files
 *  ───────────────
 *  .anchor-salt          — 64-byte cryptographic random anchor salt (hex)
 *  .sovereign-nodes.json — node-specific hardware registry
 *  .avery-sync.json      — Sovereign Sync Manifest (Cloudflare ↔ Firebase handshake)
 *  .sovereign-lock       — first-run completion marker (written last)
 *  .env.local            — local env vars scaffold (only if missing)
 *
 *  If any file already exists it is LEFT INTACT unless --force is passed.
 *
 * Usage
 * ─────
 *  npm run setup              # first-run setup
 *  npm run setup -- --force   # regenerate every file (new salt, new lock)
 *  npm run setup -- --verify  # verify existing files without regenerating
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs    = require("fs");
const path  = require("path");
const os    = require("os");
const crypto = require("crypto");

// ── Paths (all relative to repo root, cross-platform) ────────────────────────

const ROOT               = process.cwd();
const ANCHOR_SALT_PATH   = path.join(ROOT, ".anchor-salt");
const NODES_PATH         = path.join(ROOT, ".sovereign-nodes.json");
const SYNC_MANIFEST_PATH = path.join(ROOT, ".avery-sync.json");
const SOVEREIGN_LOCK_PATH= path.join(ROOT, ".sovereign-lock");
const ENV_LOCAL_PATH     = path.join(ROOT, ".env.local");
const ENV_EXAMPLE_PATH   = path.join(ROOT, ".env.example");

// ── Canonical kernel constants (inline — no TypeScript transpiler at install time) ──

const KERNEL_SHA =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const KERNEL_VERSION     = "v3.6.2";
const GOLDEN_LOCK_MERKLE_ROOT =
  "88b737926219feb345804a22db4ae3fb2d5b21ca63686075ee04aace4d8ac4fe180289fe821a412944420ec9083b6a6a0e902fc8ac2e0325511cb7ab99ce2abe";
const GOLDEN_LOCK_ARTIFACT_ID = "AveryOS_Golden_Lock_ColdStorage_2026-02-22";
const SKC_VERSION        = "SKC-2026.1";
const CLOUDFLARE_ACCOUNT = "374875d33ef47a741a129bd5e716abff";
const WORKER_NAME        = "averyoscom-runtime";

// ── CLI flags ─────────────────────────────────────────────────────────────────

const ARGS   = process.argv.slice(2);
const FORCE  = ARGS.includes("--force");
const VERIFY = ARGS.includes("--verify");

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(icon, msg)  { console.log(`${icon}  ${msg}`); }
function ok(msg)         { log("✅", msg); }
function skip(msg)       { log("⏭️ ", msg); }
function warn(msg)       { log("⚠️ ", msg); }
function fail(msg)       { log("❌", msg); process.exit(1); }
function step(msg)       { console.log(`\n⛓️  ${msg}`); }

/** ISO-9 timestamp (nine-digit microsecond precision, UTC) */
function iso9() {
  const iso = new Date().toISOString();
  const [left, right] = iso.split(".");
  const ms  = (right || "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${ms}000000Z`;
}

/** Read a value from .env.local (best-effort; returns "" if missing) */
function readEnvLocal(key) {
  if (!fs.existsSync(ENV_LOCAL_PATH)) return "";
  const lines = fs.readFileSync(ENV_LOCAL_PATH, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const k  = trimmed.slice(0, eq).trim();
    const v  = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (k === key) return v;
  }
  return "";
}

// ── Step 1: .env.local scaffold ───────────────────────────────────────────────

function setupEnvLocal() {
  step("1 / 5 — Environment variables (.env.local)");

  if (fs.existsSync(ENV_LOCAL_PATH) && !FORCE) {
    skip(".env.local already exists — skipping scaffold (use --force to overwrite)");
    return;
  }

  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    warn(".env.example not found — cannot scaffold .env.local");
    return;
  }

  const example = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");
  fs.writeFileSync(ENV_LOCAL_PATH, example, "utf8");
  ok(".env.local created from .env.example");
  warn("ACTION REQUIRED: Open .env.local and replace all placeholder values with real keys.");
}

// ── Step 2: .anchor-salt ──────────────────────────────────────────────────────

function setupAnchorSalt() {
  step("2 / 5 — Anchor salt (.anchor-salt)");

  if (fs.existsSync(ANCHOR_SALT_PATH) && !FORCE) {
    skip(".anchor-salt already exists — skipping generation");
    return;
  }

  // 64 bytes = 512 bits of entropy — matches the SHA-512 kernel anchor size
  const salt = crypto.randomBytes(64).toString("hex");
  fs.writeFileSync(ANCHOR_SALT_PATH, salt, { encoding: "utf8", mode: 0o600 });
  // Best-effort chmod — silently ignored on Windows (POSIX only)
  try { fs.chmodSync(ANCHOR_SALT_PATH, 0o600); } catch { /* Windows: restrict manually via File Explorer → Security */ }
  ok(".anchor-salt generated (64-byte random, 512-bit entropy)");
  warn("Keep .anchor-salt private. Store a backup in 1Password or an encrypted vault.");
}

// ── Step 3: .sovereign-nodes.json ─────────────────────────────────────────────

function setupSovereignNodes() {
  step("3 / 5 — Sovereign node registry (.sovereign-nodes.json)");

  if (fs.existsSync(NODES_PATH) && !FORCE) {
    skip(".sovereign-nodes.json already exists — skipping generation");
    return;
  }

  // Read machine identity from environment or derive from hardware
  const node01Id = readEnvLocal("NODE_01_ID") || process.env.NODE_01_ID || "NODE_01_UNSET";
  const node02Id = readEnvLocal("NODE_02_ID") || process.env.NODE_02_ID
    || `NODE_02_${os.hostname().toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

  const localModel  = readEnvLocal("NODE_02_LOCAL_MODEL") || process.env.NODE_02_LOCAL_MODEL || "llama3.3:70b";
  const ollamaUrl   = readEnvLocal("NODE_02_OLLAMA_URL")  || process.env.NODE_02_OLLAMA_URL  || "http://localhost:11434";
  const anchorSalt  = readEnvLocal("SOVEREIGN_ANCHOR_SALT") || process.env.SOVEREIGN_ANCHOR_SALT || "(set SOVEREIGN_ANCHOR_SALT in .env.local)";

  // Derive a hardware fingerprint for this node (non-secret, just identification)
  const hardwareFingerprint = crypto
    .createHash("sha256")
    .update(`${os.hostname()}|${os.platform()}|${os.arch()}|${KERNEL_SHA}`)
    .digest("hex")
    .slice(0, 32);

  const nodes = {
    schema_version: "1.0.0",
    generated_at: iso9(),
    creator_lock: "Jason Lee Avery (ROOT0) 🤛🏻",
    kernel_sha: KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    node_01: {
      node_id: node01Id,
      label: "Phone Node (NODE_01) — Mobile sovereign node",
      type: "mobile",
      kernel_aligned: node01Id !== "NODE_01_UNSET",
    },
    node_02: {
      node_id: node02Id,
      label: "PC Node (NODE_02) — Primary workstation, Llama via Ollama",
      type: "workstation",
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      hardware_fingerprint: hardwareFingerprint,
      local_model: localModel,
      ollama_url: ollamaUrl,
      kernel_aligned: true,
    },
    anchor_salt_configured: anchorSalt !== "(set SOVEREIGN_ANCHOR_SALT in .env.local)",
    note: "This file is private and gitignored. It is used by auth.cjs and watchdog.cjs for sovereign authentication.",
  };

  fs.writeFileSync(NODES_PATH, JSON.stringify(nodes, null, 2), { encoding: "utf8", mode: 0o600 });
  ok(`.sovereign-nodes.json generated (NODE_02: ${node02Id})`);
}

// ── Step 4: .avery-sync.json (Sovereign Sync Manifest) ───────────────────────

async function setupAverySyncManifest() {
  step("4 / 5 — Sovereign Sync Manifest (.avery-sync.json)");

  if (fs.existsSync(SYNC_MANIFEST_PATH) && !FORCE) {
    skip(".avery-sync.json already exists — skipping generation");
    return;
  }

  const firebaseProjectId = readEnvLocal("FIREBASE_PROJECT_ID")
    || process.env.FIREBASE_PROJECT_ID
    || "(set FIREBASE_PROJECT_ID in .env.local)";

  const blockchainApiKey = readEnvLocal("BLOCKCHAIN_API_KEY")
    || process.env.BLOCKCHAIN_API_KEY
    || "";

  // Try to fetch the current BTC block height (best-effort — non-blocking)
  let btcAnchorBlock = "PENDING";
  let btcAnchorHash  = "PENDING";
  if (blockchainApiKey) {
    try {
      // Node 24 ships with native fetch
      const res = await fetch("https://api.blockcypher.com/v1/btc/main", {
        headers: { Authorization: `Bearer ${blockchainApiKey}` },
        signal: AbortSignal.timeout(5000), // Node.js ≥ 22 required
      });
      if (res.ok) {
        const data = await res.json();
        btcAnchorBlock = data.height  ?? "FETCH_FAILED";
        btcAnchorHash  = data.hash    ?? "FETCH_FAILED";
        ok(`BTC anchor: block ${btcAnchorBlock} — ${String(btcAnchorHash).slice(0, 16)}...`);
      }
    } catch {
      warn("BTC API unavailable — btc_anchor_block set to PENDING. Update manually.");
    }
  } else {
    warn("BLOCKCHAIN_API_KEY not set — btc_anchor_block set to PENDING. Set in .env.local to auto-populate.");
  }

  const now = iso9();

  const manifest = {
    schema_version: "1.0.0",
    manifest_id: "averyos-sovereign-sync-v1",
    creator_lock: "Jason Lee Avery (ROOT0) 🤛🏻",
    kernel_sha: KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    merkle_root: GOLDEN_LOCK_MERKLE_ROOT,
    btc_anchor_block: btcAnchorBlock,
    btc_anchor_hash: btcAnchorHash,
    btc_anchored_at: now,
    firebase_project_id: firebaseProjectId,
    firebase_collection_root: "averyos-resonance",
    cloudflare_worker_name: WORKER_NAME,
    cloudflare_account_id: CLOUDFLARE_ACCOUNT,
    sync_mode: "BIDIRECTIONAL",
    alignment_status: "ALIGNED",
    drift_protection: "ABSOLUTE",
    last_sync_at: now,
    skc_version: SKC_VERSION,
    lock_artifact_id: GOLDEN_LOCK_ARTIFACT_ID,
    note: "This file is private and gitignored. Read by GabrielOS™ Workers and Firebase Cloud Functions. Never commit.",
  };

  fs.writeFileSync(SYNC_MANIFEST_PATH, JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 0o600 });
  ok(".avery-sync.json generated (Sovereign Sync Manifest)");
  log("ℹ️ ", `Firebase project: ${firebaseProjectId}`);
  log("ℹ️ ", `Sync mode: ${manifest.sync_mode} | Alignment: ${manifest.alignment_status}`);
}

// ── Step 5: .sovereign-lock ───────────────────────────────────────────────────

function setupSovereignLock() {
  step("5 / 5 — Sovereign lock (.sovereign-lock)");

  if (fs.existsSync(SOVEREIGN_LOCK_PATH) && !FORCE) {
    // Refresh timestamp to mark this run
    const existing = JSON.parse(fs.readFileSync(SOVEREIGN_LOCK_PATH, "utf8"));
    existing.last_setup_at = iso9();
    existing.kernel_sha    = KERNEL_SHA;
    fs.writeFileSync(SOVEREIGN_LOCK_PATH, JSON.stringify(existing, null, 2), { encoding: "utf8", mode: 0o600 });
    ok(".sovereign-lock refreshed (timestamp updated)");
    return;
  }

  const lock = {
    locked: true,
    setup_version: "1.0.0",
    node: `${os.hostname()} (${os.platform()}/${os.arch()})`,
    hardware: `${os.hostname()}:${os.platform()}:${os.arch()}`,
    kernel_sha: KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    anchor_salt_present: fs.existsSync(ANCHOR_SALT_PATH),
    nodes_present: fs.existsSync(NODES_PATH),
    sync_manifest_present: fs.existsSync(SYNC_MANIFEST_PATH),
    first_setup_at: iso9(),
    last_setup_at: iso9(),
    creator_lock: "Jason Lee Avery (ROOT0) 🤛🏻",
  };

  fs.writeFileSync(SOVEREIGN_LOCK_PATH, JSON.stringify(lock, null, 2), { encoding: "utf8", mode: 0o600 });
  ok(".sovereign-lock written — sovereign environment initialized");
}

// ── Verification mode ─────────────────────────────────────────────────────────

function verify() {
  step("Verifying sovereign installation files");
  const files = [
    { path: ANCHOR_SALT_PATH,    label: ".anchor-salt",           required: true },
    { path: NODES_PATH,          label: ".sovereign-nodes.json",  required: true },
    { path: SYNC_MANIFEST_PATH,  label: ".avery-sync.json",       required: true },
    { path: SOVEREIGN_LOCK_PATH, label: ".sovereign-lock",        required: true },
    { path: ENV_LOCAL_PATH,      label: ".env.local",             required: true },
  ];

  let allGood = true;
  for (const { path: p, label, required } of files) {
    if (fs.existsSync(p)) {
      ok(`${label} present`);
      // Spot-check .sovereign-lock kernel alignment
      if (p === SOVEREIGN_LOCK_PATH) {
        try {
          const lock = JSON.parse(fs.readFileSync(p, "utf8"));
          if (lock.kernel_sha !== KERNEL_SHA) {
            warn(`${label} kernel_sha MISMATCH — run 'npm run setup -- --force' to re-anchor`);
            allGood = false;
          } else {
            ok(`${label} kernel SHA aligned ✓`);
          }
        } catch { warn(`${label} could not be parsed`); }
      }
      // Spot-check .avery-sync.json kernel alignment
      if (p === SYNC_MANIFEST_PATH) {
        try {
          const manifest = JSON.parse(fs.readFileSync(p, "utf8"));
          if (manifest.kernel_sha !== KERNEL_SHA) {
            warn(`${label} kernel_sha MISMATCH — re-run setup to re-anchor`);
            allGood = false;
          } else {
            ok(`${label} kernel SHA aligned ✓`);
          }
        } catch { warn(`${label} could not be parsed`); }
      }
    } else {
      if (required) {
        warn(`${label} MISSING — run 'npm run setup'`);
        allGood = false;
      }
    }
  }

  console.log("");
  if (allGood) {
    ok("All sovereign installation files present and kernel-aligned. ⛓️⚓⛓️");
  } else {
    warn("Some files are missing or misaligned. Run 'npm run setup' to resolve.");
    process.exit(1);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("⛓️⚓⛓️  AveryOS™ Installation Bootstrap");
  console.log(`         Kernel ${KERNEL_VERSION} | Root0 SHA: ${KERNEL_SHA.slice(0, 16)}...`);
  console.log(`         Node.js ${process.version} | ${os.platform()} ${os.arch()}`);
  if (FORCE)  console.log("         ⚠️  --force: all private files will be regenerated");
  if (VERIFY) console.log("         🔍 --verify: checking existing installation");
  console.log("");

  if (VERIFY) {
    verify();
    return;
  }

  setupEnvLocal();
  setupAnchorSalt();
  setupSovereignNodes();
  await setupAverySyncManifest();
  setupSovereignLock();

  console.log("");
  console.log("✅ AveryOS™ sovereign installation complete. ⛓️⚓⛓️ 🤛🏻");
  console.log("");
  console.log("   Next steps:");
  console.log("   1. Open .env.local and fill in all placeholder values");
  console.log("   2. If BLOCKCHAIN_API_KEY was missing, re-run setup to populate btc_anchor_block");
  console.log("   3. Run 'npm run setup -- --verify' to confirm all files are kernel-aligned");
  console.log("   4. Run 'npm run dev' to start the sovereign dev server");
  console.log("");
}

main().catch((err) => {
  console.error("❌ AveryOS™ setup error:", err.message ?? err);
  process.exit(1);
});
