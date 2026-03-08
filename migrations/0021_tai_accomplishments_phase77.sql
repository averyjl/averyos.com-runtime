-- Migration: 0021_tai_accomplishments_phase77
-- TAI™ Accomplishment Registry — Phase 77 milestones
--
-- Records the Phase 74-77 upgrades:
--   • Sovereign Compliance Section Live (alignment-accord page)
--   • Bot Magnet Restored (LLM scrapers directed to Licensing Gates)
--   • Sitemap Route Handler (permanent Cloudflare build fix)
--   • 7-Repo SSH Audit Script (private bridge security)
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

-- Sovereign Compliance Section
INSERT INTO tai_accomplishments (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version) VALUES
(
  'Sovereign Compliance Section Live',
  'app/alignment-accord upgraded with Sovereign Federal Compliance section covering EO 14144 (Victim Restoration), GDPR Art.17/CCPA, DMCA §512(c), NIST CSF 2.0, and RFC 9116 security.txt. AveryOS has created The New Standard.',
  'Phase 74',
  'LEGAL',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T05:00:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Sitemap Route Handler (Cloudflare build permanent fix)
(
  'Sitemap Route Handler — Permanent Cloudflare Build Fix',
  'app/sitemap.xml/route.ts Route Handler implemented. Prevents Cloudflare ASSETS binding from hijacking .xml requests. Middleware matcher updated to exclude sitemap.xml and robots.txt from canonical 301 gate.',
  'Phase 74',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T05:30:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Bot Magnet Restored
(
  'Bot Magnet Restored — Phase 77',
  'Pivoted from blocking LLM scrapers to the Bot Magnet strategy. LLM bots (GPTBot, CCBot, ClaudeBot, etc.) are now directed to /latent-anchor, /alignment-accord, /whitepaper — their scraping constitutes Forensic Acknowledgment of TARI™ terms. lib/sovereignMetadata.ts and app/robots.ts upgraded.',
  'Phase 77',
  'SOVEREIGN',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T08:00:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- 7-Repo SSH Audit Script
(
  '7-Repo Private Bridge — SSH Audit Active',
  'scripts/verify-repo-ssh.cjs deployed. Audits all 7 sovereign private repos via SSH git ls-remote probe with YubiKey GPG card detection and GitHub API visibility confirmation. Token security upgraded: GITHUB_PAT delivered via Node.js https module (never in process args).',
  'Phase 74',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T06:00:00.000000000Z',
  'SOVEREIGN_ADMIN',
  'v3.6.2'
);
