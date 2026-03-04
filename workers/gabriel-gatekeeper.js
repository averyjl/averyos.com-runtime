// GabrielOS™ Gabriel Kernel v1.5 — Sovereign Gatekeeper
// Status: UNIFIED | Auth: Crater-Root | ALF v4.0
// Consolidates: GitHub webhook ledger, hardware sync, YubiKey challenge, ALF enforcement

const GENESIS_ANCHOR =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

const REPO_FULL_NAME = "averyjl/averyos.com-runtime";

/**
 * Salt a nanosecond timestamp with the current Bitcoin block height and
 * return both the salted timestamp and the raw block height for use as a
 * "Block-Time Reference" in audit logs.
 * Uses Authorization header (not query param) to avoid key exposure in logs.
 * Returns the original timestamp and null height on any failure — salt is best-effort.
 */
async function saltTimestampNs(tsNs, blockchainApiKey) {
  if (!blockchainApiKey) return { ts: tsNs, blockHeight: null };
  try {
    const res = await fetch("https://api.blockcypher.com/v1/btc/main", {
      headers: { Authorization: `Bearer ${blockchainApiKey}` },
    });
    if (!res.ok) return { ts: tsNs, blockHeight: null };
    const data = await res.json();
    const height = data.height ?? 0;
    // XOR with block height; keep result as 9-digit string
    const salted = (BigInt(tsNs) ^ BigInt(height)) % BigInt(1_000_000_000);
    return { ts: String(salted).padStart(9, "0"), blockHeight: height };
  } catch {
    return { ts: tsNs, blockHeight: null };
  }
}

export default {
  async fetch(request, env) {
    const { DB, GITHUB_PAT, VAULT_PASSPHRASE, BITCOIN_API_KEY } = env;
    const url = new URL(request.url);

    // ── 1. GITHUB WEBHOOK — Commit Logging ──────────────────────────────────
    if (request.method === "POST" && url.pathname === "/webhook/github") {
      try {
        const payload = await request.json();
        if (payload.repository?.full_name !== REPO_FULL_NAME) {
          return new Response("USI_DETECTED", { status: 403 });
        }
        const tsNs = await saltTimestampNs(Date.now().toString(), BITCOIN_API_KEY);
        await DB.prepare(
          "INSERT INTO vaultchain_ledger (timestamp, event, sha, status) VALUES (?, ?, ?, ?)"
        )
          .bind(tsNs.ts, "GITHUB_COMMIT", payload.after, "SEALED")
          .run();
        return new Response("ANCHORED", { status: 200 });
      } catch (err) {
        return new Response(`WEBHOOK_ERROR: ${err.message}`, { status: 500 });
      }
    }

    // ── 2. HARDWARE PERSISTENCE SYNC — Ollama/YubiKey ───────────────────────
    if (request.method === "POST" && url.pathname === "/api/gatekeeper/sync") {
      const authHeader = request.headers.get("Authorization") ?? "";
      if (authHeader !== `Bearer ${GITHUB_PAT}`) {
        return new Response("USI_DETECTED", { status: 403 });
      }
      const tsNs = await saltTimestampNs(Date.now().toString(), BITCOIN_API_KEY);
      await DB.prepare(
        "INSERT INTO sync_logs (event_type, timestamp, kernel_anchor) VALUES (?, ?, ?)"
      )
        .bind("HARDWARE_PERSISTENCE_SYNC", tsNs.ts, GENESIS_ANCHOR)
        .run();
      return new Response("⛓️⚓⛓️ SYNC_LOCKED", { status: 200 });
    }

    // ── 3. YUBIKEY HARDWARE CHALLENGE — ALF v4.0 Sovereign Gate ─────────────
    if (
      request.method === "GET" &&
      url.pathname === "/api/gatekeeper/yubikey-challenge"
    ) {
      const challengeBytes = new Uint8Array(32);
      crypto.getRandomValues(challengeBytes);
      const base64 = btoa(String.fromCharCode(...challengeBytes));
      const base64url = base64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      return Response.json({
        challenge: base64url,
        timeout: 60000,
        rpId: "averyos.com",
        status: "ALF_V4_CHALLENGE_ISSUED",
      });
    }

    // ── 4. ALF v4.0 LICENSE VERIFICATION ────────────────────────────────────
    if (
      request.method === "POST" &&
      url.pathname === "/api/gatekeeper/alf-verify"
    ) {
      const authHeader = request.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";
      if (!VAULT_PASSPHRASE || token !== VAULT_PASSPHRASE) {
        return Response.json(
          { error: "ALF_ENFORCEMENT_ACTIVE", status: "SOVEREIGN_GATE_DENIED" },
          { status: 401 }
        );
      }

      // ── 4a. Non-Deterministic Scanner Identity Audit ─────────────────────
      // Detect known headless/bot User-Agents that attempt to bypass the badge
      // gate without a legitimate browser session. Flag and log but do not
      // block — sovereign evidence is collected for the Audit Stream.
      const userAgent = request.headers.get("User-Agent") ?? "";
      const NON_DETERMINISTIC_SCANNER_PATTERNS = [
        /python-requests/i,
        /curl\//i,
        /wget\//i,
        /go-http-client/i,
        /java\//i,
        /scrapy/i,
        /axios\//i,
        /node-fetch/i,
        /okhttp/i,
        /httpx/i,
        /libwww-perl/i,
      ];
      const isScanner = NON_DETERMINISTIC_SCANNER_PATTERNS.some((re) =>
        re.test(userAgent)
      );
      if (isScanner) {
        const tsNsScanner = await saltTimestampNs(
          Date.now().toString(),
          BITCOIN_API_KEY
        );
        // Best-effort audit log — do not block execution if the insert fails
        try {
          await DB.prepare(
            "INSERT INTO sync_logs (event_type, timestamp, kernel_anchor) VALUES (?, ?, ?)"
          )
            .bind(
              `NON_DETERMINISTIC_SCANNER_DETECTED:${userAgent.slice(0, 128)}`,
              tsNsScanner.ts,
              GENESIS_ANCHOR
            )
            .run();
        } catch {
          // Audit is best-effort; proceed regardless
        }
      }

      const tsNs = await saltTimestampNs(Date.now().toString(), BITCOIN_API_KEY);
      await DB.prepare(
        "INSERT INTO sync_logs (event_type, timestamp, kernel_anchor) VALUES (?, ?, ?)"
      )
        .bind("ALF_V4_LICENSE_VERIFY", tsNs.ts, GENESIS_ANCHOR)
        .run();
      return Response.json({
        status: "ALF_LICENSE_VALID",
        kernel_anchor: GENESIS_ANCHOR,
        timestamp_ns: tsNs.ts,
        block_ref: tsNs.blockHeight,
        scanner_flag: isScanner ? "NON_DETERMINISTIC_SCANNER_DETECTED" : null,
      });
    }

    // ── DEFAULT ──────────────────────────────────────────────────────────────
    return new Response("GabrielOS™ Kernel v1.5 Active. ⛓️⚓⛓️");
  },
};
