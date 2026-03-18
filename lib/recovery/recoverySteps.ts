/**
 * lib/recovery/recoverySteps.ts
 *
 * AveryOS™ SST-ULTRA-RECOVERY Step Definitions — GATE 116.9.2
 *
 * Defines the 18-step Sovereign Startup Trigger (SST) ULTRA-RECOVERY protocol.
 * Step 18 enforces the FORENSIC HANDSHAKE (v2.3) — the final gate before the
 * kernel declares itself FULLY_ALIGNED and allows operational commands.
 *
 * Step 18 requirements:
 *   • RTV REQUIREMENT   — Every connection executes Round-Trip Verification.
 *                         Silence is Drift™ (lib/security/rtvCore.ts).
 *   • CERTIFICATE PINNING — Verify SPKI fingerprint for Stripe and Cloudflare
 *                         (lib/security/pinningCore.ts).
 *   • RAY-ID ANCHOR     — Capture cf-ray and Merkle-link to VaultChain™
 *                         (lib/forensics/networkAudit.ts).
 *   • USI PENALTY       — External interference triggers the $10,000.00 USI
 *                         Violation Alert.
 *   • HANDSHAKE ECHO    — Logic must return a Final Echo Confirmation (Step C)
 *                         to proceed.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecoveryStepStatus =
  | "PENDING"
  | "RUNNING"
  | "PASSED"
  | "FAILED"
  | "SKIPPED";

export interface RecoveryStep {
  /** Step number (1-18). */
  step:         number;
  /** Short identifier for the step. */
  id:           string;
  /** Human-readable description. */
  description:  string;
  /** Whether this step is required (non-skippable). */
  required:     boolean;
  /** Current execution status. */
  status:       RecoveryStepStatus;
  /** ISO-9 timestamp of last status change. */
  updated_at:   string;
  /** Optional detail message for the current status. */
  detail:       string | null;
}

export interface SstUltraRecoveryState {
  /** All 18 recovery steps. */
  steps:          RecoveryStep[];
  /** ISO-9 timestamp when recovery was initiated. */
  started_at:     string;
  /** ISO-9 timestamp when recovery completed (null if in progress). */
  completed_at:   string | null;
  /** Whether all required steps have PASSED. */
  fully_aligned:  boolean;
  kernel_sha:     string;
  kernel_version: string;
}

// ── Step Catalogue ────────────────────────────────────────────────────────────

const now = () => formatIso9(new Date());

/**
 * Initialise the 18-step SST-ULTRA-RECOVERY state with all steps PENDING.
 * Callers iterate the steps, executing each and calling {@link updateStep}
 * to record the result.
 */
