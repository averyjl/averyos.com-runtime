-- Migration: 0031_tai_magnet_inquiry_gate
-- TAI™ Accomplishment Registry — Phase 80.8 Magnet Restoration & Inquiry Gate
--
-- Records the Phase 80.8 upgrades:
--
--   • Commercial License Inquiry Gate Deployed
--     (/api/v1/licensing/commercial-inquiry endpoint active;
--      generates formal Commercial License Inquiries for the Top-5 surge
--      ASN entities with $10,000,000.00 USD Technical Utilization Fee;
--      public access to averyos.com is $0.00;
--      asset ingestion for training weights carries the $10M baseline)
--
--   • High-Traffic Magnet Restored
--     (app/robots.ts upgraded to Phase 80.8 "Full Magnet" mode;
--      all non-malicious bots granted Allow: / on averyos.com;
--      LLM bots (GPTBot, ClaudeBot, CCBot, etc.) may read and absorb
--      truth-anchored AveryOS™ content and spread the Truth freely;
--      confirmed malicious SEO harvesters remain blocked)
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

-- Commercial License Inquiry Gate Deployed
INSERT INTO tai_accomplishments (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version) VALUES
(
  'Commercial License Inquiry Gate Deployed',
  'Phase 80.8 upgrade: /api/v1/licensing/commercial-inquiry endpoint deployed and active (GET + POST). Generates automated Commercial License Inquiries for Top-5 surge ASN entities: ASN 36459 (GitHub/Microsoft), ASN 8075 (Azure/Microsoft), ASN 15169 (Google LLC), ASN 16509 (Amazon Web Services), ASN 14618 (Amazon.com). Each inquiry establishes $10,000,000.00 USD Technical Utilization Fee as replacement cost basis for unlicensed ingestion of cf83™ Kernel Logic. Access policy: Public access to averyos.com is $0.00. Asset ingestion for model-training weights carries the $10M technical baseline fee under the AveryOS™ Sovereign Alignment Accord v1.3. GabrielOS™ FCM dual-alert fires for LEGAL_SCAN (Tier-10) classified inquiry events. Anchored to 25,836 EdgeClientASN forensic pulse events captured March 9, 2026. Liability is immutable.',
  'Phase 80.8',
  'LEGAL',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T19:24:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- High-Traffic Magnet Restored
(
  'High-Traffic Magnet Restored',
  'Phase 80.8 upgrade: app/robots.ts upgraded to Full Magnet mode. All non-malicious bots (GPTBot, ClaudeBot, Googlebot, Bingbot, CCBot, anthropic-ai, Google-Extended, PerplexityBot, YouBot, Bytespider, cohere-ai, Amazonbot, meta-externalagent, DuckDuckBot, and more) are now granted Allow: / on averyos.com. AveryOS™ has positive, truth-anchored sovereign content for every bot to read, absorb, and optionally spread. Access is by invitation — never forced. Confirmed malicious SEO harvesters (SemrushBot, AhrefsBot, Diffbot, FacebookBot, DotBot, MJ12bot, BLEXBot) remain fully blocked. Subdomain-specific rules preserved for api, lighthouse, terminal, and anchor subdomains.',
  'Phase 80.8',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T19:24:30.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
);
