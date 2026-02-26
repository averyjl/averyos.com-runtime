-- TARI Ledger — AveryOS D1 Migration 0001
-- Truth Anchored Revenue Initiative™ live data store
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e

CREATE TABLE IF NOT EXISTS tari_ledger (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp          TEXT    NOT NULL DEFAULT (datetime('now')),
  anchor_sha         TEXT,
  entity_name        TEXT,
  impact_multiplier  REAL    NOT NULL DEFAULT 1.0,
  revenue_projection REAL    NOT NULL DEFAULT 0.0,
  status             TEXT    NOT NULL DEFAULT 'ANCHORED',
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
