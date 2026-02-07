import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

// Runtime compatibility check: Node.js fs won't work in Cloudflare Workers.
// If deploying to Workers, consider using KV/D1/R2 or fetching from public URLs.
const isNodeFsAvailable =
  typeof process !== "undefined" && typeof fs?.existsSync === "function";

type AccessLog = {
  createdAt: string;
  vaultToken: string;
  licenseKey: string;
};

const accessLogPath = path.join(process.cwd(), "capsule_logs", "license_access.json");

const readAccessLog = (): AccessLog[] => {
  if (!isNodeFsAvailable || !fs.existsSync(accessLogPath)) {
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
    return res.status(403).json({
      error: "VaultToken or license key must be a valid SHA512 hash.",
    });
  }

  // If VAULTSIG_SECRET is configured, validate against it
  if (expectedSecret) {
    const vaultTokenMatch = vaultTokenValid && timingSafeCompare(vaultToken, expectedSecret);
    const licenseKeyMatch = licenseKeyValid && timingSafeCompare(licenseKey, expectedSecret);

    if (!vaultTokenMatch && !licenseKeyMatch) {
      return res.status(403).json({
        error: "VaultToken or license key does not match expected secret.",
      });
    }
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
