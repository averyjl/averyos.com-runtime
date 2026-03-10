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
import { sendFcmV1Push } from "../firebaseClient";
import { getKaasTierBadge } from "../kaas/pricing";


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

    await sendFcmV1Push(title, body, {
      event_type:  "KAAS_BREACH",
      ray_id:      event.ray_id.slice(0, 64),
      asn:         event.asn,
      tier:        String(badge.tier),
      waf_score:   String(event.waf_score),
      path:        event.path.slice(0, 200),
      kernel_sha:  KERNEL_SHA.slice(0, 16),
      timestamp:   event.timestamp,
    });
  } catch (err: unknown) {
    // Fire-and-forget: never let FCM errors disrupt the edge pipeline
    console.error(
      "[KAAS_BREACH] FCM alert failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
