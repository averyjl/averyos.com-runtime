import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

// NOTE: This API uses Node.js fs and will NOT work in Cloudflare Workers.
// For Workers/Edge deployment, replace file-based storage with:
// - Cloudflare KV for simple key-value storage
// - Cloudflare D1 for relational data
// - Cloudflare R2 for object storage
// - External API/database service

type DeployLog = {
  latest_deploy_sha: string;
  deploy_status: "success" | "failed" | "pending";
  deployed_at: string;
  source_repo: string;
  vaultsig?: string;
};

const deployLogPath = path.join(process.cwd(), "capsule_logs", "deploy.json");

const getDeployLog = (): DeployLog => {
  // Check if we're in a Node.js environment
  if (typeof process === "undefined" || !fs.existsSync) {
    return {
      latest_deploy_sha: "unknown",
      deploy_status: "pending",
      deployed_at: new Date(0).toISOString(),
      source_repo: "averyos.com-runtime",
      vaultsig: "",
    };
  }

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

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const log = getDeployLog();
  
  const vaultsig = log.vaultsig || "";
  const vaultsigFormatValid = verifyCapsuleHash(vaultsig);
  const expectedVaultsig = process.env.VAULTSIG_SECRET;

  const vaultsigMatch =
    // Preserve previous behavior when no expected secret is configured:
    !expectedVaultsig
      ? vaultsigFormatValid
      : vaultsigFormatValid && vaultsig === expectedVaultsig;

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
