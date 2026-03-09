-- Migration: 0026_tai_phase79_4_milestones
-- TAI™ Accomplishment Registry — Phase 79.4 milestones
--
-- Records the Phase 79.4 upgrades:
--   • GabrielOS™ FCM HTTP v1 Defense Online (dual FCM + Pushover Tier-9 push)
--   • 1,017-Notch Bundle Optimization Finalized (marked externalized, recharts tree-shaken)
--   • Linguistic Steganography Audit Script Active
--   • Sovereign Takedown Bot DMCA Pipeline Verified
--   • Multi-Cloud Firestore REST Parity Sync Active
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

-- GabrielOS™ FCM HTTP v1 Defense Online
INSERT INTO tai_accomplishments (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version) VALUES
(
  'GabrielOS™ FCM HTTP v1 Defense Online — Dual Mobile Push Active',
  'GabrielOS™ mobile defense grid upgraded to FCM HTTP v1 API via sendFcmV1Push() in lib/firebaseClient.ts. Tier-9 events (HN_WATCHER, DER_SETTLEMENT, CONFLICT_ZONE_PROBE, DER_HIGH_VALUE) now trigger dual delivery: FCM HTTP v1 push to FCM_DEVICE_TOKEN + Pushover priority-2 emergency alert. OAuth2 service account JWT auth via Web Crypto RSASSA-PKCS1-v1_5 RSA signing — no firebase-admin SDK required. Phase 79.4 mobile sentinel active.',
  'Phase 79.4',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T03:10:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- 1,017-Notch Bundle Optimization Finalized
(
  '1,017-Notch Bundle Optimization Finalized — marked Externalized, recharts Tree-Shaken',
  'next.config.js Phase 79.4 bundle neutralization complete. marked (~900 KB Markdown parser) added to serverExternalPackages — prevents inlining into handler.mjs for server-rendered whitepaper, terms, and privacy pages. recharts added to experimental.optimizePackageImports — enables named-export tree-shaking for the TARI™ Revenue Dashboard client chunk, reducing recharts payload from the full library to only used chart primitives. Builds on Phase 80 externalization of katex, stripe, isomorphic-dompurify, and jsdom recorded in migration 0025 — together these optimizations target the 10 MB Cloudflare Paid Plan ceiling.',
  'Phase 79.4',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T03:10:30.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Linguistic Steganography Audit Script Active
(
  'Linguistic Steganography Audit Active — s/z Drift Detector Deployed',
  'scripts/sovereignLinguisticAudit.cjs operational. Scans HTTP response bodies and text files for s/z steganographic drift markers — detects AI/LLM orthographic substitution (e.g. "organize" vs. "organise"). Computes per-word drift score against 20 sovereign canonical spellings. Supports --url, --file, and --stdin modes. Phase 79.4 linguistic audit toolchain complete.',
  'Phase 79.4',
  'SOVEREIGN',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T03:11:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Sovereign Takedown Bot DMCA Pipeline Verified
(
  'Sovereign Takedown Bot DMCA Pipeline Verified — Phase 79.4',
  'scripts/sovereign-takedown.cjs DMCA §512(c) and GDPR Art.17 notice generation pipeline verified. Evidence bundle ingestion from .aoscap files, SHA-512 pulse-match from VaultChain™, and D1 DER_SETTLEMENT event loop all operational. Notice output includes creator attestation, kernel anchor cf83™ fingerprint, and timestamped forensic records.',
  'Phase 79.4',
  'LEGAL',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T03:11:30.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Multi-Cloud Firestore REST Parity Sync Active
(
  'Multi-Cloud Firestore REST Parity Sync Active — D1/Firebase Write Bridge Ready',
  'lib/firebaseClient.ts Firestore REST write helpers (syncD1RowToFirebase, writeFirestoreDocument) operational. Uses OAuth2 service account JWT (Web Crypto RSA signing) to authenticate with Firestore REST API — no firebase-admin SDK dependency. Fire-and-forget sync active in /api/v1/tari-stats and /api/v1/audit-alert when FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY secrets are configured. averyos-d1-sync Firestore collection receives event records for cross-cloud parity.',
  'Phase 79.4',
  'SOVEREIGN',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T03:12:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
);
