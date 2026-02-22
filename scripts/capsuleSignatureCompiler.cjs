const crypto = require("crypto");

const HASH_TYPE = "sha512";

const compileCapsuleSignature = (content) => {
  const hash = crypto.createHash(HASH_TYPE).update(content, "utf8").digest("hex");

  if (hash.length !== 128) {
    throw new Error(`Invalid ${HASH_TYPE} digest length: ${hash.length}`);
  }

  return hash;
};

module.exports = {
  HASH_TYPE,
  compileCapsuleSignature,
};
