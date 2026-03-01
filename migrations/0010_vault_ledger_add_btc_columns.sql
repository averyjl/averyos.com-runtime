-- Migration: 0010_vault_ledger_add_btc_columns
-- Adds btc_block_height and btc_block_hash columns to vault_ledger for
-- already-deployed instances that ran migration 0008 before the Hybrid
-- Sovereign upgrade (2026-03-01). Fresh deployments get these columns from 0008.

ALTER TABLE vault_ledger ADD COLUMN btc_block_height INTEGER;
ALTER TABLE vault_ledger ADD COLUMN btc_block_hash   TEXT;

-- Back-fill the genesis seed row with the 2026-03-01 Global Anchor if it
-- still has NULL values for the new columns.
UPDATE vault_ledger
SET
  btc_block_height = 938909,
  btc_block_hash   = '0000000000000000000086c2d1b7d8c6b7e6f4a2c5b1d0e9f8a7b6c5d4e3f2a1'
WHERE anchor_label IN ('Root0 Genesis Kernel — 2022', 'GENESIS_KERNEL_STAPLE')
  AND btc_block_height IS NULL;