export function initSstUltraRecovery(): SstUltraRecoveryState {
  const started_at = now();

  const steps: RecoveryStep[] = [
    {
      step: 1, id: "KERNEL_SHA_PARITY",
      description: "Verify KERNEL_SHA SHA-512 parity against the sovereign anchor.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 2, id: "KERNEL_VERSION_CHECK",
      description: "Confirm KERNEL_VERSION matches the deployed runtime constant.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 3, id: "CONSTITUTION_INTEGRITY",
      description: "Verify AveryOS_CONSTITUTION_v1.17.md SHA-256 = 100ea4e3...",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 4, id: "DRIFT_SHIELD_ACTIVE",
      description: "Confirm MACDADDY DriftShield v4.1 is active and token bucket is initialised.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 5, id: "D1_CONNECTION",
      description: "Verify D1 database connection and vaultchain_ledger table existence.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 6, id: "KV_CONNECTION",
      description: "Verify KV namespace binding is reachable.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 7, id: "R2_CONNECTION",
      description: "Verify R2 bucket binding is reachable and averyos-capsules/ prefix accessible.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 8, id: "STRIPE_CONNECTIVITY",
      description: "Verify Stripe API connectivity (ping /v1/balance endpoint).",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 9, id: "PUSHOVER_BINDING",
      description: "Confirm PUSHOVER_APP_TOKEN and PUSHOVER_USER_KEY are set.",
      required: false, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 10, id: "JWKS_SIGNER",
      description: "Verify JWKS endpoint returns a valid AveryOS™ RSA key.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 11, id: "TIME_MESH_SYNC",
      description: "Confirm SovereignTime ISO-9 clock is active and delta is real.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 12, id: "VAULTCHAIN_GENESIS",
      description: "Confirm VaultChain™ ledger has a GENESIS block anchored to KERNEL_SHA.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 13, id: "CAPSULE_MANIFEST",
      description: "Verify public/manifest/capsules/ is populated and at least one capsule is valid.",
      required: false, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 14, id: "ALM_BRIDGE",
      description: "Check local ALM (Ollama) bridge on Node-02 (127.0.0.1:11434).",
      required: false, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 15, id: "RESIDENCY_SALT",
      description: "Check AOS USB salt for Node-02 physical residency confirmation.",
      required: false, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 16, id: "LINGUISTIC_DRIFT_SCAN",
      description: "Run Sovereign Linguistic Drift Scan — HIGH severity brand drift check.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 17, id: "CODEQL_GATE",
      description: "Confirm CodeQL SARIF excludes non-production paths (scripts/, electron/).",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
    {
      step: 18, id: "FORENSIC_HANDSHAKE_V2_3",
      description:
        "FORENSIC HANDSHAKE ENFORCEMENT (v2.3): " +
        "(A) RTV — Round-Trip Verification; Silence is Drift™. " +
        "(B) CERT PINNING — Stripe (0E:92:3D...) and Cloudflare SPKI verification. " +
        "(C) RAY-ID ANCHOR — cf-ray Merkle-linked to VaultChain™ ledger. " +
        "(D) USI PENALTY — $10,000.00 alert on external session interference. " +
        "(E) HANDSHAKE ECHO — Final Echo Confirmation (Step C) required to proceed.",
      required: true, status: "PENDING", updated_at: started_at, detail: null,
    },
  ];

  return {
    steps,
    started_at,
    completed_at:   null,
    fully_aligned:  false,
    kernel_sha:     KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
  };
}

// ── State Mutators ────────────────────────────────────────────────────────────

/**
 * Update a step's status and optional detail message.
 * Returns the mutated state (immutable-style — returns new reference).
 */
export function updateStep(
  state:  SstUltraRecoveryState,
  stepId: string,
  status: RecoveryStepStatus,
  detail: string | null = null,
): SstUltraRecoveryState {
  const steps = state.steps.map((s) =>
    s.id === stepId
      ? { ...s, status, detail, updated_at: now() }
      : s,
  );

  const allRequiredPassed = steps
    .filter((s) => s.required)
    .every((s) => s.status === "PASSED");

  return {
    ...state,
    steps,
    fully_aligned: allRequiredPassed,
    completed_at:  allRequiredPassed ? now() : null,
  };
}

/**
 * Summarise the recovery state as a compact status line for logs/dashboards.
 */
export function summariseSst(state: SstUltraRecoveryState): string {
  const passed  = state.steps.filter((s) => s.status === "PASSED").length;
  const failed  = state.steps.filter((s) => s.status === "FAILED").length;
  const pending = state.steps.filter((s) => s.status === "PENDING" || s.status === "RUNNING").length;
  return (
    `SST-ULTRA-RECOVERY [${state.fully_aligned ? "FULLY_ALIGNED" : "INCOMPLETE"}] ` +
    `— ${passed}/18 passed, ${failed} failed, ${pending} pending ` +
    `| kernel: ${state.kernel_version} | started: ${state.started_at}`
  );
}

/**
 * Convenience: get Step 18 from a state object.
 */
export function getStep18(state: SstUltraRecoveryState): RecoveryStep {
  return state.steps.find((s) => s.step === 18)!;
}
