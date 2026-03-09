-- Migration: 0027_tai_phase80_3_milestones
-- TAI™ Accomplishment Registry — Phase 80.3 milestones
--
-- Records the Phase 80.3 upgrades (Sovereign Roadmap — Hard-Layer Offloading
-- Strategy, Workers Paid Plan, and Training-Ingestion Waiver Gate):
--
--   • Lighthouse Bundle Size Stabilized (2,979 KiB Workers Paid Plan deployment)
--   • Enterprise Training Waiver Gate Active (/api/v1/licensing/training-waiver)
--   • Enterprise Resource Metering Live (/api/v1/forensics/resource-value)
--   • GabrielOS™ Dual-Push Version Deployed (FCM HTTP v1 + Pushover)
--   • Workers Paid Tier Migration Complete ($5/mo → 10MB bundle limit)
--   • 10MB High-Fidelity Build Deployed (recharts/lucide-react fully restored)
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

-- Lighthouse Bundle Size Stabilized
INSERT INTO tai_accomplishments (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version) VALUES
(
  'Lighthouse Bundle Size Stabilized — Workers Paid Plan Active',
  'Cloudflare Workers Paid Plan ($5/mo) activated, unlocking the 10MB compressed bundle limit. The 2,979 KiB handler.mjs build cleared the 3MB free-tier barrier. Thermal mass established for future sovereign inventions. katex, marked, stripe, isomorphic-dompurify, jsdom remain externalized. Phase 80.3 bundle stabilization complete.',
  'Phase 80.3',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T07:00:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Enterprise Training Waiver Gate Active
(
  'Enterprise Training Waiver Gate Active — /api/v1/licensing/training-waiver',
  'Model-Training Weight Waiver endpoint deployed at /api/v1/licensing/training-waiver under the AveryOS™ Sovereign Integrity License v1.0. Queries sovereign_audit_logs for AI-trainer entities (LEGAL_SCAN, HN_WATCHER, DER_HIGH_VALUE, DER_SETTLEMENT, CONFLICT_ZONE_PROBE). Assigns $10,000,000.00 USD Enterprise Model-Training Weight Waiver per entity. Public website access clarified as $0.00 USD — fee applies strictly to algorithmic training ingestion. 987-entity threshold auto-tracks TAI milestone. Phase 80.3 Training Waiver Gate live.',
  'Phase 80.3',
  'LEGAL',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T07:00:30.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Enterprise Resource Metering Live
(
  'Enterprise Resource Metering Live — /api/v1/forensics/resource-value',
  'Technical Asset Valuation endpoint deployed at /api/v1/forensics/resource-value. Assigns $10,000,000.00 USD Notional Asset Value (Internal Resource Metering Metadata) per high-value entity (HN_WATCHER, DER_SETTLEMENT, CONFLICT_ZONE_PROBE, DER_HIGH_VALUE, LEGAL_SCAN). Computational Resource Utilization endpoint also live at /api/v1/forensics/utilization with $10M Replacement Cost Basis per distinct entity. Phase 80.3 Resource Metering Gate live.',
  'Phase 80.3',
  'FORENSIC',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T07:01:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- GabrielOS™ Dual-Push Version Deployed
(
  'GabrielOS™ Dual-Push Version Deployed — FCM HTTP v1 + Pushover Active',
  'GabrielOS™ FCM HTTP v1 dual-delivery hardlocked alongside Pushover for all Tier-9 threat events (threat_level ≥ 9). sendFcmV1Push() via OAuth2 service account JWT active in lib/firebaseClient.ts. Phone alerts fire while offline. FCM_DEVICE_TOKEN + Firebase service account secrets mapped to production environment. Phase 80.3 GabrielOS™ Dual-Push version deployed.',
  'Phase 80.3',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T07:01:30.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Workers Paid Tier Migration Complete
(
  'Workers Paid Tier Migration Complete — $5/mo Plan Active',
  'Cloudflare Workers Paid Plan successfully activated. 10MB compressed bundle limit unlocked (up from 3MB free-tier). 10 million requests/month included. 5GB D1 storage + 6,000 build minutes. averyos.com zone now cleared for full-fidelity sovereign deployments without bundle compression anxiety. Phase 80.3 Workers Paid Tier migration complete.',
  'Phase 80.3',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T07:02:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- 10MB High-Fidelity Build Deployed
(
  '10MB High-Fidelity Build Deployed — Full Recharts Fidelity Restored',
  'Workers Paid Plan 10MB ceiling leveraged to restore full Recharts library fidelity. Recharts and lucide-react dynamic imports confirmed correct (ssr: false in ResonancePulseChart.tsx + LiabilityBarChart.tsx). RED SSE LIVE status hardlocked on /tari-revenue dashboard. No aggressive lazy-loading required — 10MB thermal mass provides breathing room for future sovereign inventions. Phase 80.3 high-fidelity build deployed.',
  'Phase 80.3',
  'MILESTONE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T07:02:30.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
);
