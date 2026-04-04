/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
const fs = require("fs");
const path = require("path");
const { sovereignWriteSync, CAPSULE_MANIFEST_ROOT } = require("./lib/sovereignIO.cjs");

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
      compiledAt: manifest.compiledAt,
    })),
  };

  sovereignWriteSync(CAPSULE_MANIFEST_ROOT, "index.json", JSON.stringify(registry, null, 2));
  console.log(`Wrote registry with ${registry.count} capsule(s).`);
};

buildRegistry();
