/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * scripts/sovereignGuardConfig.cjs
 *
 * AveryOS™ Shared Sovereign Guard Configuration
 *
 * Centralises the constants used by sovereign-leak-guard.cjs and
 * qaTestGenerator.cjs to prevent configuration drift between the two
 * security scanning pipelines.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

/**
 * Extensions of code files that are required to run AveryOS™.
 * Files with these extensions are NEVER auto-added to .gitignore
 * regardless of whether their filename contains "key" or "token".
 */
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.cjs', '.mjs', '.jsx',
  '.json', '.yaml', '.yml', '.toml', '.md',
  '.html', '.css', '.scss',
]);

/**
 * Directory prefixes (relative to repo root) whose files are protected
 * source code required to run AveryOS™.  Files inside these directories
 * are NEVER auto-added to .gitignore regardless of filename.
 */
const PROTECTED_DIRS = [
  'lib/', 'app/', 'pages/', 'components/', 'scripts/',
  'capsules/', 'public/', '__tests__/', '.github/',
  'styles/', 'workers/', 'migrations/', 'content/', 'VaultBridge/',
];

/**
 * Content patterns indicating actual cryptographic material.
 * A file must match at least one of these patterns to be considered
 * a real key/token file that should be auto-added to .gitignore.
 *
 * Design principles (same as sovereign-leak-guard.cjs Layer 2):
 *   • PEM detection requires actual base64 key material on the next line
 *     to avoid false positives from code comments.
 *   • Only Stripe LIVE keys flagged (not test keys).
 *   • Long Base64 strings only flagged at ≥ 512 chars (≈ 3072-bit minimum).
 */
const KEY_CONTENT_PATTERNS = [
  {
    name:  'PEM Private Key Block',
    regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/]{10}/,
  },
  {
    name:  'Base64 RSA Key Material (512+ chars)',
    regex: /[A-Za-z0-9+/]{512,}={0,2}/,
  },
  {
    name:  'Stripe Live Secret Key',
    regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/,
  },
  {
    name:  'GitHub Personal Access Token',
    regex: /\bghp_[0-9a-zA-Z]{36,}\b/,
  },
  {
    name:  'Firebase Service-Account Private Key',
    regex: /"private_key"\s*:\s*"-----BEGIN[^"]{50,}/,
  },
];

module.exports = {
  CODE_EXTENSIONS,
  PROTECTED_DIRS,
  KEY_CONTENT_PATTERNS,
};
