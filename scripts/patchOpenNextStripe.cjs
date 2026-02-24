/**
 * Patches @opennextjs/cloudflare to fix a bug where stripe's workerd condition
 * is not detected because the package uses the nested object format:
 *   "workerd": { "import": "./esm/stripe.esm.worker.js", "require": "..." }
 * instead of the string format the adapter expects:
 *   "workerd": "./esm/stripe.esm.worker.js"
 *
 * Without this patch, copyWorkerdPackages() skips copying stripe.esm.worker.js
 * to the build output, causing esbuild to fail when bundling with workerd conditions.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const workerdJs = path.join(
  __dirname,
  "../node_modules/@opennextjs/cloudflare/dist/cli/build/utils/workerd.js"
);

if (!fs.existsSync(workerdJs)) {
  console.warn("⚠️  patchOpenNextStripe: workerd.js not found, skipping patch");
  process.exit(0);
}

const OLD = `const hasTopLevelBuildCondition = Object.keys(conditionMap).some((key) => key === condition && typeof conditionMap[key] === "string");`;
const NEW = `const hasTopLevelBuildCondition = Object.keys(conditionMap).some((key) => key === condition);`;

let content = fs.readFileSync(workerdJs, "utf8");

if (content.includes(NEW)) {
  console.log("✅ @opennextjs/cloudflare workerd.js already patched (stripe fix)");
  process.exit(0);
}

if (!content.includes(OLD)) {
  console.warn(
    "⚠️  patchOpenNextStripe: expected code not found in workerd.js — adapter may have changed, skipping"
  );
  process.exit(0);
}

content = content.replace(OLD, NEW);
fs.writeFileSync(workerdJs, content, "utf8");
console.log("✅ Patched @opennextjs/cloudflare workerd.js (stripe nested workerd condition fix)");
