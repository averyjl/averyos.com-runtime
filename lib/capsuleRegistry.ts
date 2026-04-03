import path from "path";

export type CapsuleRegistryItem = {
  capsuleId: string;
  title?: string;
  summary?: string;
  sha?: string;
  driftLock?: string;
  compiledAt?: string;
  category?: string;
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

export const loadCapsuleRegistry = async (): Promise<CapsuleRegistry | null> => {
  const { default: fs } = await import("node:fs");
  let raw: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    raw = fs.readFileSync(registryPath, "utf-8");
  } catch {
    return null;
  }
  return JSON.parse(raw) as CapsuleRegistry;
};

export const listRegistryCapsules = async (): Promise<CapsuleRegistryItem[]> => {
  const registry = await loadCapsuleRegistry();
  if (!registry || !Array.isArray(registry.capsules)) {
    return [];
  }
  return registry.capsules.slice().sort((a, b) => {
    const left = a.title || a.capsuleId;
    const right = b.title || b.capsuleId;
    return left.localeCompare(right);
  });
};
