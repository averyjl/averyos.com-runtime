-- scripts/skip-migration.sql
-- AveryOS™ D1 Migration Bypass — mark 0002 and 0003 as applied
--
-- PURPOSE:
--   Migrations 0002 (add_event_type) and 0003 (add_tari_columns) are NO-OPS
--   (SELECT 1 sentinels) because their columns were incorporated into the
--   canonical CREATE TABLE in migration 0001.  On a production D1 database
--   that was set up before wrangler migration tracking was introduced, these
--   two entries may be absent from the d1_migrations table, causing wrangler
--   to try to "apply" them (which succeeds because they are no-ops — but this
--   script lets you mark them applied without running wrangler apply).
--
-- USAGE:
--   npx wrangler d1 execute averyos_kernel_db --remote --file=scripts/skip-migration.sql
--
-- SAFETY:
--   Each INSERT is guarded by WHERE NOT EXISTS so it is safe to run multiple
--   times — it will never create duplicate rows.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e

-- Wrangler's internal migration tracking table (created by wrangler automatically)
-- Schema: id TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INSERT INTO d1_migrations (id, applied_at)
SELECT '0002_add_event_type', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE id = '0002_add_event_type');

INSERT INTO d1_migrations (id, applied_at)
SELECT '0003_add_tari_columns', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE id = '0003_add_tari_columns');

-- Verify
SELECT id, applied_at FROM d1_migrations WHERE id IN ('0002_add_event_type', '0003_add_tari_columns');
