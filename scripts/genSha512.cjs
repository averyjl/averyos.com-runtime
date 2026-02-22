const { compileCapsuleSignature } = require("./capsuleSignatureCompiler");

const input = process.argv.slice(2).join(" ") || "example-capsule-content";
const hash = compileCapsuleSignature(input);

console.log(hash);
