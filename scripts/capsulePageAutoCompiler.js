const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const capsulesDir = path.join(process.cwd(), "capsules");
const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const computeSha = (content) =>
  crypto.createHash("sha256").update(content, "utf8").digest("hex");

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
  const driftLock = computeSha(`${sha}:${id}`);
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

  const manifestPath = path.join(manifestDir, `${id}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return manifest;
};

const run = () => {
  ensureDir(manifestDir);
  const capsules = readCapsules();
  if (capsules.length === 0) {
    console.log("No .aoscap files found.");
    return;
  }

  const compiled = capsules.map(compileCapsule);
  console.log(`Compiled ${compiled.length} capsule manifest(s).`);
};

const capsulesDir = path.join(__dirname, "..", "capsules");
const outputDir = path.join(__dirname, "..", "public", "capsule-registry");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function compileCapsule(fileName) {
  const filePath = path.join(capsulesDir, fileName);
  let capsuleData;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    capsuleData = JSON.parse(raw);
  } catch (err) {
    console.warn(`⚠️ Skipping non-JSON or invalid capsule: ${fileName}`);
    return null;
  }

  const outputFile = path.join(outputDir, `${capsuleData.capsuleId || fileName}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(capsuleData, null, 2));
  return outputFile;
}

function run() {
  const files = fs.readdirSync(capsulesDir).filter(file => file.endsWith(".aoscap"));
  const results = files.map(compileCapsule).filter(Boolean);
  console.log(`✅ Compiled ${results.length} capsule manifest(s).`);
}

run();
