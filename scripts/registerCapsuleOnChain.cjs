#!/usr/bin/env node
/**
 * scripts/registerCapsuleOnChain.cjs
 *
 * AveryOS™ On-Chain Capsule Registration — Phase 116 GATE 116.1
 *
 * Broadcasts a Bitcoin OP_RETURN transaction anchoring a capsule hash to the
 * public ledger.  The payload is a compact fingerprint:
 *
 *   OP_RETURN <AVERYOS_PREFIX (4 bytes)> <SHA-512 truncated to 24 bytes> <IPFS CID (variable)>
 *
 * Privacy (GATE 116.1 — On-Chain Stealth Proxy):
 *   The broadcast API call is routed through a SOCKS5 proxy when
 *   BITCOIN_SOCKS5_PROXY is set (format: socks5://host:port or host:port).
 *   This prevents the Node-02 IP address from being exposed to public
 *   ledger aggregators (Blockstream Esplora, BlockCypher, etc.).
 *
 * When BITCOIN_SOCKS5_PROXY is NOT set the script falls back to a direct
 * HTTPS call — suitable for CI/local dry-runs where privacy is not required.
 *
 * Usage:
 *   node scripts/registerCapsuleOnChain.cjs --hash <sha512hex> [options]
 *
 * Options:
 *   --hash <hex>         Full 128-char SHA-512 hex of the capsule to register.
 *   --cid  <cid>         IPFS CID of the capsule content (optional).
 *   --dry-run            Print the OP_RETURN payload without broadcasting.
 *   --api  <url>         Esplora-compatible broadcast URL
 *                        (default: https://blockstream.info/api/tx).
 *   --proxy <socks5>     SOCKS5 proxy URL override (overrides env var).
 *
 * Environment variables:
 *   BITCOIN_SOCKS5_PROXY   SOCKS5 proxy URL (e.g. socks5://127.0.0.1:9050).
 *   BITCOIN_RAW_TX         Pre-signed raw hex transaction to broadcast.
 *                          When provided, --hash / --cid are ignored (the
 *                          signed TX is used directly).
 *   BITCOIN_API_KEY        Optional API key forwarded as X-Api-Key header.
 *
 * Exit codes:
 *   0 — Broadcast succeeded (or dry-run completed)
 *   1 — Broadcast failed
 *   2 — Usage / validation error
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const https = require("https");
const http  = require("http");
const net   = require("net");
const tls   = require("tls");
const { logAosError, logAosHeal, AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ── Sovereign kernel anchor ────────────────────────────────────────────────────
const KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const KERNEL_VERSION = "v3.6.2";

// ── ANSI colours ───────────────────────────────────────────────────────────────
const R    = "\x1b[0m";
const RED  = "\x1b[31m";
const GRN  = "\x1b[32m";
const YEL  = "\x1b[33m";
const CYN  = "\x1b[36m";
const BOLD = "\x1b[1m";

// ── OP_RETURN prefix: 4-byte ASCII "AVOS" ────────────────────────────────────
const AOS_OP_PREFIX = "41564f53"; // hex: A V O S

// ── CLI parsing ────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? (args[idx + 1] ?? null) : null;
}

const capsuleHashArg = getArg("--hash");
const ipfsCidArg     = getArg("--cid")  ?? "";
const apiUrlArg      = getArg("--api")  ?? "https://blockstream.info/api/tx";
const proxyArg       = getArg("--proxy") ?? process.env.BITCOIN_SOCKS5_PROXY ?? null;
const rawTx          = process.env.BITCOIN_RAW_TX ?? null;
const apiKey         = process.env.BITCOIN_API_KEY ?? null;

// ── Validation ─────────────────────────────────────────────────────────────────

if (!rawTx && (!capsuleHashArg || !/^[0-9a-f]{128}$/i.test(capsuleHashArg))) {
  console.error(`${RED}ERROR: --hash must be a 128-char hex SHA-512 digest (or set BITCOIN_RAW_TX).${R}`);
  process.exit(2);
}

// ── Build OP_RETURN payload ────────────────────────────────────────────────────

/**
 * Build a compact OP_RETURN payload hex string:
 *   AOS_OP_PREFIX (4 bytes) + SHA-512 truncated to 24 bytes (48 hex chars) + CID hex
 *
 * Total payload is capped at 80 bytes (160 hex chars) per Bitcoin protocol limit.
 */
function buildOpReturnPayload(sha512hex, cid) {
  // Truncate SHA-512 to 24 bytes (48 hex chars) for space efficiency
  const hashBytes = sha512hex.slice(0, 48).toLowerCase();
  // Encode CID as hex (UTF-8), capped to keep total ≤ 80 bytes
  const cidHex    = Buffer.from(cid.slice(0, 40), "utf8").toString("hex");
  const raw       = AOS_OP_PREFIX + hashBytes + cidHex;
  // Enforce 80-byte (160 hex char) cap
  return raw.slice(0, 160);
}

