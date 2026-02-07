import fs from "fs";
import path from "path";

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
  // Check if fs is available (won't work in Cloudflare Workers)
  if (typeof process === "undefined" || !fs.existsSync) {
    console.warn("Filesystem not available - consider fetching registry from /manifest/capsules/index.json or using KV/D1/R2");
    return null;
  }
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
