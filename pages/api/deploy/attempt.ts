import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

// NOTE: This API uses Node.js fs and will NOT work in Cloudflare Workers.
// For Workers/Edge deployment, replace file-based storage with:
// - Cloudflare KV for simple key-value storage
// - Cloudflare D1 for relational data
// - Cloudflare R2 for object storage
// - External API/database service (e.g., Supabase, PlanetScale)

type AccessLog = {
  createdAt: string;
  vaultToken: string;
  licenseKey: string;
};

const accessLogPath = path.join(process.cwd(), "capsule_logs", "license_access.json");

const readAccessLog = (): AccessLog[] => {
  // Check if we're in a Node.js environment
  if (typeof process === "undefined" || !fs.existsSync) {
    return [];
  }

  if (!fs.existsSync(accessLogPath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(accessLogPath, "utf8")) as AccessLog[];
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { vaultToken, licenseKey } = req.body ?? {};

  // Validate format
  if (!verifyCapsuleHash(vaultToken) && !verifyCapsuleHash(licenseKey)) {
    return res.status(403).json({
      error: "VaultToken or license key must be a valid SHA512 hash.",
    });
  }

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
