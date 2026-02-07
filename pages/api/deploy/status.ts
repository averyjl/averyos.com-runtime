import fs from "fs";
import path from "path";
import { timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";
import { timingSafeEqual } from "crypto";

// NOTE: This API route uses Node.js filesystem APIs and is incompatible with
// Cloudflare Workers. For Workers deployment, migrate to:
// 1. Cloudflare D1 (SQL database) or KV for deploy status storage
// 2. Or fetch from a build artifact served as a static asset

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

// NOTE: This handler uses Node `fs` to read capsule_logs/deploy.json.
// It will NOT work on Cloudflare Workers or edge runtimes. If deploying to Workers,
// replace filesystem operations with KV/D1/R2 or serve deploy status from a build artifact.
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

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const log = getDeployLog();
  
  const vaultsig = log.vaultsig || "";
  const vaultsigFormatValid = verifyCapsuleHash(vaultsig);
  const expectedVaultsig = process.env.VAULTSIG_SECRET;

  let vaultsigMatch = false;
  
  if (!expectedVaultsig) {
    // For development/testing: when no secret is configured, fallback to format-only validation.
    // SECURITY WARNING: This does NOT provide authentication. In production, always set VAULTSIG_SECRET.
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
  // Determine vaultsig_match:
  // - If no expected secret is configured, only check format validity
  // - If expected secret is configured, check both format and actual match
  const vaultsigMatch =
    !expectedVaultsig
      ? vaultsigFormatValid
      : vaultsigFormatValid && safeCompare(vaultsig, expectedVaultsig);

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
