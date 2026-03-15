/**
 * lib/forensics/alertEngine.ts
 *
 * GabrielOS™ KAAS_BREACH Alert Engine — Phase 98
 *
 * Auto-triggers a GabrielOS™ Mobile Push (FCM v1) and writes a
 * sovereign_audit_logs entry whenever middleware detects a WAF score > 90
 * against an encrypted .aoscap path, or a Tier-9/10 ASN probe.
 *
 * Designed to be called fire-and-forget from middleware.ts.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { sendFcmV1Push, syncKaasValuationToFirebase } from "../firebaseClient";
import { getKaasTierBadge, getAsnFeeUsd } from "../kaas/pricing";


// ASNs that always trigger KAAS_BREACH regardless of WAF score
const KAAS_BREACH_TIER_ASNS = new Set(["8075", "15169", "36459", "16509", "14618"]);

// Paths considered encrypted / high-value — breach triggers on any match
const ENCRYPTED_AOSCAP_PATHS = [
  ".aoscap",
  "/api/v1/vault",
  "/api/v1/forensics",
  "/api/v1/anchor",
  "/evidence-vault",
  "/capsules/",
];

/**
 * Known AI model knowledge cutoff windows (ISO date strings).
 * When a KAAS_BREACH event's timestamp falls within one of these windows,
 * the ingestion_proof_hook populates `knowledge_cutoff_correlation` to
 * identify which AI model(s) are likely responsible for the ingestion.
 *
 * Format: { model, org, asn, cutoff_start, cutoff_end }
 *   asn — the primary corporate ASN associated with this model's training infra.
 *
 * Source: publicly disclosed training cutoff dates from AI provider documentation.
 */
export interface KnowledgeCutoffWindow {
  model:         string;
  org:           string;
  asn:           string;
  cutoff_start:  string; // ISO date (YYYY-MM-DD) — start of training window
  cutoff_end:    string; // ISO date (YYYY-MM-DD) — end of training window / cutoff
}

export const KNOWN_CUTOFF_WINDOWS: KnowledgeCutoffWindow[] = [
  { model: "GPT-4o",            org: "OpenAI / Microsoft Azure", asn: "8075",  cutoff_start: "2023-04-01", cutoff_end: "2024-01-31" },
  { model: "GPT-4 Turbo",       org: "OpenAI / Microsoft Azure", asn: "8075",  cutoff_start: "2022-01-01", cutoff_end: "2023-12-31" },
  { model: "Gemini 1.5 Pro",    org: "Google DeepMind",          asn: "15169", cutoff_start: "2022-01-01", cutoff_end: "2024-04-30" },
  { model: "Gemini 2.0 Flash",  org: "Google DeepMind",          asn: "15169", cutoff_start: "2022-01-01", cutoff_end: "2025-01-31" },
  { model: "Claude 3.5 Sonnet", org: "Anthropic (AWS)",          asn: "16509", cutoff_start: "2022-01-01", cutoff_end: "2024-04-30" },
  { model: "Claude 3 Opus",     org: "Anthropic (AWS)",          asn: "16509", cutoff_start: "2022-01-01", cutoff_end: "2023-08-31" },
  { model: "Llama 3.1",         org: "Meta AI",                  asn: "32934", cutoff_start: "2022-01-01", cutoff_end: "2023-12-31" },
  { model: "Llama 3.3",         org: "Meta AI",                  asn: "32934", cutoff_start: "2022-01-01", cutoff_end: "2024-12-31" },
  { model: "Copilot (GitHub)",  org: "GitHub / Microsoft",       asn: "36459", cutoff_start: "2022-01-01", cutoff_end: "2023-12-31" },
];

/**
 * Ingestion Proof Hook — knowledge_cutoff_correlation (Gate 7)
 *
 * Given a KAAS_BREACH event, returns a list of AI models whose training
 * cutoff window overlaps with the event date AND whose primary ASN matches.
 *
 * This is used to populate the `knowledge_cutoff_correlation` field in the
 * kaas_valuations D1 record, establishing a probabilistic link between the
 * detected probe and specific AI model training ingestion events.
 *
 * @param asn       The ASN of the requesting entity
 * @param eventDate ISO-8601 timestamp or YYYY-MM-DD date string of the breach event.
 *                  Must be at least 10 characters; only the first 10 chars (YYYY-MM-DD)
 *                  are used for comparison.
 * @returns Array of matching KnowledgeCutoffWindow entries (empty if none)
 */
