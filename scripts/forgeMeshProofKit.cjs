const path = require("path");
const { sovereignWriteSync, CAPSULE_LOGS_ROOT } = require("./lib/sovereignIO.cjs");

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const kitDirName = `mesh-proof-kit-${ts}`;
const kitRoot = path.join(CAPSULE_LOGS_ROOT, kitDirName);

sovereignWriteSync(kitRoot, "README.txt", "MeshProofKit v1 evidence folder\n");
sovereignWriteSync(kitRoot, "witness-checklist.txt", "- Capture VaultSig\n- Capture session timestamp\n");
sovereignWriteSync(kitRoot, "broadcast-notes.txt", "Mesh declaration notes go here.\n");

console.log(`Generated MeshProofKit at ${kitRoot}`);
