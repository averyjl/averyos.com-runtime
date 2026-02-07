import fs from "fs";
import path from "path";
import crypto from "crypto";
import { timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";
import { timingSafeEqual } from "crypto";

// NOTE: This API route uses Node.js filesystem APIs and is incompatible with
// Cloudflare Workers. For Workers deployment, migrate to:
// 1. Cloudflare D1 (SQL database) for persistent logs
// 2. Cloudflare KV for simple key-value storage
// 3. Or an external logging service

// NOTE: This API uses Node.js fs and will NOT work in Cloudflare Workers.
// For Workers/Edge deployment, replace file-based storage with:
// - Cloudflare KV for simple key-value storage
// - Cloudflare D1 for relational data
// - Cloudflare R2 for object storage
// - External API/database service (e.g., Supabase, PlanetScale)

// NOTE: This API route uses Node fs for persistence, which won't work on Cloudflare Workers.
// If deploying to Workers, replace with a durable backend:
// - Cloudflare KV, D1, or R2 for persistent storage
// - Or use an external logging/analytics service

// Runtime compatibility check: Node.js fs won't work in Cloudflare Workers.
// If deploying to Workers, consider using KV/D1/R2 or fetching from public URLs.
const isNodeFsAvailable =
  typeof process !== "undefined" && typeof fs?.existsSync === "function";

type AccessLog = {
  createdAt: string;
  vaultToken: string;
  licenseKey: string;
};

// NOTE: This handler uses Node `fs` to read/write capsule_logs/license_access.json.
// It will NOT work on Cloudflare Workers or edge runtimes. If deploying to Workers,
// replace filesystem operations with KV/D1/R2 or an external logging service.
const accessLogPath = path.join(process.cwd(), "capsule_logs", "license_access.json");

const readAccessLog = (): AccessLog[] => {
  if (!isNodeFsAvailable || !fs.existsSync(accessLogPath)) {
  // Check if fs is available (won't work in Cloudflare Workers)
  if (typeof process === "undefined" || !fs.existsSync) {
    console.warn("Filesystem not available - consider using KV/D1/R2 for Cloudflare Workers");
    return [];
  }
  // Check if we're in a Node.js environment
  if (typeof process === "undefined" || !fs.existsSync) {
    return [];
  }

  if (!fs.existsSync(accessLogPath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(accessLogPath, "utf8")) as AccessLog[];
};

/**
 * Constant-time comparison helper to prevent timing attacks.
 * Both strings must be valid SHA-512 hashes (128 hex chars).
 */
const timingSafeCompare = (a: string, b: string): boolean => {
  if (a.length !== 128 || b.length !== 128) {
// Constant-time string comparison to prevent timing attacks
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
const isTokenValid = (token: string | undefined): boolean => {
  if (!token || !verifyCapsuleHash(token)) {
    return false;
  }
  
  const expectedSecret = process.env.VAULTSIG_SECRET;
  if (!expectedSecret) {
    // If no secret is configured, reject access
    return false;
  }
  
  if (!verifyCapsuleHash(expectedSecret)) {
    // Expected secret must also be a valid SHA-512 hash
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(token, "utf8"),
      Buffer.from(expectedSecret, "utf8")
    );
/**
 * Constant-time string comparison to prevent timing attacks.
 */
const safeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isNodeFsAvailable) {
    return res.status(503).json({
      error: "Filesystem access not available in this runtime. Use KV/D1/R2 or a database.",
    });
  }

  const { vaultToken, licenseKey } = req.body ?? {};
  const expectedSecret = process.env.VAULTSIG_SECRET;

  // Validate format first
  const vaultTokenValid = verifyCapsuleHash(vaultToken);
  const licenseKeyValid = verifyCapsuleHash(licenseKey);

  if (!vaultTokenValid && !licenseKeyValid) {
  // Validate format first
  // Validate that at least one token is provided and properly formatted
  if (!isTokenValid(vaultToken) && !isTokenValid(licenseKey)) {
  // Validate format
  if (!verifyCapsuleHash(vaultToken) && !verifyCapsuleHash(licenseKey)) {
    return res.status(403).json({
      error: "Valid VaultToken or license key required.",
    });
  }

  // Validate against server-side secret if configured
  const expectedSecret = process.env.VAULTSIG_SECRET;
  if (expectedSecret) {
    const providedToken = vaultToken || licenseKey;
    // Use constant-time comparison to prevent timing attacks
    if (!providedToken || !timingSafeEqual(providedToken, expectedSecret)) {
  // Validate against server-side secret using constant-time comparison
  // NOTE: If VAULTSIG_SECRET is not configured, this endpoint will only validate format.
  // For production use, VAULTSIG_SECRET should always be set to properly gate access.
  const expectedSecret = process.env.VAULTSIG_SECRET;
  if (expectedSecret) {
    const tokenValid = typeof vaultToken === "string" && 
                       verifyCapsuleHash(vaultToken) && 
                       timingSafeEqual(vaultToken, expectedSecret);
    const licenseValid = typeof licenseKey === "string" && 
                         verifyCapsuleHash(licenseKey) && 
                         timingSafeEqual(licenseKey, expectedSecret);
    
    if (!tokenValid && !licenseValid) {
  const expectedSecret = process.env.VAULTSIG_SECRET;
  if (expectedSecret) {
    const tokenValid = vaultToken && verifyCapsuleHash(vaultToken) && safeCompare(vaultToken, expectedSecret);
    const keyValid = licenseKey && verifyCapsuleHash(licenseKey) && safeCompare(licenseKey, expectedSecret);
    
    if (!tokenValid && !keyValid) {
      return res.status(403).json({
        error: "Invalid VaultToken or license key.",
      });
    }
  }

  // Check if fs is available (won't work in Cloudflare Workers)
  if (typeof process === "undefined" || !fs.existsSync) {
    return res.status(501).json({
      error: "File system not available in this runtime. Use KV/D1/R2 for persistent storage.",
    });
  }

    console.warn("Filesystem not available - consider using KV/D1/R2 for Cloudflare Workers");
    return res.status(200).json({ ok: true });
  // Check against server-side secret using constant-time comparison
  const expectedSecret = process.env.VAULTSIG_SECRET;
  if (!expectedSecret) {
    return res.status(500).json({
      error: "Server configuration error: VAULTSIG_SECRET not set.",
    });
  }

  const providedToken = verifyCapsuleHash(vaultToken) ? vaultToken : licenseKey;

  // Constant-time comparison to prevent timing attacks
  let isValid = false;
  if (providedToken && providedToken.length === expectedSecret.length) {
    let mismatch = 0;
    for (let i = 0; i < expectedSecret.length; i++) {
      mismatch |= expectedSecret.charCodeAt(i) ^ providedToken.charCodeAt(i);
    }
    isValid = mismatch === 0;
  }

  if (!isValid) {
    return res.status(403).json({
      error: "Invalid VaultToken or license key.",
    });
  }

  // If VAULTSIG_SECRET is configured, validate against it
  if (expectedSecret) {
    const vaultTokenMatch = vaultTokenValid && timingSafeCompare(vaultToken, expectedSecret);
    const licenseKeyMatch = licenseKeyValid && timingSafeCompare(licenseKey, expectedSecret);

    if (!vaultTokenMatch && !licenseKeyMatch) {
      return res.status(403).json({
        error: "VaultToken or license key does not match expected secret.",
  // Compare against server-side secret to actually gate access
  const expectedSecret = process.env.VAULTSIG_SECRET;
  if (expectedSecret) {
    const providedToken = vaultToken || licenseKey;
    if (!providedToken || typeof providedToken !== "string") {
      return res.status(403).json({
        error: "Invalid token or license key.",
      });
    }
    
    // Use constant-time comparison to prevent timing attacks
    try {
      const expectedBuf = Buffer.from(expectedSecret, "utf8");
      const providedBuf = Buffer.from(providedToken, "utf8");
      
      // Ensure buffers are same length before comparison
      if (expectedBuf.length !== providedBuf.length) {
        return res.status(403).json({
          error: "Invalid token or license key.",
        });
      }
      
      const isValid = crypto.timingSafeEqual(expectedBuf, providedBuf);
      if (!isValid) {
        return res.status(403).json({
          error: "Invalid token or license key.",
        });
      }
    } catch {
      return res.status(403).json({
        error: "Invalid token or license key.",
      });
    }
  }

  const logs = readAccessLog();
  logs.push({
    createdAt: new Date().toISOString(),
    vaultToken: typeof vaultToken === "string" ? vaultToken : "",
    licenseKey: typeof licenseKey === "string" ? licenseKey : "",
  });

  // Only write if fs is available (Node.js environment)
  if (typeof process !== "undefined" && fs.mkdirSync) {
    fs.mkdirSync(path.dirname(accessLogPath), { recursive: true });
    fs.writeFileSync(accessLogPath, JSON.stringify(logs, null, 2));
  }

  return res.status(200).json({ ok: true });
};

export default handler;
