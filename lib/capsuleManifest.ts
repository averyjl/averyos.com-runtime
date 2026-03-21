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
  vaultChainUrl?: string | null;
  licenseStatus: string;
  viewerUrl?: string | null;
  stripeUrl?: string | null;
};

const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");

const isSafeCapsuleId = (capsuleId: string): boolean => {
  // Allow only simple identifiers (no slashes or path traversal characters)
  // Adjust the pattern here if additional characters are legitimately needed.
  return /^[a-zA-Z0-9._-]+$/.test(capsuleId);
};

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
  if (!capsuleId || !isSafeCapsuleId(capsuleId)) {
    return null;
  }

  const candidatePath = path.resolve(manifestDir, `${capsuleId}.json`);

  let manifestPath: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    manifestPath = fs.realpathSync(candidatePath);
  } catch {
    // File does not exist or cannot be resolved
    return null;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!manifestPath.startsWith(manifestDir + path.sep)) {
    // Resolved path escapes the manifest directory; treat as not found
    return null;
  }

  let raw: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    raw = fs.readFileSync(manifestPath, "utf-8");
  } catch {
    return null;
  }
  return normalizeManifest(JSON.parse(raw) as CapsuleManifest);
};

export const listCapsuleIds = (): string[] => {
  let files: string[];
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    files = fs.readdirSync(manifestDir);
  } catch {
    return [];
  }
  return files
    .filter((fileName) => fileName.endsWith(".json") && fileName !== "index.json")
    .map((fileName) => fileName.replace(/\.json$/, ""))
    .sort((a, b) => a.localeCompare(b));
};
