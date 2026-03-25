const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const HASH_TYPE = "sha512"; // Re-anchoring the global hash standard
const { sovereignWriteSync, CAPSULE_MANIFEST_ROOT } = require("./lib/sovereignIO.cjs");

const capsulesDir = path.join(process.cwd(), "capsules");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const { compileCapsuleSignature } = require('./capsuleSignatureCompiler.cjs');

const computeSha = (content) => compileCapsuleSignature(content);

const readCapsules = () => {
  if (!fs.existsSync(capsulesDir)) {
    return [];
  }
  return fs
    .readdirSync(capsulesDir)
    .filter((fileName) => fileName.endsWith(".aoscap"))
    .map((fileName) => ({
      id: fileName.replace(/\.aoscap$/, ""),
      filePath: path.join(capsulesDir, fileName),
    }));
};

const compileCapsule = ({ id, filePath }) => {
  const raw = fs.readFileSync(filePath, "utf8");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}`);
  }

  const sha = computeSha(raw);
  const driftLock = computeSha(`${HASH_TYPE}:${sha}:${id}`);
  const compiledAt = new Date().toISOString();
  const body = Array.isArray(payload.body)
    ? payload.body.map((item) => String(item))
    : payload.body
      ? [String(payload.body)]
      : [];

  const manifest = {
    capsuleId: id,
    title: payload.title ?? id,
    summary: payload.summary ?? "",
    body,
    sha,
    driftLock,
    compiledAt,
    vaultChainUrl: payload.vaultChainUrl ?? null,
    licenseStatus: payload.licenseStatus ?? "Awaiting license",
    viewerUrl: payload.viewerUrl ?? null,
    stripeUrl: payload.stripeUrl ?? null,
  };

  const manifestFileName = `${id}.json`;
  const manifestPath = path.join(CAPSULE_MANIFEST_ROOT, manifestFileName);
  sovereignWriteSync(CAPSULE_MANIFEST_ROOT, manifestFileName, JSON.stringify(manifest, null, 2));

  return manifest;
};

const run = () => {
  ensureDir(CAPSULE_MANIFEST_ROOT);
  const capsules = readCapsules();
  if (capsules.length === 0) {
    console.log("No .aoscap files found.");
    return;
  }

  const compiled = capsules.map(compileCapsule);
  console.log(`Compiled ${compiled.length} capsule manifest(s).`);
};

run();
