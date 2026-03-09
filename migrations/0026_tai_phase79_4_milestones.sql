-- Migration: 0026_tai_phase79_4_milestones
-- TAI™ Accomplishment Registry — Phase 79.4 milestones
--
-- Records the Phase 79.4 upgrades (Sovereign Roadmap — Hard-Layer Compression
-- & Firebase/FCM Connectivity Hardlock):
--
--   • Firestore REST API writes activated in lib/firebaseClient.ts
--     (OAuth2 service account JWT — no firebase-admin SDK required, fully
--      compatible with Cloudflare Workers edge runtime)
--
--   • FCM HTTP v1 push activated — sendFcmV1Push() in lib/firebaseClient.ts
--     (upgraded from legacy server-key to OAuth2-based HTTP v1 API)
--
--   • GabrielOS™ FCM Tier-9 dual delivery — audit-alert route fires FCM HTTP v1
--     alongside Pushover for all threat_level ≥ 9 events
--
--   • Bundle size: firebase-admin added to serverExternalPackages;
--     optimizePackageImports enabled for lucide-react and @heroicons/react
--
--   • FCM_DEVICE_TOKEN documented in .env.example + vault-secrets.ps1
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

-- Firestore REST API writes activated (Phase 79.4 Gate 1 + Gate 9)
INSERT INTO tai_accomplishments (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version) VALUES
(
  'Firestore REST API Writes Activated — Multi-Cloud D1/Firebase Parity Live',
  'lib/firebaseClient.ts upgraded: all Firestore stub functions now perform actual REST API writes using OAuth2 service account JWT authentication. Compatible with Cloudflare Workers edge runtime — no firebase-admin SDK required. Collections active: averyos-resonance, averyos-model-registry, averyos-drift-alerts, averyos-handshake-sync, averyos-d1-sync, averyos-tari-probe. Activates automatically once FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY Cloudflare secrets are configured. Phase 79.4 Gate 1 + Gate 9 complete.',
  'Phase 79.4',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T02:49:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- FCM HTTP v1 push activated (Phase 79.4 Gate 2 + Gate 5)
(
  'GabrielOS™ FCM HTTP v1 Push Activated — OAuth2 Service Account JWT Flow',
  'sendFcmV1Push() implemented in lib/firebaseClient.ts using FCM HTTP v1 API with OAuth2 service account JWT — upgraded from deprecated legacy server-key approach. Fully compatible with Cloudflare Workers via Web Crypto API RSA signing. Tier-9 dual delivery activated in /api/v1/audit-alert: FCM HTTP v1 fires alongside Pushover for all threat_level ≥ 9 events. Activates once FCM_DEVICE_TOKEN + Firebase service account secrets are configured via wrangler secret put. Phase 79.4 Gate 2 + Gate 5 complete.',
  'Phase 79.4',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T02:49:30.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Bundle size optimization (Phase 79.4 Gate 3)
(
  'Bundle Size Hardlock — optimizePackageImports + firebase-admin Externalized',
  'next.config.js upgraded: firebase-admin added to serverExternalPackages to prevent accidental bundling of Node.js-only SDK. experimental.optimizePackageImports enabled for lucide-react and @heroicons/react — Next.js tree-shakes to only the icons actually used, eliminating full icon-library inlining. Combined with existing katex, stripe, isomorphic-dompurify, jsdom, lucide-react externalization. Phase 79.4 Gate 3 bundle compression complete.',
  'Phase 79.4',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T02:49:45.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
);
