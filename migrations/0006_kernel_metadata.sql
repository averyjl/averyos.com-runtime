-- kernel_metadata — AveryOS™ Sovereign Health Dashboard
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e
--
-- IDEMPOTENT UPGRADE (2026-03-07):
-- Some production databases have a kernel_metadata table that was created
-- before migration tracking was in place, using an old schema that did NOT
-- include the build_timestamp_ms column.  A plain CREATE TABLE IF NOT EXISTS
-- is a no-op for those databases, which caused the genesis INSERT below to
-- fail with "no column named build_timestamp_ms" — blocking all subsequent
-- deployments and taking the site down.
--
-- Fix: RENAME the existing table (old or just-created) → CREATE a fresh table
-- with the correct schema → INSERT / copy rows using a safe literal for the
-- missing column → DROP the renamed backup → seed genesis row if still empty.
--
-- This approach is safe for ALL starting states:
--   • Fresh database (no table): CREATE creates it; RENAME + re-CREATE + INSERT
--     copies 0 rows; genesis seed is inserted.
--   • Old database (table without build_timestamp_ms): CREATE is a no-op;
--     RENAME backs it up; new CREATE adds the column; INSERT copies rows using
--     '000000000' literal (no reference to the missing column); DROP removes backup.
--   • Re-run prevention: wrangler's migration-tracking table ensures each
--     migration runs exactly once per database.

-- Step 1 — Create with full schema (no-op if table already exists).
CREATE TABLE IF NOT EXISTS kernel_metadata (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  build_version         TEXT    NOT NULL,
  kernel_resonance_hash TEXT    NOT NULL,
  build_timestamp_ms    TEXT    NOT NULL DEFAULT '000000000',
  tari_pulse_peers      INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Step 2 — Rename whatever version exists to a safe backup name.
ALTER TABLE kernel_metadata RENAME TO kernel_metadata_v005;

-- Step 3 — Recreate with the definitive schema.
CREATE TABLE kernel_metadata (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  build_version         TEXT    NOT NULL,
  kernel_resonance_hash TEXT    NOT NULL,
  build_timestamp_ms    TEXT    NOT NULL DEFAULT '000000000',
  tari_pulse_peers      INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Step 4 — Copy existing rows.
-- Literals are used for build_timestamp_ms, tari_pulse_peers, AND updated_at
-- so this statement never references those columns from the source table.
-- This is critical for production databases where kernel_metadata was created
-- before tari_pulse_peers and/or updated_at were added to the schema — selecting
-- those columns from kernel_metadata_v005 would fail with "no such column: X".
-- 'id' is omitted so SQLite auto-assigns ids in insertion order.
INSERT INTO kernel_metadata (build_version, kernel_resonance_hash, build_timestamp_ms, tari_pulse_peers, updated_at)
SELECT build_version, kernel_resonance_hash, '000000000', 0, datetime('now')
FROM kernel_metadata_v005;

-- Step 5 — Drop backup.
DROP TABLE kernel_metadata_v005;

-- Step 6 — Seed genesis row if table is still empty.
-- tari_pulse_peers is seeded as 0 (no known peers at genesis) rather than 1
-- so that the literal matches the column default and avoids a false "peer" count
-- on legacy databases where the column may not have existed yet.
INSERT INTO kernel_metadata (build_version, kernel_resonance_hash, build_timestamp_ms, tari_pulse_peers, updated_at)
SELECT
  'v0.0.0',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '000000000',
  0,
  datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM kernel_metadata WHERE id = 1);
