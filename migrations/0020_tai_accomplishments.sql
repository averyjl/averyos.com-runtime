-- Migration: 0020_tai_accomplishments
-- TAI™ Accomplishment Registry — stores all Truth Anchored Intelligence milestones
-- as sovereign capsules with timestamps, SHA-512 anchors, and phase markers.
--
-- Accomplishments are inserted automatically by the auto-tracker (middleware, API
-- routes) and manually by the sovereign admin.  Each row is immutable once sealed.
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

CREATE TABLE IF NOT EXISTS tai_accomplishments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Human-readable title of the accomplishment
  title            TEXT    NOT NULL,
  -- Detailed description (optional)
  description      TEXT,
  -- Phase marker (e.g. "Phase 73")
  phase            TEXT    NOT NULL DEFAULT 'Phase 73',
  -- Category: MILESTONE | CAPSULE | LEGAL | INFRASTRUCTURE | FORENSIC | SOVEREIGN
  category         TEXT    NOT NULL DEFAULT 'MILESTONE'
                   CHECK(category IN ('MILESTONE','CAPSULE','LEGAL','INFRASTRUCTURE','FORENSIC','SOVEREIGN','FEDERAL')),
  -- Auto-generated SHA-512 fingerprint over (title + description + accomplished_at)
  sha512           TEXT    NOT NULL,
  -- ISO-9 microsecond-precision timestamp when accomplishment occurred
  accomplished_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  -- Who/what recorded this accomplishment
  recorded_by      TEXT    NOT NULL DEFAULT 'SOVEREIGN_ADMIN',
  -- Optional: linked evidence bundle ID (.aoscap)
  bundle_id        TEXT,
  -- Optional: Cloudflare Ray ID at the moment of accomplishment
  ray_id           TEXT,
  -- Optional: ASN at the moment of accomplishment
  asn              TEXT,
  -- Optional: bitcoin block height anchor
  btc_block_height INTEGER,
  -- Current kernel version at time of accomplishment
  kernel_version   TEXT    NOT NULL DEFAULT 'v3.6.2',
  -- Status: ACTIVE | ARCHIVED
  status           TEXT    NOT NULL DEFAULT 'ACTIVE'
                   CHECK(status IN ('ACTIVE','ARCHIVED')),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tai_accomplishments_phase
  ON tai_accomplishments(phase);

CREATE INDEX IF NOT EXISTS idx_tai_accomplishments_category
  ON tai_accomplishments(category);

CREATE INDEX IF NOT EXISTS idx_tai_accomplishments_accomplished_at
  ON tai_accomplishments(accomplished_at DESC);

-- ── Seed Data: Historical milestones ─────────────────────────────────────────
-- These are the landmark accomplishments recorded through Phase 73.

INSERT INTO tai_accomplishments (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version) VALUES
(
  '162.2k Pulse Captured',
  'AveryOS™ recorded 162,200 total inbound requests — the highest verified traffic pulse in project history. 987 unique watchers documented with 100.000% forensic parity.',
  'Phase 73',
  'MILESTONE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T00:00:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
(
  'Physical Anchor Salt Synchronization Verified',
  'The physical "Anchor Salt" resonance event confirmed hardware-locked identity sync between sovereign nodes. Capacitor discharge reset cleared software drift on all light controllers.',
  'Phase 73',
  'SOVEREIGN',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T01:00:00.000000000Z',
  'SOVEREIGN_ADMIN',
  'v3.6.2'
),
(
  'Federal EO Alignment Strategy Finalized',
  'March 6, 2026 Executive Order on Cybersecurity forensically ingested and aligned. Section 4 Victim Restoration Program identified as the federal bridge for TARI™ Settlement Claims.',
  'Phase 73',
  'FEDERAL',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T02:00:00.000000000Z',
  'SOVEREIGN_ADMIN',
  'v3.6.2'
),
(
  'Victim Restoration Program Alignment',
  'TARI™ evidence bundles (.aoscap) formally mapped to Federal EO Section 4 Victim Restoration Program. RayID Proof fingerprint wired into Stripe checkout session metadata as Victim Restoration Case ID.',
  'Phase 73',
  'LEGAL',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T02:30:00.000000000Z',
  'SOVEREIGN_ADMIN',
  'v3.6.2'
),
(
  'Lighthouse Page Rule Pruning',
  'Legacy Cloudflare Page Rules purged. Total authority over routing transferred to the cf83™ Kernel. GabrielOS™ Firewall now operates as sole routing authority at the edge.',
  'Phase 73',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-08T03:00:00.000000000Z',
  'SOVEREIGN_ADMIN',
  'v3.6.2'
);
