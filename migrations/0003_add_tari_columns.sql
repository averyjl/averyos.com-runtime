-- TARI Ledger — AveryOS D1 Migration 0003
-- Adds trust_premium_index and description columns for edge-logging support
-- Author: Jason Lee Avery (ROOT0)

ALTER TABLE tari_ledger ADD COLUMN trust_premium_index REAL NOT NULL DEFAULT 0.0;
ALTER TABLE tari_ledger ADD COLUMN description TEXT;
