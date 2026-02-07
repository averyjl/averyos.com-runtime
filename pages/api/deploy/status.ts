import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

// Runtime compatibility check: Node.js fs won't work in Cloudflare Workers.
// If deploying to Workers, consider using KV/D1/R2 or serving from a build artifact.
const isNodeFsAvailable =
  typeof process !== "undefined" && typeof fs?.existsSync === "function";

type DeployLog = {
  latest_deploy_sha: string;
  deploy_status: "success" | "failed" | "pending";
  deployed_at: string;
  source_repo: string;
  vaultsig?: string;
};

const deployLogPath = path.join(process.cwd(), "capsule_logs", "deploy.json");

const getDeployLog = (): DeployLog => {
  if (!isNodeFsAvailable || !fs.existsSync(deployLogPath)) {
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

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const log = getDeployLog();
  const vaultsig = log.vaultsig || "";
  const vaultsigFormatValid = verifyCapsuleHash(vaultsig);
  const expectedVaultsig = process.env.VAULTSIG_SECRET;

  // If no expected secret is configured, return format validation only
  const vaultsigMatch = !expectedVaultsig
    ? vaultsigFormatValid
    : vaultsigFormatValid && timingSafeCompare(vaultsig, expectedVaultsig);

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
