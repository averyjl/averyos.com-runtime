import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

type AccessLog = {
  createdAt: string;
  vaultToken: string;
  licenseKey: string;
};

const accessLogPath = path.join(process.cwd(), "capsule_logs", "license_access.json");

const readAccessLog = (): AccessLog[] => {
  // Check if fs is available (won't work in Cloudflare Workers)
  if (typeof process === "undefined" || !fs.existsSync) {
    console.warn("Filesystem not available - consider using KV/D1/R2 for Cloudflare Workers");
    return [];
  }
  if (!fs.existsSync(accessLogPath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(accessLogPath, "utf8")) as AccessLog[];
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
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
      return res.status(403).json({
        error: "Invalid VaultToken or license key.",
      });
    }
  }

  // Check if fs is available (won't work in Cloudflare Workers)
  if (typeof process === "undefined" || !fs.existsSync) {
    console.warn("Filesystem not available - consider using KV/D1/R2 for Cloudflare Workers");
    return res.status(200).json({ ok: true });
  }

  const logs = readAccessLog();
  logs.push({
    createdAt: new Date().toISOString(),
    vaultToken: typeof vaultToken === "string" ? vaultToken : "",
    licenseKey: typeof licenseKey === "string" ? licenseKey : "",
  });

  fs.mkdirSync(path.dirname(accessLogPath), { recursive: true });
  fs.writeFileSync(accessLogPath, JSON.stringify(logs, null, 2));

  return res.status(200).json({ ok: true });
};

export default handler;
