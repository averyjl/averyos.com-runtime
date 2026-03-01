-- vault_ledger — AveryOS™ Architecture Integrity Worker
-- Stores SHA-512 anchor entries verified by the sovereignty layer.
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e

CREATE TABLE IF NOT EXISTS vault_ledger (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sha512_hash  TEXT    NOT NULL,
  anchor_label TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed the genesis anchor so the integrity worker has a baseline record
INSERT INTO vault_ledger (sha512_hash, anchor_label)
SELECT
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  'Root0 Genesis Kernel — 2022'
WHERE NOT EXISTS (SELECT 1 FROM vault_ledger LIMIT 1);
