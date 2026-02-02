import fs from "fs";
import path from "path";

export type CapsuleManifest = {
  capsuleId: string;
  title: string;
  summary: string;
  sha: string;
  driftLock: string;
  vaultChainUrl?: string;
  licenseStatus: string;
  viewerUrl?: string | null;
  stripeUrl?: string | null;
  vaultChainUrl?: string;
};

const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");

export const loadCapsuleManifest = (capsuleId: string): CapsuleManifest | null => {
  const manifestPath = path.join(manifestDir, `${capsuleId}.json`);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  const raw = fs.readFileSync(manifestPath, "utf-8");
  return JSON.parse(raw) as CapsuleManifest;
};

export const listCapsuleIds = (): string[] => {
  if (!fs.existsSync(manifestDir)) {
    return [];
  }
  return fs
    .readdirSync(manifestDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => fileName.replace(/\.json$/, ""));
};