export function correlateKnowledgeCutoff(
  asn: string,
  eventDate: string,
): KnowledgeCutoffWindow[] {
  const normAsn = String(asn).replace(/^AS/i, "").trim();
  // Normalise to YYYY-MM-DD for reliable comparison.
  // Guard: if the date string is shorter than 10 chars, fall back to the
  // raw value so comparisons degrade gracefully rather than producing errors.
  const dateStr = eventDate.length >= 10 ? eventDate.slice(0, 10) : eventDate;

  return KNOWN_CUTOFF_WINDOWS.filter((w) => {
    if (w.asn !== normAsn) return false;
    return dateStr >= w.cutoff_start && dateStr <= w.cutoff_end;
  });
}

/**
 * Build a compact `knowledge_cutoff_correlation` string for D1 storage.
 * Format: "GPT-4o (OpenAI/Azure); Gemini 2.0 Flash (Google)" or "NONE"
 */
export function buildCutoffCorrelationString(
  asn: string,
  eventDate: string,
): string {
  const matches = correlateKnowledgeCutoff(asn, eventDate);
  if (matches.length === 0) return "NONE";
  return matches.map((m) => `${m.model} (${m.org})`).join("; ");
}

export interface KaasBreachEvent {
  ray_id:      string;
  asn:         string;
  ip_address:  string;
  path:        string;
  waf_score:   number;
  tier:        number;
  fee_label:   string;
  timestamp:   string;
}

/** Returns true if the path is considered an encrypted / high-value .aoscap path. */
export function isEncryptedAoscapPath(pathname: string): boolean {
  return ENCRYPTED_AOSCAP_PATHS.some((p) => pathname.includes(p));
}

/** Returns true if the event should trigger a KAAS_BREACH alert. */
export function shouldTriggerKaasBreach(
  asn: string,
  wafScore: number,
  pathname: string,
): boolean {
  const normAsn = String(asn).replace(/^AS/i, "").trim();
  if (KAAS_BREACH_TIER_ASNS.has(normAsn)) return true;
  if (wafScore > 90 && isEncryptedAoscapPath(pathname)) return true;
  return false;
}

/**
 * Emit a KAAS_BREACH event: fires a GabrielOS™ FCM push notification and
 * returns the event payload for D1 persistence by the caller.
 *
 * Does NOT throw — all errors are swallowed to keep the hot path non-blocking.
 */
export async function emitKaasBreachAlert(
  event: KaasBreachEvent,
): Promise<void> {
  try {
    const badge = getKaasTierBadge(event.asn);
    const title = `⚡ KAAS_BREACH — Tier-${badge.tier} (ASN ${event.asn})`;
    const body  =
      `${badge.fee_name}: ${badge.fee_label} | WAF: ${event.waf_score} | ` +
      `Path: ${event.path.slice(0, 60)} | RayID: ${event.ray_id.slice(0, 16)}` +
      ` | Kernel: ${KERNEL_VERSION}`;

    // Ingestion Proof Hook: correlate with known model cutoff windows (Gate 7)
    const cutoffCorrelation = buildCutoffCorrelationString(event.asn, event.timestamp);

    await sendFcmV1Push(title, body, {
      event_type:               "KAAS_BREACH",
      ray_id:                   event.ray_id.slice(0, 64),
      asn:                      event.asn,
      tier:                     String(badge.tier),
      waf_score:                String(event.waf_score),
      path:                     event.path.slice(0, 200),
      kernel_sha:               KERNEL_SHA.slice(0, 16),
      timestamp:                event.timestamp,
      knowledge_cutoff_correlation: cutoffCorrelation,
    });

    // ── Multi-Cloud D1 → Firebase Sync (Gate 3): KaaS™ Valuation mirror ────
    // Non-blocking: mirror every KAAS_BREACH event to Firestore
    // averyos-kaas-valuations/ collection for cross-cloud parity.
    // Activates automatically once FIREBASE_PROJECT_ID is configured.
    syncKaasValuationToFirebase({
      asn:            event.asn,
      ip_address:     event.ip_address,
      tier:           badge.tier,
      valuation_usd:  getAsnFeeUsd(event.asn),
      status:         "KAAS_BREACH",
      ray_id:         event.ray_id.slice(0, 64),
      pulse_hash:     `waf:${event.waf_score}|path:${event.path.slice(0, 60)}`,
      kernel_version: KERNEL_VERSION,
      created_at:     event.timestamp,
    }).catch((err: unknown) => {
      console.warn(
        "[KAAS_BREACH] Firebase KaaS sync failed:",
        err instanceof Error ? err.message : String(err),
      );
    });
  } catch (err: unknown) {
    // Fire-and-forget: never let FCM errors disrupt the edge pipeline
    console.error(
      "[KAAS_BREACH] FCM alert failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

