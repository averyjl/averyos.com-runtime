import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";
import { timingSafeEqual } from "crypto";

// NOTE: This API route uses Node.js filesystem APIs and is incompatible with
// Cloudflare Workers. For Workers deployment, migrate to:
// 1. Cloudflare D1 (SQL database) or KV for deploy status storage
// 2. Or fetch from a build artifact served as a static asset

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

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const log = getDeployLog();
  
  const vaultsig = log.vaultsig || "";
  const vaultsigFormatValid = verifyCapsuleHash(vaultsig);
  const expectedVaultsig = process.env.VAULTSIG_SECRET;

  let vaultsigMatch = false;
  
  if (!expectedVaultsig) {
    // Preserve previous behavior when no expected secret is configured:
    vaultsigMatch = vaultsigFormatValid;
  } else if (vaultsigFormatValid && verifyCapsuleHash(expectedVaultsig)) {
    // Use constant-time comparison to prevent timing attacks
    try {
      vaultsigMatch = timingSafeEqual(
        Buffer.from(vaultsig, "utf8"),
        Buffer.from(expectedVaultsig, "utf8")
      );
    } catch {
      vaultsigMatch = false;
    }
  }

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