// ── SOCKS5 proxy support ───────────────────────────────────────────────────────

/**
 * Parse a SOCKS5 proxy URL.
 * Accepts:
 *   socks5://host:port
 *   socks5h://host:port
 *   host:port           (assumed SOCKS5)
 *
 * @param {string} proxyStr
 * @returns {{ host: string, port: number } | null}
 */
function parseSocks5(proxyStr) {
  try {
    let str = proxyStr.trim();
    str = str.replace(/^socks5h?:\/\//i, "");
    const [host, portStr] = str.split(":");
    const port = parseInt(portStr ?? "1080", 10);
    if (!host || isNaN(port) || port < 1 || port > 65535) return null;
    return { host, port };
  } catch {
    return null;
  }
}

/**
 * Create an HTTPS agent that tunnels through a SOCKS5 proxy.
 *
 * Implementation: opens a raw TCP connection to the SOCKS5 proxy, performs the
 * SOCKS5 handshake, then wraps the socket with TLS for the target HTTPS host.
 *
 * Supports unauthenticated SOCKS5 only (version 5, no-auth method 0x00).
 *
 * @param {{ host: string, port: number }} proxy
 * @param {string} targetHost
 * @param {number} targetPort
 * @returns {Promise<https.Agent>}
 */
function createSocks5Agent(proxy, targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxy.port, proxy.host, () => {
      // ── SOCKS5 greeting: version=5, 1 method, method=0x00 (no-auth) ──
      socket.write(Buffer.from([0x05, 0x01, 0x00]));
    });

    socket.once("data", (greeting) => {
      // Server responds: [0x05, 0x00] = accepted no-auth
      if (greeting[0] !== 0x05 || greeting[1] !== 0x00) {
        socket.destroy();
        reject(new Error(`SOCKS5 server rejected no-auth method (response: ${greeting.toString("hex")})`));
        return;
      }

      // ── SOCKS5 CONNECT request ────────────────────────────────────────
      // [VER=5, CMD=1 (CONNECT), RSV=0, ATYP=3 (domain), domain_len, domain, port_hi, port_lo]
      const hostBuf  = Buffer.from(targetHost, "ascii");
      const portBuf  = Buffer.alloc(2);
      portBuf.writeUInt16BE(targetPort, 0);
      const connect = Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
        hostBuf,
        portBuf,
      ]);
      socket.write(connect);

      socket.once("data", (response) => {
        // Response: [VER, REP, RSV, ATYP, ...]
        if (response[1] !== 0x00) {
          socket.destroy();
          reject(new Error(`SOCKS5 CONNECT failed with reply code: 0x${response[1].toString(16)}`));
          return;
        }

        // Tunnel established — wrap with TLS
        const tlsSocket = tls.connect({
          socket,
          servername: targetHost,
          rejectUnauthorized: true,
        });

        tlsSocket.once("secureConnect", () => {
          const agent = new https.Agent({ keepAlive: false });
          // Monkey-patch createConnection to return our already-established socket
          agent.createConnection = () => tlsSocket;
          resolve(agent);
        });

        tlsSocket.once("error", reject);
      });
    });

    socket.once("error", reject);
    socket.setTimeout(10_000, () => {
      socket.destroy();
      reject(new Error("SOCKS5 connection timed out"));
    });
  });
}

// ── HTTP broadcast ─────────────────────────────────────────────────────────────

/**
 * POST rawTxHex to an Esplora-compatible broadcast endpoint.
 *
 * @param {string} txHex
 * @param {string} apiUrl
 * @param {https.Agent | null} agent
 * @returns {Promise<{ txid: string }>}
 */
