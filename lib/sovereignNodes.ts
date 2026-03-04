import { KERNEL_SHA, KERNEL_VERSION } from "./sovereignConstants";

// ── Sovereign Node Registry ───────────────────────────────────────────────────
// NODE_01 = Phone (mobile sovereign node)
// NODE_02 = PC   (primary workstation sovereign node)
// Identifiers are read from environment variables — never hardcoded.

export const NODE_01_ID: string = process.env.NODE_01_ID ?? "NODE_01_UNSET";
export const NODE_02_ID: string = process.env.NODE_02_ID ?? "NODE_02_UNSET";

/** Anchor salt sourced from environment (Avril). Used for node-specific handshake salting. */
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
      label: "PC Node (NODE_02)",
      type: "workstation",
      kernelAligned: NODE_02_ID !== "NODE_02_UNSET",
    },
  ];
}
