/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
const path = require("path");
const { sovereignWriteSync, CAPSULE_LOGS_ROOT } = require("./lib/sovereignIO.cjs");

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const kitDirName = `mesh-proof-kit-${ts}`;
const kitRoot = path.join(CAPSULE_LOGS_ROOT, kitDirName);

sovereignWriteSync(kitRoot, "README.txt", "MeshProofKit v1 evidence folder\n");
sovereignWriteSync(kitRoot, "witness-checklist.txt", "- Capture VaultSig\n- Capture session timestamp\n");
sovereignWriteSync(kitRoot, "broadcast-notes.txt", "Mesh declaration notes go here.\n");

console.log(`Generated MeshProofKit at ${kitRoot}`);
