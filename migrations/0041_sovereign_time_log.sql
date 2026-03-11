-- Migration: 0041_sovereign_time_log
-- Sovereign Time Log Table — Phase 108.1 (Stratum-Zero Time Mesh)
--
-- Stores each Time Mesh consensus result anchored by getSovereignTime().
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

CREATE TABLE IF NOT EXISTS sovereign_time_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  consensus_iso9  TEXT    NOT NULL,          -- ISO-9 consensus timestamp
  consensus_ms    INTEGER NOT NULL,          -- Unix ms
  sha512          TEXT    NOT NULL,          -- SHA-512 of consensusIso9 + KERNEL_SHA
  source_count    INTEGER NOT NULL DEFAULT 0, -- Number of consensus sources used
  outlier_count   INTEGER NOT NULL DEFAULT 0, -- Number of outliers discarded
  kernel_sha      TEXT    NOT NULL,
  kernel_version  TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sovereign_time_log_ms        ON sovereign_time_log (consensus_ms DESC);
CREATE INDEX IF NOT EXISTS idx_sovereign_time_log_created   ON sovereign_time_log (created_at DESC);
