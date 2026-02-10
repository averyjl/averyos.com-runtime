export const HASH_TYPE = "SHA-512";
export const SHA512_HEX_REGEX = /^[a-fA-F0-9]{128}$/;

export const verifyCapsuleHash = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }
  return SHA512_HEX_REGEX.test(value.trim());
};
