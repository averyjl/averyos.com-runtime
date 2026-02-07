import fs from "fs";
import path from "path";

// Runtime compatibility check: Node.js fs won't work in Cloudflare Workers.
// If deploying to Workers, consider using fetch() to load from public URLs
// or bundle the registry at build time.
const isNodeFsAvailable =
  typeof process !== "undefined" && typeof fs?.existsSync === "function";
// NOTE: This module uses Node fs to read the registry from the filesystem.
// If deploying to Cloudflare Workers (or other edge runtimes without fs), consider:
// 1. Fetching the registry from the public URL (/manifest/capsules/index.json)
// 2. Bundling the registry at build time into the Worker bundle
// NOTE: This module uses Node.js filesystem APIs and is incompatible with
// Cloudflare Workers. For Workers deployment, migrate to:
// 1. Fetch manifests from public URLs (e.g., fetch('/manifest/capsules/index.json'))
// 2. Or bundle registry data at build time
// NOTE: This module uses Node.js fs and will NOT work in Cloudflare Workers.
// For Workers/Edge deployment, consider:
// - Loading the registry via fetch() from the public asset URL (/manifest/capsules/index.json)
// - Bundling the registry at build time as a JavaScript module
// - Using Cloudflare KV to store and retrieve the registry

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
  if (!isNodeFsAvailable || !fs.existsSync(registryPath)) {
  // Check if fs is available (won't work in Cloudflare Workers)
  if (typeof process === "undefined" || !fs.existsSync) {
    console.warn("File system not available. Use fetch() or bundle registry at build time for edge runtimes.");
    console.warn("Filesystem not available - consider fetching registry from /manifest/capsules/index.json or using KV/D1/R2");
    return null;
  }
  // Check if we're in a Node.js environment
  if (typeof process === "undefined" || !fs.existsSync) {
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
