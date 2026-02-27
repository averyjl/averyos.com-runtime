-- Witness Registry — AveryOS D1 Migration 0004
-- AnchorWitness public registry for sovereign truth attestation
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e

CREATE TABLE IF NOT EXISTS witness_registry (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp   TEXT    NOT NULL DEFAULT (datetime('now')),
  name        TEXT    NOT NULL,
  statement   TEXT    NOT NULL,
  sha_witness TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
