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

/**
 * Load the capsule registry from the filesystem.
 * 
 * NOTE: This function uses Node `fs` and will NOT work on Cloudflare Workers
 * or edge runtimes. For Workers deployment, consider:
 * 1. Fetching the registry from a public asset URL (e.g., fetch('/manifest/capsules/index.json'))
 * 2. Bundling the registry at build time as a module export
 * 3. Storing the registry in KV/D1/R2 storage
 */
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
