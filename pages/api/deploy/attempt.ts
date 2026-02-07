import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";
import { timingSafeEqual } from "crypto";

type AccessLog = {
  createdAt: string;
  vaultToken: string;
  licenseKey: string;
};

const accessLogPath = path.join(process.cwd(), "capsule_logs", "license_access.json");

const readAccessLog = (): AccessLog[] => {
  if (!fs.existsSync(accessLogPath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(accessLogPath, "utf8")) as AccessLog[];
};

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
  } catch {
    return false;
  }
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { vaultToken, licenseKey } = req.body ?? {};

  if (!isTokenValid(vaultToken) && !isTokenValid(licenseKey)) {
    return res.status(403).json({
      error: "Valid VaultToken or license key required.",
    });
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
