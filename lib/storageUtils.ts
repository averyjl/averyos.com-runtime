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
 * AveryOS Storage Utility
 *
 * Handles persisting Capsule files to Cloudflare R2 via the VAULT binding.
 * All Capsule objects are stored under the `averyos-capsules/` prefix to keep
 * the root of the R2 bucket organised and to allow permanent retention via
 * bucket lifecycle rules that exclude this prefix.
 *
 * Usage (App Router edge route):
 *   import { getCloudflareContext } from '@opennextjs/cloudflare';
 *   import { saveCapsule } from '../../../lib/storageUtils';
 *
 *   const { env } = await getCloudflareContext({ async: true });
 *   await saveCapsule(env.VAULT, 'my-file.aoscap', content);
 */

/** R2 object body returned by a get() call. */
export interface R2ObjectBody {
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Minimal R2Bucket interface required by the storage utility. */
export interface R2Bucket {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: Array<{ key: string }>;
    truncated: boolean;
    cursor?: string;
  }>;
}

/** Prefix applied to every Capsule object stored in the VAULT R2 bucket. */
export const CAPSULE_PREFIX = 'averyos-capsules/';

/**
 * Returns the full R2 object key for a given Capsule filename.
 * Ensures the `averyos-capsules/` prefix is present exactly once.
 */
export function capsuleKey(filename: string): string {
  const name = filename.startsWith(CAPSULE_PREFIX)
    ? filename.slice(CAPSULE_PREFIX.length)
    : filename;
  return `${CAPSULE_PREFIX}${name}`;
}

/**
 * Saves a Capsule to the VAULT R2 bucket.
 * The file path is automatically prefixed with `averyos-capsules/`.
 *
 * @param vault    - The R2 bucket instance obtained from `env.VAULT`.
 * @param filename - The bare filename (e.g., `my-file.aoscap`).
 * @param content  - The Capsule content to store.
 */
export async function saveCapsule(
  vault: R2Bucket,
  filename: string,
  content: string,
): Promise<void> {
  await vault.put(capsuleKey(filename), content);
}

/**
 * Retrieves a Capsule from the VAULT R2 bucket.
 *
 * @param vault    - The R2 bucket instance obtained from `env.VAULT`.
 * @param filename - The bare filename (e.g., `my-file.aoscap`).
 * @returns The Capsule content, or `null` if not found.
 */
export async function getCapsule(
  vault: R2Bucket,
  filename: string,
): Promise<string | null> {
  const obj = await vault.get(capsuleKey(filename));
  return obj ? obj.text() : null;
}

/**
 * Lists all Capsule filenames stored under the `averyos-capsules/` prefix.
 * Follows R2 pagination to return the complete set of results.
 *
 * @param vault - The R2 bucket instance obtained from `env.VAULT`.
 * @returns An array of bare filenames (prefix stripped).
 */
export async function listCapsules(vault: R2Bucket): Promise<string[]> {
  const filenames: string[] = [];
  let cursor: string | undefined;

  do {
    const result = await vault.list({ prefix: CAPSULE_PREFIX, cursor });
    for (const obj of result.objects) {
      filenames.push(obj.key.slice(CAPSULE_PREFIX.length));
    }
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor !== undefined);

  return filenames;
}

/**
 * Deletes a Capsule from the VAULT R2 bucket.
 *
 * @param vault    - The R2 bucket instance obtained from `env.VAULT`.
 * @param filename - The bare filename (e.g., `my-file.aoscap`).
 */
export async function deleteCapsule(
  vault: R2Bucket,
  filename: string,
): Promise<void> {
  await vault.delete(capsuleKey(filename));
}
