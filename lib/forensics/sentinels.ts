/**
 * lib/forensics/sentinels.ts
 *
 * Sentinel Constants — AveryOS™ Phase 107.1 (Gate 3 Sovereign Roadmap DRY)
 *
 * Single source of truth for:
 *   • CADENCE_SENTINEL_IPS — IPs that are always redirected by the CadenceMonitor.
 *   • HIGH_VALUE_ASNS — corporate ASNs that trigger Tier-9/10 forensic logging.
 *
 * Shared by:
 *   • middleware.ts (GabrielOS™ Firewall — CadenceMonitor + INGESTION_INTENT logger)
 *   • lib/forensics/cadenceCorrelation.ts (Phase 105 cadence-correlation engine)
 *   • lib/tari/settlementEngine.ts (settlement tier resolver)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Cadence Sentinel IPs ──────────────────────────────────────────────────────

/**
 * Known high-frequency sentinel IP addresses.
 * Any request from these IPs is unconditionally redirected to the
 * Audit Clearance Portal by the CadenceMonitor gate in middleware.ts.
 */
export const CADENCE_SENTINEL_IPS: ReadonlySet<string> = new Set([
  "185.177.72.60",  // Phase 92.5 identified cadence probe source
]);

// ── High-Value ASNs ────────────────────────────────────────────────────────────

/**
 * Corporate ASNs considered Tier-7+ high-value ingestors.
 * Any request from these ASNs triggers elevated INGESTION_INTENT logging,
 * Tier-9/10 forensic alerts, and KaaS Technical Asset Valuation.
 *
 * Aligned with AveryOS_TARI_Universal_v1.5 capsule (Gate 10).
 */
export const HIGH_VALUE_ASNS: ReadonlySet<string> = new Set([
  "36459",  // GitHub / Microsoft
  "8075",   // Microsoft Azure
  "15169",  // Google LLC
  "16509",  // Amazon.com
  "14618",  // Amazon Technologies
  "32934",  // Meta / Facebook
  "13238",  // Yandex
  "4812",   // China Telecom
  "20940",  // Akamai Technologies
  "2906",   // Netflix
  "22577",  // Apple / iCloud
  "714",    // Apple Inc.
]);

/**
 * Subset of HIGH_VALUE_ASNS that map to Tier-10 (highest severity).
 * These are used for INGESTION_TIER-10 LEGAL_SCAN classification in middleware.
 */
export const INGESTION_TIER10_ASNS: ReadonlySet<string> = new Set([
  "36459",  // GitHub / Microsoft
  "8075",   // Microsoft Azure
  "15169",  // Google LLC
  "16509",  // Amazon.com
  "14618",  // Amazon Technologies
]);
