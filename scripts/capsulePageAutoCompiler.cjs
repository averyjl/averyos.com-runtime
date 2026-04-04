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
