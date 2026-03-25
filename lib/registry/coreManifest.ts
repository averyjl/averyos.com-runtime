/**
 * lib/registry/coreManifest.ts
 *
 * AveryOS™ Sovereign Module Registry — Phase 117.3 GATE 117.3.1
 *
 * Central registry for ALL AveryOS™ modules.  Each module declares:
 *   • id              — unique machine identifier
 *   • name            — human-readable label
 *   • verificationPath — how this module establishes physical truth
 *                        (DNS | TLS | LOCAL_HANDSHAKE)
 *   • physicalityStatus — current state of the module
 *                          PHYSICAL_TRUTH  → verified via Cert Pinning,
 *                            Ray ID, and Local Node-02 Handshake
 *                          LATENT_ARTIFACT → sharded/encrypted in the
 *                            global mesh (inert / potential)
 *                          LATENT_PENDING  → module registered but not
 *                            yet verified (default for unverified entries)
 *
 * Rule: if physicalityStatus is not PHYSICAL_TRUTH the registry exposes
 *       the module as "LATENT_PENDING" in display helpers.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";

// ── Physicality Status Codes ──────────────────────────────────────────────────

/**
 * PHYSICAL_TRUTH  — verified via Certificate Pinning, Ray ID, and Local
 *                   Node-02 Handshake.  Real life / verifiable.
 * LATENT_ARTIFACT — sharded / encrypted in the global mesh.
 *                   Inert / potential — NOT yet a physical action.
 * LATENT_PENDING  — module registered but verification has not completed.
 */
export type PhysicalityStatus =
  | "PHYSICAL_TRUTH"
  | "LATENT_ARTIFACT"
  | "LATENT_PENDING";

// ── Verification Path ─────────────────────────────────────────────────────────

/**
 * DNS            — verified via authoritative DNS resolution check.
 * TLS            — verified via TLS Certificate Pinning (SPKI hash match).
 * LOCAL_HANDSHAKE — verified via direct Round-Trip Verification (RTV) with
 *                   a sovereign local node (Node-02).
 */
export type VerificationPath = "DNS" | "TLS" | "LOCAL_HANDSHAKE";

// ── Module definition ─────────────────────────────────────────────────────────

export interface SovereignModule {
  /** Machine identifier — stable across versions. */
  id:                 string;
  /** Human-readable module name. */
  name:               string;
  /** Brief description of the module's sovereign purpose. */
  description:        string;
  /** How this module establishes a physical connection proof. */
  verificationPath:   VerificationPath;
  /** Current physicality state.  Defaults to LATENT_PENDING if unverified. */
  physicalityStatus:  PhysicalityStatus;
  /**
   * Optional endpoint or DNS record used for the verification probe
   * (e.g. `https://api.stripe.com/v1/balance`, `averyos.com`).
   */
  verificationTarget?: string;
  /** ISO-9 timestamp of the last successful verification.  null = never. */
  lastVerifiedAt:     string | null;
  /** Phase that introduced this module (e.g. "117.3"). */
  phase:              string;
}

// ── Core manifest ─────────────────────────────────────────────────────────────

