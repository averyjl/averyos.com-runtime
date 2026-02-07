import fs from "fs";
import path from "path";

// NOTE: This module uses Node fs to read the registry from the filesystem.
// If deploying to Cloudflare Workers (or other edge runtimes without fs), consider:
// 1. Fetching the registry from the public URL (/manifest/capsules/index.json)
// 2. Bundling the registry at build time into the Worker bundle

export type CapsuleRegistryItem = {
  capsuleId: string;
  title?: string;
  summary?: string;
  sha?: string;
  driftLock?: string;
  compiledAt?: string;
};

export type CapsuleRegistry = {
  generatedAt: string;
  count: number;
  capsules: CapsuleRegistryItem[];
};

const registryPath = path.join(
  process.cwd(),
  "public",
  "manifest",
  "capsules",
  "index.json"
);

export const loadCapsuleRegistry = (): CapsuleRegistry | null => {
  if (!fs.existsSync(registryPath)) {
    return null;
  }
  const raw = fs.readFileSync(registryPath, "utf-8");
  return JSON.parse(raw) as CapsuleRegistry;
};

export const listRegistryCapsules = (): CapsuleRegistryItem[] => {
  const registry = loadCapsuleRegistry();
  if (!registry || !Array.isArray(registry.capsules)) {
    return [];
  }
  return registry.capsules.slice().sort((a, b) => {
    const left = a.title || a.capsuleId;
    const right = b.title || b.capsuleId;
    return left.localeCompare(right);
  });
};
