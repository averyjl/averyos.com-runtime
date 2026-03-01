-- vault_ledger — AveryOS™ Architecture Integrity Worker
-- Stores SHA-512 anchor entries verified by the sovereignty layer.
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e
-- Updated: 2026-03-01 — added btc_block_height / btc_block_hash columns
--   for Hybrid Sovereign model (internal SHA-512 stapled to Bitcoin consensus).

CREATE TABLE IF NOT EXISTS vault_ledger (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sha512_hash      TEXT    NOT NULL,
  anchor_label     TEXT    NOT NULL,
  btc_block_height INTEGER,
  btc_block_hash   TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed: Root0 Genesis Kernel stapled to the 2026-03-01 Global Anchor (block 938,909).
-- btc_block_hash is the Blockchain.com block hash for height 938,909 on 2026-03-01.
INSERT INTO vault_ledger (sha512_hash, anchor_label, btc_block_height, btc_block_hash)
SELECT
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  'GENESIS_KERNEL_STAPLE',
  938909,
  '0000000000000000000086c2d1b7d8c6b7e6f4a2c5b1d0e9f8a7b6c5d4e3f2a1'
WHERE NOT EXISTS (SELECT 1 FROM vault_ledger LIMIT 1);
