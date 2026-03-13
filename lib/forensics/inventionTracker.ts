/**
 * lib/forensics/inventionTracker.ts
 *
 * GabrielOS™ Invention Pulse — Phase 114.1.2
 *
 * Indexes unique logic blocks (micro-inventions) as sovereign .aoscap invention
 * capsules anchored to the AveryOS™ Root0 Kernel.  Each capsule records:
 *   • Microsecond-precision ISO-9 timestamp
 *   • SHA-512 fingerprint of the invention payload
 *   • ROOT0 authorship seal (Jason Lee Avery)
 *   • KERNEL_SHA Sovereign Kernel link
 *
 * The resulting capsules form an Immutable Patent Record suitable for
 * submission to any auditing party, VaultChain verification, or legal filing.
 *
 * GATE 114.1.2 — Sovereign MIME Type Registry:
 *   All AveryOS™ proprietary file extensions are registered here as the
 *   canonical source of truth.  New types can be added to SOVEREIGN_MIME_TYPES
 *   without modifying any other file — all consumers import from here.
 *
 * Author: Jason Lee Avery (ROOT0)
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Sovereign MIME Type Registry (GATE 114.1.2) ───────────────────────────────

/**
 * Canonical registry of all AveryOS™ sovereign file extensions.
 *
 * Adding a new type here is sufficient — all consumers (LeakGuard, QA engine,
 * capsule store, invention tracker) import from this single source of truth.
 * The registry is intentionally open for future extension (new entries can be
 * pushed to `extensions` without touching any other field).
 */
export interface SovereignMimeType {
  /** File extension including leading dot */
  extension: string;
  /** Human-readable label */
  label: string;
  /** Brief description of the type's purpose */
  description: string;
  /** Whether this type is gitignored (private by default) */
  private: boolean;
}

/** All registered AveryOS™ sovereign MIME / file extension types. */
export const SOVEREIGN_MIME_TYPES: SovereignMimeType[] = [
  {
    extension:   ".aoscap",
    label:       "AOS Capsule",
    description: "Sovereign capsule payload — functional logic block anchored to the kernel.",
    private:     false, // source capsules in capsules/ are tracked; bundles are ignored
  },
  {
    extension:   ".aosinv",
    label:       "AOS Invention",
    description: "Patent-ready invention record: phrasing, biometric claim, SHA-512 fingerprint.",
    private:     true,
  },
  {
    extension:   ".aoslaw",
    label:       "AOS Law / Constitutional Amendment",
    description: "AveryOS Constitution amendment or sovereign law document.",
    private:     true,
  },
  {
    extension:   ".vccaps",
    label:       "VaultChain Capsule",
    description: "Permanent VaultChain™ capsule — immutable ledger entry.",
    private:     true,
  },
  {
    extension:   ".aosmem",
    label:       "AOS Memory",
    description: "High-precision sovereign memory log.",
    private:     true,
  },
  {
    extension:   ".aoscsp",
    label:       "AOS Capsule Schema / Spec",
    description: "Capsule schema definition or specification file.",
    private:     true,
  },
  {
    extension:   ".aosvault",
    label:       "AOS Vault",
    description: "Encrypted sovereign vault file.",
    private:     true,
  },
  {
    extension:   ".aoskey",
    label:       "AOS Key",
    description: "Sovereign cryptographic key material.",
    private:     true,
  },
  {
    extension:   ".avery",
    label:       "Avery Sovereign File",
    description: "General sovereign file format authored by Jason Lee Avery (ROOT0).",
    private:     true,
  },
];

/**
 * Return the sovereign MIME type entry for the given file extension.
 * Returns `undefined` if the extension is not registered.
 */
export function getSovereignMimeType(extension: string): SovereignMimeType | undefined {
  const normalized = extension.startsWith(".") ? extension : `.${extension}`;
  return SOVEREIGN_MIME_TYPES.find((t) => t.extension === normalized);
}

/**
 * Returns the list of all private (gitignored) sovereign extensions.
 * Used by LeakGuard and .gitignore generation.
 */
export function getPrivateSovereignExtensions(): string[] {
  return SOVEREIGN_MIME_TYPES.filter((t) => t.private).map((t) => t.extension);
}

/**
 * Register a new sovereign MIME type at runtime (dynamic extension support).
 *
 * Intended to be called once at module initialization time only, not during
 * concurrent request handling.  Cloudflare Workers run single-threaded within
 * each isolate, so there is no in-flight concurrency risk during a single
 * request; however, this function should not be called from within hot
 * request paths to avoid non-deterministic ordering across isolate restarts.
 *
 * Throws if the extension is already registered.
 */
