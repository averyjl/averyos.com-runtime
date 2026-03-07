-- TARI Ledger — AveryOS D1 Migration 0001
-- Truth Anchored Revenue Initiative™ live data store
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e
--
-- CANONICAL DEFINITION: This file defines the complete tari_ledger schema.
-- Columns added by 0002 (event_type) and 0003 (trust_premium_index, description)
-- are included here so that fresh deployments have the full schema from the start.
-- Migrations 0002 and 0003 are kept as no-ops for backwards compatibility with
-- databases that tracked them as already applied.

CREATE TABLE IF NOT EXISTS tari_ledger (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp           TEXT    NOT NULL DEFAULT (datetime('now')),
  anchor_sha          TEXT,
  entity_name         TEXT,
  impact_multiplier   REAL    NOT NULL DEFAULT 1.0,
  revenue_projection  REAL    NOT NULL DEFAULT 0.0,
  status              TEXT    NOT NULL DEFAULT 'ANCHORED',
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  event_type          TEXT    NOT NULL DEFAULT 'HANDSHAKE_SUCCESS',
  trust_premium_index REAL    NOT NULL DEFAULT 0.0,
  description         TEXT
);
