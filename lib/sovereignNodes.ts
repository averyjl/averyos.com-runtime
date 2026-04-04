/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { KERNEL_SHA, KERNEL_VERSION, OLLAMA_SYNC_STATUS_ACTIVE } from "./sovereignConstants";

// ── Sovereign Node Registry ───────────────────────────────────────────────────
// NODE_01 = Phone (mobile sovereign node)
// NODE_02 = PC   (primary workstation sovereign node — runs Llama via Ollama)
// Identifiers are read from environment variables — never hardcoded.

export const NODE_01_ID: string = process.env.NODE_01_ID ?? "NODE_01_UNSET";
export const NODE_02_ID: string = process.env.NODE_02_ID ?? "NODE_02_UNSET";

// ── NODE_02 Local LLM (Llama via Ollama) ─────────────────────────────────────
// The PC node runs a local Llama model via Ollama, anchored to the sovereign
// kernel. All local inference is subject to the same kernel alignment policy
// as cloud-hosted AI models (see AI_USAGE_POLICY.md).

/** The local model name to request from Ollama on NODE_02 (e.g. "llama3.3:70b") */
export const NODE_02_LOCAL_MODEL: string =
  process.env.NODE_02_LOCAL_MODEL ?? "llama3.3:70b";

/** Base URL of the Ollama server running on NODE_02 (default: localhost) */
export const NODE_02_OLLAMA_URL: string =
  process.env.NODE_02_OLLAMA_URL ?? "http://localhost:11434";

/** Anchor salt sourced from environment (AveryOS). Used for node-specific handshake salting. */
export const SOVEREIGN_ANCHOR_SALT: string =
  process.env.SOVEREIGN_ANCHOR_SALT ?? "";

// ── Golden Lock Artifact Reference ───────────────────────────────────────────
export const GOLDEN_LOCK_ARTIFACT_PATH =
  "VaultBridge/GoldenLockArtifact.lock.json";
export const GOLDEN_LOCK_MERKLE_ROOT =
  "88b737926219feb345804a22db4ae3fb2d5b21ca63686075ee04aace4d8ac4fe180289fe821a412944420ec9083b6a6a0e902fc8ac2e0325511cb7ab99ce2abe";
export const GOLDEN_LOCK_ARTIFACT_ID =
  "AveryOS_Golden_Lock_ColdStorage_2026-02-22";
export const SKC_VERSION = "SKC-2026.1";

// ── Cloudflare DNS TXT Anchor Verification ───────────────────────────────────
// averyos.com publishes sovereign kernel anchor values as DNS TXT records.
// These constants define the expected record names for verification.

export const DNS_TXT_KERNEL_RECORD = "_averyos-kernel.averyos.com";
export const DNS_TXT_MERKLE_RECORD = "_averyos-merkle.averyos.com";
export const DNS_TXT_VERSION_RECORD = "_averyos-version.averyos.com";

/** Expected TXT record value format for kernel anchor verification */
export interface DnsTxtAnchor {
  record: string;
  expected: string;
}

/** Returns the set of DNS TXT records that must match for full anchor verification */
export function getExpectedDnsTxtAnchors(): DnsTxtAnchor[] {
  return [
    { record: DNS_TXT_KERNEL_RECORD, expected: KERNEL_SHA },
    { record: DNS_TXT_MERKLE_RECORD, expected: GOLDEN_LOCK_MERKLE_ROOT },
    { record: DNS_TXT_VERSION_RECORD, expected: KERNEL_VERSION },
  ];
}

// ── Node Status ───────────────────────────────────────────────────────────────

export interface SovereignNodeStatus {
  nodeId: string;
  label: string;
  type: "mobile" | "workstation";
  kernelAligned: boolean;
  localModel?: string;
  ollamaUrl?: string;
  ollamaSyncStatus?: string;
}

/**
 * Returns the registered sovereign node descriptors.
 * Actual online/offline status is determined at runtime by the
 * Ollama sync heartbeat and the /api/v1/health endpoint.
 */
export function getSovereignNodes(): SovereignNodeStatus[] {
  return [
    {
      nodeId: NODE_01_ID,
      label: "Phone Node (NODE_01)",
      type: "mobile",
      kernelAligned: NODE_01_ID !== "NODE_01_UNSET",
    },
    {
      nodeId: NODE_02_ID,
      label: "PC Node (NODE_02) — Llama via Ollama",
      type: "workstation",
      kernelAligned: NODE_02_ID !== "NODE_02_UNSET",
      localModel: NODE_02_LOCAL_MODEL,
      ollamaUrl: NODE_02_OLLAMA_URL,
      ollamaSyncStatus: OLLAMA_SYNC_STATUS_ACTIVE,
    },
  ];
}
