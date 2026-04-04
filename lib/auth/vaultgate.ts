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
 * lib/auth/vaultgate.ts
 *
 * VaultGate™ WebAuthn / YubiKey Credential Store — AveryOS™ Phase 111 / GATE 111.3.2
 *
 * Provides typed helpers for all D1 operations against the `vaultgate_credentials`
 * table.  All queries explicitly reference the table name so that no ambient
 * table mis-routing can cause a "YubiKey Not Recognised" drift.
 *
 * Table schema (migration 0043_vaultgate_table.sql):
 *
 *   id         TEXT     PRIMARY KEY            — base64url-encoded rawId from the authenticator
 *   user_id    TEXT     NOT NULL               — AveryOS™ user identifier (ROOT0 or registered user)
 *   public_key TEXT     NOT NULL               — COSE-encoded public key bytes (base64url)
 *   counter    INTEGER  NOT NULL DEFAULT 0     — authenticator signature counter
 *   backed_up  INTEGER  NOT NULL DEFAULT 0     — whether the credential is backed up (passkey flag)
 *   transports TEXT     NOT NULL DEFAULT '[]'  — JSON array of authenticator transports
 *   created_at DATETIME NOT NULL               — ISO-8601 registration timestamp
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                from "../timePrecision";

// ── Table name — never inlined as a variable in queries ───────────────────────
const TABLE = "vaultgate_credentials" as const;

// ── Minimal D1 type shim (avoids @cloudflare/workers-types dependency) ────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

// ── Credential record shape ───────────────────────────────────────────────────

export interface VaultGateCredential {
  /** Base64url-encoded credential rawId. */
  id:         string;
  /** AveryOS™ user identifier. */
  user_id:    string;
  /** COSE-encoded public key (base64url). */
  public_key: string;
  /** Authenticator signature counter — must be strictly increasing. */
  counter:    number;
  /**
   * Whether the platform has backed up this credential (passkey behaviour).
   * Stored as INTEGER (0/1) in SQLite; exposed as boolean here.
   */
  backed_up:  boolean;
  /** JSON array of authenticator transports (usb | nfc | ble | internal). */
  transports: string[];
  /** ISO-8601 timestamp of credential registration. */
  created_at: string;
}

// ── Raw D1 row shape (before deserialization) ─────────────────────────────────

interface VaultGateRow {
  id:         string;
  user_id:    string;
  public_key: string;
  counter:    number;
  backed_up:  number;   // SQLite INTEGER (0 | 1)
  transports: string;   // JSON array string
  created_at: string;
}

// ── Deserialize helper ────────────────────────────────────────────────────────

function rowToCredential(row: VaultGateRow): VaultGateCredential {
  let transports: string[] = [];
  try {
    const parsed = JSON.parse(row.transports) as unknown;
    if (Array.isArray(parsed)) {
      transports = parsed as string[];
    }
  } catch {
    transports = [];
  }
  return {
    id:         row.id,
    user_id:    row.user_id,
    public_key: row.public_key,
    counter:    row.counter,
    backed_up:  row.backed_up !== 0,
    transports,
    created_at: row.created_at,
  };
}

// ── VaultGate kernel anchor ───────────────────────────────────────────────────

/** Kernel anchor metadata included in VaultGate operation results. */
export interface VaultGateAnchor {
  kernelSha:     string;
  kernelVersion: string;
}

const ANCHOR: VaultGateAnchor = {
  kernelSha:     KERNEL_SHA,
  kernelVersion: KERNEL_VERSION,
};

// ── CRUD Operations ───────────────────────────────────────────────────────────

/**
 * Fetch a single WebAuthn credential by its base64url rawId.
 *
 * Explicitly queries the `vaultgate_credentials` table.
 *
 * @param db  Cloudflare D1 database binding.
 * @param id  Base64url-encoded credential rawId.
 * @returns   The credential record, or null if not found.
 */
export async function getCredential(
  db: D1Database,
  id: string,
): Promise<VaultGateCredential | null> {
  const row = await db
    .prepare(`SELECT * FROM ${TABLE} WHERE id = ?`)
    .bind(id)
    .first<VaultGateRow>();
  return row ? rowToCredential(row) : null;
}

