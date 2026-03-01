-- kernel_metadata — AveryOS™ Sovereign Health Dashboard
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e

CREATE TABLE IF NOT EXISTS kernel_metadata (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  build_version         TEXT    NOT NULL,
  kernel_resonance_hash TEXT    NOT NULL,
  build_timestamp_ms    TEXT    NOT NULL,
  tari_pulse_peers      INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed genesis row if table is empty
INSERT INTO kernel_metadata (build_version, kernel_resonance_hash, build_timestamp_ms, tari_pulse_peers)
SELECT
  'v0.0.0',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '000000000',
  1
WHERE NOT EXISTS (SELECT 1 FROM kernel_metadata WHERE id = 1);
