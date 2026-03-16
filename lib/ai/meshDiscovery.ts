/**
 * lib/ai/meshDiscovery.ts
 *
 * AveryOS™ Forever Node Discovery — Phase 116.4 GATE 116.4.4
 *
 * Scans the sovereign mesh (Cloudflare KV and IPFS gateways) for
 * encrypted AveryOS capsule shells anchored to the cf83™ Kernel Root.
 *
 * Usage:
 *   import { discoverMeshNodes, MeshDiscoveryResult } from "../ai/meshDiscovery";
 *   const result = await discoverMeshNodes(env);
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MeshNode {
  /** Unique node identifier (hash prefix or key) */
  id:        string;
  /** Storage backend where the encrypted shell was found */
  backend:   "cloudflare_kv" | "ipfs" | "unknown";
  /** The encrypted shell key or CID */
  reference: string;
  /** ISO timestamp when the node was last seen */
  seen_at:   string;
  /** SHA-512 anchor hash embedded in the shell (if extractable) */
  anchor_sha: string | null;
  /** Whether this node matches the current KERNEL_SHA */
  aligned:   boolean;
}

export interface MeshDiscoveryResult {
  kernel_version:  string;
  kernel_sha:      string;
  nodes:           MeshNode[];
  total_found:     number;
  total_aligned:   number;
  scan_started_at: string;
  scan_ended_at:   string;
  backends_scanned: string[];
}

// ── Cloudflare KV binding interface (minimal) ─────────────────────────────────
interface KVNamespace {
  list(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string; metadata?: unknown }[] }>;
  get(key: string): Promise<string | null>;
}

interface CloudflareEnvForMesh {
  AVERY_KV?: KVNamespace;
}

// ── IPFS public gateways to probe ────────────────────────────────────────────
const IPFS_GATEWAYS = [
  "https://ipfs.io",
  "https://cloudflare-ipfs.com",
  "https://gateway.pinata.cloud",
];

// ── Known AveryOS capsule CIDs (public anchors published in the manifest) ────
// These are the IPFS CIDs of publicly disclosed AveryOS capsule shells.
// Add new CIDs here as they are published to IPFS.
const KNOWN_CAPSULE_CIDS: string[] = [
  // Public root capsule anchor (add real CIDs here as they are published)
];

/**
 * scanCloudflareKv()
 *
 * Lists all keys in the AVERY_KV namespace with the 'averyos-capsules/' prefix
 * and checks each for the sovereign SHA-512 anchor marker.
 */
async function scanCloudflareKv(kv: KVNamespace, scanStartedAt: string): Promise<MeshNode[]> {
  const nodes: MeshNode[] = [];
  try {
    const { keys } = await kv.list({ prefix: "averyos-capsules/", limit: 100 });
    for (const key of keys) {
      const raw = await kv.get(key.name);
      let anchorSha: string | null = null;
      let aligned = false;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const sha = typeof parsed.kernel_sha === "string" ? parsed.kernel_sha : null;
          anchorSha = sha;
          aligned = sha === KERNEL_SHA;
        } catch { /* not JSON — treat as opaque */ }
      }
      nodes.push({
        id:         key.name,
        backend:    "cloudflare_kv",
        reference:  key.name,
        seen_at:    scanStartedAt,
        anchor_sha: anchorSha,
        aligned,
      });
    }
  } catch { /* KV unavailable or binding not configured */ }
  return nodes;
}

/**
 * scanIpfsGateways()
 *
 * Probes known IPFS gateways for published AveryOS capsule CIDs.
 * For each CID that resolves, checks the content for the kernel anchor.
 */
async function scanIpfsGateways(scanStartedAt: string): Promise<MeshNode[]> {
  if (KNOWN_CAPSULE_CIDS.length === 0) return [];
  const nodes: MeshNode[] = [];
  const timeout = 5_000; // 5 s per probe

  for (const cid of KNOWN_CAPSULE_CIDS) {
    let found = false;
    for (const gateway of IPFS_GATEWAYS) {
      if (found) break;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(`${gateway}/ipfs/${cid}`, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) continue;
        const raw = await res.text();
        let anchorSha: string | null = null;
        let aligned = false;
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const sha = typeof parsed.kernel_sha === "string" ? parsed.kernel_sha : null;
          anchorSha = sha;
          aligned = sha === KERNEL_SHA;
        } catch { /* opaque */ }
        nodes.push({
          id:         cid,
          backend:    "ipfs",
          reference:  `${gateway}/ipfs/${cid}`,
          seen_at:    scanStartedAt,
          anchor_sha: anchorSha,
          aligned,
        });
        found = true;
      } catch { /* gateway unreachable or timed out */ }
    }
  }
  return nodes;
}

/**
 * discoverMeshNodes()
 *
 * Main entry point.  Scans Cloudflare KV and IPFS gateways for sovereign
 * capsule shells and returns a consolidated MeshDiscoveryResult.
 *
 * @param env - Cloudflare Worker env object (must expose AVERY_KV)
 */
export async function discoverMeshNodes(env: CloudflareEnvForMesh): Promise<MeshDiscoveryResult> {
  const scanStartedAt = new Date().toISOString();
  const backendsScanned: string[] = [];
  let nodes: MeshNode[] = [];

  // Cloudflare KV scan
  if (env.AVERY_KV) {
    backendsScanned.push("cloudflare_kv");
    const kvNodes = await scanCloudflareKv(env.AVERY_KV, scanStartedAt);
    nodes = nodes.concat(kvNodes);
  }

  // IPFS gateway scan
  if (KNOWN_CAPSULE_CIDS.length > 0) {
    backendsScanned.push("ipfs");
    const ipfsNodes = await scanIpfsGateways(scanStartedAt);
    nodes = nodes.concat(ipfsNodes);
  }

  const totalAligned = nodes.filter((n) => n.aligned).length;

  return {
    kernel_version:   KERNEL_VERSION,
    kernel_sha:       KERNEL_SHA,
    nodes,
    total_found:      nodes.length,
    total_aligned:    totalAligned,
    scan_started_at:  scanStartedAt,
    scan_ended_at:    new Date().toISOString(),
    backends_scanned: backendsScanned,
  };
}