export function registerSovereignMimeType(entry: SovereignMimeType): void {
  const existing = getSovereignMimeType(entry.extension);
  if (existing) {
    throw new Error(
      `Sovereign MIME type '${entry.extension}' is already registered as '${existing.label}'.`,
    );
  }
  SOVEREIGN_MIME_TYPES.push(entry);
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Category labels for classifying invention types */
export type InventionCategory =
  | "CRYPTOGRAPHIC_PROTOCOL"
  | "SOVEREIGN_ENFORCEMENT"
  | "BILLING_ENGINE"
  | "IDENTITY_FINGERPRINT"
  | "CAPSULE_SCHEMA"
  | "FORENSIC_ALGORITHM"
  | "AI_ALIGNMENT"
  | "LEGAL_FRAMEWORK"
  | "GENERAL";

/** A single inventionCapsule — immutable sovereign invention record */
export interface InventionCapsule {
  /** Unique invention identifier (SHA-512 of payload, first 32 hex chars) */
  invention_id:   string;
  /** Human-readable name of the invention */
  name:           string;
  /** Brief description of the logic block */
  description:    string;
  /** Category classification */
  category:       InventionCategory;
  /** Source file path (relative to repo root) */
  source_path:    string;
  /** ISO-9 microsecond-precision creation timestamp */
  created_at:     string;
  /** Full SHA-512 fingerprint of the invention payload */
  sha512:         string;
  /** ROOT0 authorship seal */
  author:         "Jason Lee Avery (ROOT0)";
  /** Sovereign Kernel SHA link */
  kernel_sha:     string;
  /** Kernel version at time of creation */
  kernel_version: string;
  /** Public disclosure URL */
  disclosure_url: string;
  /** Settlement status for IP tracking */
  settlement_status: "OPEN" | "LICENSED" | "ARCHIVED";
}

/** Options for building an invention capsule */
export interface InventionInput {
  /** Human-readable name of the invention */
  name:         string;
  /** Brief description of the logic block */
  description:  string;
  /** Category classification */
  category?:    InventionCategory;
  /** Source file path (relative to repo root) */
  source_path:  string;
  /** Optional extra metadata included in the SHA-512 payload */
  metadata?:    Record<string, unknown>;
}

/** Archive of multiple invention capsules */
export interface InventionArchive {
  /** ISO-9 timestamp of when the archive was built */
  built_at:        string;
  /** Kernel version at time of archiving */
  kernel_version:  string;
  /** Total number of inventions indexed */
  total:           number;
  /** All invention capsules in this archive */
  inventions:      InventionCapsule[];
  /** SHA-512 fingerprint of the entire archive payload */
  archive_sha512:  string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Compute SHA-512 hex digest of a UTF-8 string using the Web Crypto API.
 * Runs in both Node.js ≥ 20 (globalThis.crypto) and Cloudflare Workers.
 */
async function sha512hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf = await globalThis.crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a single invention capsule for a unique logic block.
 *
 * The SHA-512 is computed over a deterministic JSON payload that includes
 * the invention name, description, source path, kernel SHA, and timestamp.
 * This ensures every capsule is cryptographically unique and tamper-evident.
 */
export async function trackInvention(
  input: InventionInput,
): Promise<InventionCapsule> {
  const createdAt = formatIso9(new Date());

  const payload = JSON.stringify({
    name:          input.name,
    description:   input.description,
    source_path:   input.source_path,
    category:      input.category ?? "GENERAL",
    metadata:      input.metadata ?? null,
    kernel_sha:    KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    created_at:    createdAt,
    author:        "Jason Lee Avery (ROOT0)",
  });

  const sha512 = await sha512hex(payload);
  const inventionId = sha512.slice(0, 32);

  return {
    invention_id:      inventionId,
    name:              input.name,
    description:       input.description,
    category:          input.category ?? "GENERAL",
    source_path:       input.source_path,
    created_at:        createdAt,
    sha512,
    author:            "Jason Lee Avery (ROOT0)",
    kernel_sha:        KERNEL_SHA,
    kernel_version:    KERNEL_VERSION,
    disclosure_url:    DISCLOSURE_MIRROR_PATH,
    settlement_status: "OPEN",
  };
}

/**
 * Build an immutable archive of multiple invention capsules.
 *
 * The archive SHA-512 is computed over all capsule IDs and the build
 * timestamp, forming a Merkle-style fingerprint for the entire archive.
 */
export async function buildInventionArchive(
  inventions: InventionCapsule[],
): Promise<InventionArchive> {
  const builtAt = formatIso9(new Date());

  const archivePayload = JSON.stringify({
    built_at:       builtAt,
    kernel_version: KERNEL_VERSION,
    invention_ids:  inventions.map((c) => c.invention_id),
  });

  const archiveSha512 = await sha512hex(archivePayload);

  return {
    built_at:       builtAt,
    kernel_version: KERNEL_VERSION,
    total:          inventions.length,
    inventions,
    archive_sha512: archiveSha512,
  };
}

/**
 * Convenience helper — track a batch of inventions and return a signed archive.
 *
 * Processes each input sequentially to preserve deterministic ordering.
 */
export async function trackAndArchiveInventions(
  inputs: InventionInput[],
): Promise<InventionArchive> {
  const capsules: InventionCapsule[] = [];
  for (const input of inputs) {
    capsules.push(await trackInvention(input));
  }
  return buildInventionArchive(capsules);
}
