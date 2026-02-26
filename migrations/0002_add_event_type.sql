-- TARI Ledger — AveryOS D1 Migration 0002
-- Adds event_type column for sovereign event classification
-- Author: Jason Lee Avery (ROOT0)

ALTER TABLE tari_ledger ADD COLUMN event_type TEXT NOT NULL DEFAULT 'HANDSHAKE_SUCCESS';
