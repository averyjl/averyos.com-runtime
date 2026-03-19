import fs from "fs";
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

export const loadCapsuleRegistry = (): CapsuleRegistry | null => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const raw = fs.readFileSync(registryPath, "utf-8");
    return JSON.parse(raw) as CapsuleRegistry;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
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
