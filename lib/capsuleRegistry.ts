import fs from "fs";
import path from "path";

// Runtime compatibility check: Node.js fs won't work in Cloudflare Workers.
// If deploying to Workers, consider using fetch() to load from public URLs
// or bundle the registry at build time.
const isNodeFsAvailable =
  typeof process !== "undefined" && typeof fs?.existsSync === "function";

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
  if (!isNodeFsAvailable || !fs.existsSync(registryPath)) {
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
