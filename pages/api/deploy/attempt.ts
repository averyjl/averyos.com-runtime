import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

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

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { vaultToken, licenseKey } = req.body ?? {};

  if (!verifyCapsuleHash(vaultToken) && !verifyCapsuleHash(licenseKey)) {
    return res.status(403).json({
      error: "VaultToken or license key must be a valid SHA512 hash.",
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
