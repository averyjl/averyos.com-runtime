const fs = require("fs");
const path = require("path");

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const baseDir = path.join(process.cwd(), "capsule_logs", `mesh-proof-kit-${ts}`);

fs.mkdirSync(baseDir, { recursive: true });
const fd1 = fs.openSync(path.join(baseDir, "README.txt"), 'w');
try { fs.writeSync(fd1, "MeshProofKit v1 evidence folder\n"); } finally { fs.closeSync(fd1); }
const fd2 = fs.openSync(path.join(baseDir, "witness-checklist.txt"), 'w');
try { fs.writeSync(fd2, "- Capture VaultSig\n- Capture session timestamp\n"); } finally { fs.closeSync(fd2); }
const fd3 = fs.openSync(path.join(baseDir, "broadcast-notes.txt"), 'w');
try { fs.writeSync(fd3, "Mesh declaration notes go here.\n"); } finally { fs.closeSync(fd3); }

console.log(`Generated MeshProofKit at ${baseDir}`);