function broadcastTransaction(txHex, apiUrl, agent) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(apiUrl);
    const isHttps   = parsedUrl.protocol === "https:";
    const lib       = isHttps ? https : http;

    const headers = {
      "Content-Type":   "text/plain",
      "Content-Length": Buffer.byteLength(txHex),
      "User-Agent":     `AveryOS/${KERNEL_VERSION} registerCapsuleOnChain`,
    };
    if (apiKey) headers["X-Api-Key"] = apiKey;

    const options = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isHttps ? 443 : 80),
      path:     parsedUrl.pathname,
      method:   "POST",
      headers,
      timeout:  30_000,
    };
    if (agent && isHttps) options.agent = agent;

    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end",  () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ txid: body.trim() });
        } else {
          reject(new Error(`Broadcast failed: HTTP ${res.statusCode} — ${body.slice(0, 200)}`));
        }
      });
    });

    req.on("error",   (err) => reject(err));
    req.on("timeout", ()    => { req.destroy(); reject(new Error("Broadcast request timed out")); });

    req.write(txHex);
    req.end();
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${BOLD}⛓️⚓⛓️  AveryOS™ On-Chain Capsule Registration — GATE 116.1${R}`);
  console.log(`Kernel: ${CYN}${KERNEL_VERSION}${R}  |  Anchor: ${CYN}${KERNEL_SHA.slice(0, 24)}…${R}`);

  // ── Determine payload ────────────────────────────────────────────────────────
  const txHex = rawTx ?? (() => {
    const opReturn = buildOpReturnPayload(capsuleHashArg, ipfsCidArg);
    console.log(`${YEL}OP_RETURN payload (hex):${R} ${opReturn}`);
    // NOTE: A real broadcast requires a fully-signed Bitcoin transaction.
    // The OP_RETURN payload above is the data embedding only.  To broadcast,
    // set BITCOIN_RAW_TX to a signed raw transaction that includes this payload.
    console.log(`${YEL}NOTE:${R} Set BITCOIN_RAW_TX to a signed raw transaction to broadcast.`);
    return null;
  })();

  // ── Dry-run ───────────────────────────────────────────────────────────────────
  if (DRY_RUN) {
    const opReturn = buildOpReturnPayload(capsuleHashArg ?? "0".repeat(128), ipfsCidArg);
    console.log(`\n${CYN}[DRY-RUN]${R} OP_RETURN payload: ${opReturn}`);
    console.log(`[DRY-RUN] Broadcast URL: ${apiUrlArg}`);
    console.log(`[DRY-RUN] SOCKS5 proxy: ${proxyArg ?? "(none — direct connection)"}`);
    console.log(`${GRN}Dry-run complete — no broadcast performed.${R}`);
    process.exit(0);
  }

  if (!txHex) {
    console.error(`${RED}ERROR: BITCOIN_RAW_TX is required to broadcast.  Use --dry-run to inspect the payload.${R}`);
    process.exit(2);
  }

  // ── Resolve SOCKS5 agent (GATE 116.1 — Stealth Proxy) ────────────────────────
  let agent = null;
  if (proxyArg) {
    const proxy = parseSocks5(proxyArg);
    if (!proxy) {
      console.error(`${RED}ERROR: Invalid SOCKS5 proxy format '${proxyArg}'.  Expected socks5://host:port${R}`);
      process.exit(2);
    }
    console.log(`${CYN}🔒 Routing broadcast via SOCKS5 proxy ${proxy.host}:${proxy.port} (Node-02 IP stealth)${R}`);
    try {
      const broadcastUrl = new URL(apiUrlArg);
      const targetPort   = broadcastUrl.port ? parseInt(broadcastUrl.port, 10) : 443;
      agent = await createSocks5Agent(proxy, broadcastUrl.hostname, targetPort);
      console.log(`${GRN}✅ SOCKS5 tunnel established${R}`);
    } catch (err) {
      logAosError(AOS_ERROR.NETWORK_ERROR, `SOCKS5 tunnel failed: ${err.message}`);
      console.error(`${RED}ERROR: SOCKS5 tunnel failed — ${err.message}${R}`);
      process.exit(1);
    }
  } else {
    console.log(`${YEL}⚠️  No SOCKS5 proxy configured — broadcasting directly (IP may be visible to ledger aggregators).${R}`);
    console.log(`   Set BITCOIN_SOCKS5_PROXY=socks5://host:port for stealth mode.`);
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────────
  console.log(`\nBroadcasting to ${apiUrlArg} …`);
  try {
    const result = await broadcastTransaction(txHex, apiUrlArg, agent);
    logAosHeal(AOS_ERROR.BTC_ANCHOR_FAILED, `Capsule registered on-chain: txid=${result.txid}`);
    console.log(`\n${GRN}${BOLD}✅ Broadcast SUCCESS${R}`);
    console.log(`   txid: ${GRN}${result.txid}${R}`);
    console.log(`   Ledger: ${CYN}${apiUrlArg.replace("/api/tx", "")}/tx/${result.txid}${R}`);
  } catch (err) {
    logAosError(AOS_ERROR.NETWORK_ERROR, `On-chain broadcast failed: ${err.message}`);
    console.error(`\n${RED}${BOLD}✗ Broadcast FAILED:${R} ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  logAosError(AOS_ERROR.UNKNOWN_ERROR, `Unhandled error in registerCapsuleOnChain: ${err.message}`);
  console.error(err);
  process.exit(1);
});
