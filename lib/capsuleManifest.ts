import fs from "fs";
import path from "path";

export type CapsuleManifest = {
  capsuleId: string;
  title: string;
  summary: string;
  body: string[];
  sha: string;
  driftLock: string;
  compiledAt: string;
  vaultChainUrl?: string;
  licenseStatus: string;
  viewerUrl?: string | null;
  stripeUrl?: string | null;
};

// NOTE: This module uses Node `fs` to read manifests from public/manifest/capsules.
// It will NOT work on Cloudflare Workers or edge runtimes. For Workers deployment:
// 1. Fetch manifests from public asset URLs (e.g., fetch('/manifest/capsules/id.json'))
// 2. Bundle manifests at build time as module exports
// 3. Store manifests in KV/D1/R2 storage
const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");

const normalizeBody = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [String(value)];
};

const normalizeManifest = (raw: CapsuleManifest): CapsuleManifest => {
  return {
    ...raw,
    capsuleId: raw.capsuleId ?? "unknown",
    title: raw.title ?? raw.capsuleId ?? "Untitled capsule",
    summary: raw.summary ?? "",
    sha: raw.sha ?? "",
    driftLock: raw.driftLock ?? "",
    body: normalizeBody(raw.body),
    compiledAt: raw.compiledAt ?? new Date(0).toISOString(),
    vaultChainUrl: raw.vaultChainUrl ?? null,
    licenseStatus: raw.licenseStatus ?? "Awaiting license",
    viewerUrl: raw.viewerUrl ?? null,
    stripeUrl: raw.stripeUrl ?? null,
  };
};

export const loadCapsuleManifest = (capsuleId: string): CapsuleManifest | null => {
  const manifestPath = path.join(manifestDir, `${capsuleId}.json`);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  const raw = fs.readFileSync(manifestPath, "utf-8");
  return normalizeManifest(JSON.parse(raw) as CapsuleManifest);
};

export const listCapsuleIds = (): string[] => {
  if (!fs.existsSync(manifestDir)) {
    return [];
  }
  return fs
    .readdirSync(manifestDir)
    .filter((fileName) => fileName.endsWith(".json") && fileName !== "index.json")
    .map((fileName) => fileName.replace(/\.json$/, ""))
    .sort((a, b) => a.localeCompare(b));
};
