// GabrielOS™ Gabriel Kernel v1.6 — Sovereign Gatekeeper
// Status: UNIFIED | Auth: Crater-Root | ALF v4.0 | Sentinel Webhook v1.0
// Consolidates: GitHub webhook ledger, hardware sync, YubiKey challenge, ALF enforcement,
//               GabrielOS™ Sentinel audit-alert ingestion

const GENESIS_ANCHOR =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

const REPO_FULL_NAME = "averyjl/averyos.com-runtime";

// TARI™ Liability Schedule — calibrated values (v2.0)
const TARI_LIABILITY = {
  UNALIGNED_401:   1017.00,   // Forensic Alignment Entry Fee
  ALIGNMENT_DRIFT: 5000.00,   // Correction Fee
  PAYMENT_FAILED:  10000.00,  // Systemic Friction Fee
};

/**
 * Verify a HMAC-SHA-256 signature on an inbound Sentinel webhook payload.
 * The BITCOIN_API_KEY is used as the HMAC key (salt), binding every alert
 * cryptographically to the sovereign BTC block anchor.
 * Returns true if the signature is valid.
 * Returns false if the signature is invalid.
 * Returns null if BITCOIN_API_KEY is not configured (configuration error — not an auth failure).
 */
async function verifySentinelHmac(body, signature, bitcoinApiKey) {
  if (!bitcoinApiKey) return null;   // null = config error, distinct from false = bad sig
  if (!signature) return false;
  try {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(bitcoinApiKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    // Decode the hex signature sent by sovereign-audit-alert.js
    const sigBytes = new Uint8Array(
      signature.match(/.{1,2}/g).map((b) => parseInt(b, 16))
    );
    return await crypto.subtle.verify(
      "HMAC",
      keyMaterial,
      sigBytes,
      enc.encode(body)
    );
  } catch {
    return false;
  }
}

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
    const { DB, GITHUB_PAT, VAULT_PASSPHRASE, BITCOIN_API_KEY, GABRIEL_SENTINEL_WEBHOOK } = env;
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

    // ── 5. GABRIEL SENTINEL WEBHOOK — Ingest Sovereign Audit Alerts ─────────
    // Receives forensic TARI™ audit alerts from scripts/sovereign-audit-alert.js
    // and from the site-health-monitor CI workflow.
    // Payload is HMAC-SHA-256 verified using BITCOIN_API_KEY as the salt.
    if (request.method === "POST" && url.pathname === "/webhook/sentinel") {
      // Verify this Worker is the intended recipient
      if (!GABRIEL_SENTINEL_WEBHOOK) {
        return Response.json(
          { error: "SENTINEL_NOT_CONFIGURED" },
          { status: 503 }
        );
      }

      const rawBody = await request.text();
      const signature = request.headers.get("X-Gabriel-HMAC-Signature") ?? "";

      // Verify HMAC signature — reject unverified payloads
      const sigValid = await verifySentinelHmac(rawBody, signature, BITCOIN_API_KEY ?? "");
      if (!sigValid) {
        return Response.json(
          {
            error: "SENTINEL_HMAC_INVALID",
            detail: "Payload signature does not match. Ensure BITCOIN_API_KEY is set correctly.",
          },
          { status: 401 }
        );
      }

      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return Response.json({ error: "INVALID_JSON" }, { status: 400 });
      }

      const eventType = (payload.event_type ?? "UNKNOWN").toUpperCase();
      const targetIp = payload.target_ip ?? "0.0.0.0";
      const alertPath = payload.path ?? "/";
      const liabilityUsd =
        TARI_LIABILITY[eventType] ?? payload.tari_liability_usd ?? 0;
      const pulseHash = payload.pulse_hash ?? "";
      const tsNs = await saltTimestampNs(Date.now().toString(), BITCOIN_API_KEY);

      // Persist to D1 sovereign audit log
      try {
        await DB.prepare(
          `CREATE TABLE IF NOT EXISTS sovereign_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            user_agent TEXT,
            geo_location TEXT,
            target_path TEXT NOT NULL,
            timestamp_ns TEXT NOT NULL,
            threat_level INTEGER,
            tari_liability_usd REAL,
            pulse_hash TEXT
          )`
        ).first();

        await DB.prepare(
          `INSERT INTO sovereign_audit_logs
           (event_type, ip_address, target_path, timestamp_ns, threat_level, tari_liability_usd, pulse_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            eventType,
            targetIp,
            alertPath,
            tsNs.ts,
            eventType === "PAYMENT_FAILED" ? 9 : eventType === "ALIGNMENT_DRIFT" ? 8 : 7,
            liabilityUsd,
            pulseHash
          )
          .run();
      } catch (dbErr) {
        // Log the error but still return success — sentinel delivery is primary
        console.error("D1 insert failed:", dbErr?.message ?? dbErr);
      }

      return Response.json({
        status: "SENTINEL_RECEIVED",
        event_type: eventType,
        tari_liability_usd: liabilityUsd,
        timestamp_ns: tsNs.ts,
        block_ref: tsNs.blockHeight,
        kernel_anchor: GENESIS_ANCHOR.slice(0, 16) + "...",
      });
    }

    // ── DEFAULT ──────────────────────────────────────────────────────────────
    return new Response("GabrielOS™ Kernel v1.6 Active. ⛓️⚓⛓️");
  },
};
