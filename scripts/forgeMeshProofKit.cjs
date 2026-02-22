const fs = require("fs");
const path = require("path");

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const baseDir = path.join(process.cwd(), "capsule_logs", `mesh-proof-kit-${ts}`);

fs.mkdirSync(baseDir, { recursive: true });
fs.writeFileSync(path.join(baseDir, "README.txt"), "MeshProofKit v1 evidence folder\n");
fs.writeFileSync(path.join(baseDir, "witness-checklist.txt"), "- Capture VaultSig\n- Capture session timestamp\n");
fs.writeFileSync(path.join(baseDir, "broadcast-notes.txt"), "Mesh declaration notes go here.\n");

console.log(`Generated MeshProofKit at ${baseDir}`);