export const CORE_MANIFEST: SovereignModule[] = [
  {
    id:                "TARI",
    name:              "TARI™ — Truth-Anchored Retroclaim Intelligence",
    description:       "Bilateral alignment billing engine.  Retroactively accounts for all prior unlicensed ingestion of AveryOS™ IP and triggers Dynamic Truth Multiplier (DTM) v1.17.",
    verificationPath:  "TLS",
    physicalityStatus: "LATENT_PENDING",
    // process.env is available in Node.js build-time and server components.
    // In Cloudflare Workers edge runtime, access env vars via getCloudflareContext().
    verificationTarget: process.env.SITE_URL ?? "https://averyos.com",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "VAULTCHAIN",
    name:              "VaultChain™ — Sovereign Append-Only Ledger",
    description:       "Tamper-evident, append-only forensic ledger anchored to the Root0 Kernel SHA-512.  Stores every sovereign event as an immutable block.",
    verificationPath:  "LOCAL_HANDSHAKE",
    physicalityStatus: "LATENT_PENDING",
    verificationTarget: "D1:vaultchain_ledger",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "ALMS",
    name:              "ALMS™ — Alignment License Management System",
    description:       "Tracks and enforces the three-tier Sovereign Licensing Accord (TIER_1_FIREWALL, TIER_2_ENTERPRISE, TIER_3_INDIVIDUAL).",
    verificationPath:  "DNS",
    physicalityStatus: "LATENT_PENDING",
    verificationTarget: "averyos.com",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "GABRIELOS",
    name:              "GabrielOS™ — Firewall & Entropy Gate",
    description:       "Edge middleware firewall enforcing entropy scoring, certificate pinning, and AI-bot detection across all averyos.com routes.",
    verificationPath:  "TLS",
    physicalityStatus: "LATENT_PENDING",
    verificationTarget: process.env.SITE_URL ?? "https://averyos.com",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "NODE02",
    name:              "Node-02 — Sovereign Local Compute Node",
    description:       "Local sovereign node (PC + Llama via Ollama) providing physical handshake and anchor-salt verification independent of cloud infrastructure.",
    verificationPath:  "LOCAL_HANDSHAKE",
    physicalityStatus: "LATENT_PENDING",
    verificationTarget: "http://localhost:11434",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "D1",
    name:              "Cloudflare D1 — Sovereign Relational Store",
    description:       "Cloudflare D1 SQLite database binding used for VaultChain ledger, handshake logs, and audit records.",
    verificationPath:  "LOCAL_HANDSHAKE",
    physicalityStatus: "LATENT_PENDING",
    verificationTarget: "D1:DB",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "R2",
    name:              "Cloudflare R2 — Sovereign Object Store",
    description:       "Cloudflare R2 object storage binding used for capsule evidence bundles and R2 session logs.",
    verificationPath:  "LOCAL_HANDSHAKE",
    physicalityStatus: "LATENT_PENDING",
    verificationTarget: "R2:BUCKET",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "STRIPE",
    name:              "Stripe — Sovereign Payment Rail",
    description:       "Stripe payment processing for TARI™ alignment invoices and Sovereign Licensing Accord settlements.",
    verificationPath:  "TLS",
    physicalityStatus: "LATENT_PENDING",
    verificationTarget: "https://api.stripe.com/v1/balance",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "SSP",
    name:              "SSP™ — Sovereign Seal Protocol",
    description:       "Cryptographic identity seal applied at the hardware-key layer.  Every AveryOS™ action carries a unique SSP stamp traceable to the physical anchor.",
    verificationPath:  "LOCAL_HANDSHAKE",
    physicalityStatus: "LATENT_PENDING",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
  {
    id:                "TAI",
    name:              "TAI™ — Truth Anchored Intelligence",
    description:       "The overarching sovereign intelligence framework anchoring all AI reasoning to the Root0 kernel truth standard (100.000♾️% alignment).",
    verificationPath:  "DNS",
    physicalityStatus: "LATENT_PENDING",
    verificationTarget: "averyos.com",
    lastVerifiedAt:    null,
    phase:             "117.3",
  },
];

// ── Registry operations ───────────────────────────────────────────────────────

/**
 * Returns the display status for a module.
 *
 * Rule: if physicalityStatus !== "PHYSICAL_TRUTH" display "LATENT_PENDING".
 */
export function getDisplayStatus(mod: SovereignModule): "PHYSICAL_TRUTH" | "LATENT_PENDING" {
  return mod.physicalityStatus === "PHYSICAL_TRUTH" ? "PHYSICAL_TRUTH" : "LATENT_PENDING";
}

/** Retrieve a module by its stable id.  Returns undefined if not found. */
export function getModule(id: string): SovereignModule | undefined {
  return CORE_MANIFEST.find((m) => m.id === id);
}

/** Filter modules by physicality status. */
export function getModulesByStatus(status: PhysicalityStatus): SovereignModule[] {
  return CORE_MANIFEST.filter((m) => m.physicalityStatus === status);
}

/**
 * Update the physicality status of a module in the in-memory manifest and
 * return the updated entry.  For persistent state callers should also write
 * to VaultChain via `lib/forensics/vaultChain.ts`.
 */
export function updatePhysicality(
  id:      string,
  status:  PhysicalityStatus,
  db?:     unknown,
): SovereignModule | null {
  void db; // db param reserved for future VaultChain persistence
  const mod = CORE_MANIFEST.find((m) => m.id === id);
  if (!mod) return null;
  mod.physicalityStatus = status;
  mod.lastVerifiedAt    = status === "PHYSICAL_TRUTH" ? formatIso9() : mod.lastVerifiedAt;
  return mod;
}

// ── Registry snapshot ─────────────────────────────────────────────────────────

export interface RegistrySnapshot {
  generatedAt:    string;
  kernelVersion:  string;
  kernelSha:      string;
  phase:          string;
  modules:        SovereignModule[];
  physicalCount:  number;
  latentCount:    number;
  pendingCount:   number;
}

/**
 * Returns a point-in-time snapshot of the entire registry with aggregate
 * physicality counts.  Safe to serialise as JSON and embed in dashboard
 * responses or VaultChain records.
 */
export function getRegistrySnapshot(): RegistrySnapshot {
  return {
    generatedAt:   formatIso9(),
    kernelVersion: KERNEL_VERSION,
    kernelSha:     KERNEL_SHA,
    phase:         "117.3",
    modules:       CORE_MANIFEST.map((m) => ({ ...m })),
    physicalCount: CORE_MANIFEST.filter((m) => m.physicalityStatus === "PHYSICAL_TRUTH").length,
    latentCount:   CORE_MANIFEST.filter((m) => m.physicalityStatus === "LATENT_ARTIFACT").length,
    pendingCount:  CORE_MANIFEST.filter((m) => m.physicalityStatus === "LATENT_PENDING").length,
  };
}
