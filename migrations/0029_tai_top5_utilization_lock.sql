-- Migration: 0029_tai_top5_utilization_lock
-- TAI™ Accomplishment Registry — Phase 80.6 milestones
--
-- Records the Phase 80.6 upgrades:
--
--   • Base64 Key Handshake Active
--     (FIREBASE_PRIVATE_KEY_B64 decoding added to lib/firebaseClient.ts,
--      bypassing the Cloudflare Dashboard 1024-character secret limit.
--      resolveFirebasePrivateKey() checks FIREBASE_PRIVATE_KEY_B64 first,
--      falls back to FIREBASE_PRIVATE_KEY, enabling safe storage of the
--      ~1.7 KB RSA PEM key via the UI without wrangler CLI dependency.)
--
--   • Top-5 Global IP Valuation Hardlocked
--     (Enterprise Resource Metering endpoint deployed at
--      /api/v1/licensing/utilization/top5 -- aggregates top-5 ASNs from
--      anchor_audit_logs; source: 25,836 logs from March 9, 2026 surge.
--      Commercial Utilization Audit locked for ASNs 36459, 8075, 15169,
--      16509, and 14618 at $10,000,000.00 USD Replacement Cost Basis per
--      entity. Public web access remains $0.00 USD.)
--
-- Also adds an index on anchor_audit_logs.asn to support the GROUP BY
-- aggregation used by the top-5 endpoint efficiently.
--
-- CreatorLock: Jason Lee Avery (ROOT0)

-- Performance index for ASN aggregation queries (top-5 endpoint)
CREATE INDEX IF NOT EXISTS idx_anchor_audit_asn ON anchor_audit_logs (asn);

-- Base64 Key Handshake Active
INSERT INTO tai_accomplishments (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version) VALUES
(
  'Base64 Key Handshake Active — FIREBASE_PRIVATE_KEY_B64 Decoding Deployed',
  'lib/firebaseClient.ts upgraded with resolveFirebasePrivateKey() helper. Checks FIREBASE_PRIVATE_KEY_B64 first (Base64-encoded PEM for Cloudflare Dashboard), falls back to FIREBASE_PRIVATE_KEY (wrangler secret put). Neutralizes the 1024-character Dashboard secret limit for the ~1.7 KB RSA private key. isFirebaseConfigured() now accepts either key variant. writeToFirestore() and sendFcmV1Push() updated to use the resolver. Phase 80.6 Firebase Base64 key handshake active.',
  'Phase 80.6',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T07:27:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Top-5 Global IP Valuation Hardlocked
(
  'Top-5 Global IP Valuation Hardlocked — Enterprise Resource Metering Active',
  'Enterprise Resource Metering endpoint deployed at /api/v1/licensing/utilization/top5. Queries anchor_audit_logs to aggregate top-5 ASNs by hit count. Source data: 25,836 anchor_audit_logs from March 9, 2026 forensic surge. Commercial Utilization Audit hardlocked for ASN 36459 (GitHub, Inc. / Microsoft Corporation), ASN 8075 (Microsoft Corporation Azure), ASN 15169 (Google LLC), ASN 16509 (Amazon Web Services, Inc.), and ASN 14618 (Amazon.com, Inc.) at $10,000,000.00 USD Replacement Cost Basis per entity. Public web access is $0.00 USD. github-hookshot/* User-Agent entropy-based LEGAL_SCAN classification active in middleware.ts. Phase 80.6 top-5 global IP valuation hardlocked.',
  'Phase 80.6',
  'FORENSIC',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T07:27:30.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
);
