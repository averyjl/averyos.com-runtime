const fs = require("fs");
const path = require("path");

const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");

const loadManifest = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const buildRegistry = () => {
  if (!fs.existsSync(manifestDir)) {
    console.log("No manifest directory found.");
    return;
  }

  const manifests = fs
    .readdirSync(manifestDir)
    .filter((fileName) => fileName.endsWith(".json") && fileName !== "index.json")
    .map((fileName) => loadManifest(path.join(manifestDir, fileName)))
    .sort((a, b) => a.capsuleId.localeCompare(b.capsuleId));

  const registry = {
    generatedAt: new Date().toISOString(),
    count: manifests.length,
    capsules: manifests.map((manifest) => ({
      capsuleId: manifest.capsuleId,
      title: manifest.title,
      summary: manifest.summary,
      sha: manifest.sha,
      driftLock: manifest.driftLock,
    })),
  };

  const registryPath = path.join(manifestDir, "index.json");
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  console.log(`Wrote registry with ${registry.count} capsule(s).`);
};

buildRegistry();