/**
 * List all WebAuthn credentials registered for a given user.
 *
 * Explicitly queries the `vaultgate_credentials` table.
 *
 * @param db      Cloudflare D1 database binding.
 * @param userId  AveryOS™ user identifier.
 * @returns       Array of credential records (may be empty).
 */
export async function getCredentialsByUser(
  db: D1Database,
  userId: string,
): Promise<VaultGateCredential[]> {
  const { results } = await db
    .prepare(`SELECT * FROM ${TABLE} WHERE user_id = ? ORDER BY created_at ASC`)
    .bind(userId)
    .all<VaultGateRow>();
  return results.map(rowToCredential);
}

/**
 * Insert a new WebAuthn credential registration into `vaultgate_credentials`.
 *
 * Idempotent: uses INSERT OR IGNORE so a duplicate rawId is silently skipped.
 *
 * @param db   Cloudflare D1 database binding.
 * @param cred Credential data from the WebAuthn registration ceremony.
 * @returns    True if a row was inserted; false if the id already existed.
 */
export async function saveCredential(
  db: D1Database,
  cred: Omit<VaultGateCredential, "created_at">,
): Promise<boolean> {
  const now = formatIso9(new Date());
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO ${TABLE}
         (id, user_id, public_key, counter, backed_up, transports, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      cred.id,
      cred.user_id,
      cred.public_key,
      cred.counter,
      cred.backed_up ? 1 : 0,
      JSON.stringify(cred.transports),
      now,
    )
    .run();
  return result.meta.changes > 0;
}

/**
 * Update the signature counter for an existing credential.
 *
 * WebAuthn mandates that the counter must be strictly greater than the
 * previously stored value.  Callers are responsible for enforcing this
 * before calling this function.
 *
 * @param db      Cloudflare D1 database binding.
 * @param id      Credential rawId.
 * @param counter New counter value (must be > stored value).
 * @returns       True if the row was updated.
 */
export async function updateCounter(
  db: D1Database,
  id: string,
  counter: number,
): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE ${TABLE} SET counter = ? WHERE id = ?`)
    .bind(counter, id)
    .run();
  return result.meta.changes > 0;
}

/**
 * Remove a WebAuthn credential from the store.
 *
 * @param db  Cloudflare D1 database binding.
 * @param id  Credential rawId to remove.
 * @returns   True if the row was deleted.
 */
export async function deleteCredential(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM ${TABLE} WHERE id = ?`)
    .bind(id)
    .run();
  return result.meta.changes > 0;
}

// ── Re-export anchor for convenience ─────────────────────────────────────────

export { ANCHOR as VAULTGATE_ANCHOR };

// ── SHA-512 payload verification — GATE 119.6.3 ───────────────────────────────

/**
 * Compute the SHA-512 hash of a plaintext passphrase.
 *
 * This is the `sha512_payload` alignment standard for VaultGate auth.
 * The Admin Dashboard (app/admin/sovereign) uses this to verify that the
 * submitted passphrase matches the stored SHA-512 hash, preventing plaintext
 * comparison and aligning with the AveryOS™ SHA-512 cryptographic standard.
 *
 * Usage:
 *   const hash = await vaultGateSha512Payload(submittedPassphrase);
 *   if (hash !== storedSha512Hash) throw new Error("Invalid passphrase");
 */
export async function vaultGateSha512Payload(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(plaintext);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-512", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Node.js fallback
  const { createHash } = await import("crypto");
  return createHash("sha512").update(plaintext, "utf8").digest("hex");
}

/**
 * Verify a submitted passphrase against a stored SHA-512 hash.
 *
 * This is a constant-time comparison using the SHA-512 digest of both values
 * to prevent timing attacks on the passphrase comparison.
 *
 * @param submitted   Plaintext passphrase submitted by the user.
 * @param storedHash  SHA-512 hash previously stored for the user.
 * @returns           True if the passphrase matches.
 */
export async function verifySha512Payload(
  submitted:  string,
  storedHash: string,
): Promise<boolean> {
  const submittedHash = await vaultGateSha512Payload(submitted);
  // Constant-time comparison: compare as hex strings of equal length
  if (submittedHash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < submittedHash.length; i++) {
    diff |= submittedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}
