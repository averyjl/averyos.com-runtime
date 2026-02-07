import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

type DeployLog = {
  latest_deploy_sha: string;
  deploy_status: "success" | "failed" | "pending";
  deployed_at: string;
  source_repo: string;
  vaultsig?: string;
};

const deployLogPath = path.join(process.cwd(), "capsule_logs", "deploy.json");

const getDeployLog = (): DeployLog => {
  if (!fs.existsSync(deployLogPath)) {
    return {
      latest_deploy_sha: "unknown",
      deploy_status: "pending",
      deployed_at: new Date(0).toISOString(),
      source_repo: "averyos.com-runtime",
      vaultsig: "",
    };
  }

  return JSON.parse(fs.readFileSync(deployLogPath, "utf8")) as DeployLog;
};

// Constant-time string comparison to prevent timing attacks
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
};

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  // Check if fs is available (won't work in Cloudflare Workers)
  if (typeof process === "undefined" || !fs.existsSync) {
    return res.status(501).json({
      error: "File system not available in this runtime. Use KV/D1/R2 for persistent storage.",
    });
  }

  const log = getDeployLog();

  const vaultsig = log.vaultsig || "";
  const vaultsigFormatValid = verifyCapsuleHash(vaultsig);
  const expectedVaultsig = process.env.VAULTSIG_SECRET;

  // If expected secret is configured, compare against it; otherwise just check format
  const vaultsigMatch =
    !expectedVaultsig
      ? vaultsigFormatValid
      : vaultsigFormatValid && timingSafeEqual(vaultsig, expectedVaultsig);

  return res.status(200).json({
    latest_deploy_sha: log.latest_deploy_sha,
    deploy_status: log.deploy_status,
    deployed_at: log.deployed_at,
    source_repo: log.source_repo,
    vaultsig_match: vaultsigMatch,
    vaultsig_format_valid: vaultsigFormatValid,
  });
};

export default handler;
