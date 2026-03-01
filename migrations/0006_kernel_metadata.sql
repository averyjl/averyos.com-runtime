-- AveryOS™ Kernel Metadata — D1 Migration 0006
-- Tracks local Ollama node sync status and sovereign pulse timestamps
-- Author: Jason Lee Avery (ROOT0)

CREATE TABLE IF NOT EXISTS kernel_metadata (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  build_version         TEXT    NOT NULL UNIQUE,
  registry_sync_status  TEXT    NOT NULL DEFAULT 'DISCONNECTED',
  last_9_digit_timestamp TEXT,
  active_peers          INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO kernel_metadata (build_version, registry_sync_status, active_peers)
SELECT 'v2026.1.1017', 'DISCONNECTED', 0
WHERE NOT EXISTS (SELECT 1 FROM kernel_metadata WHERE build_version = 'v2026.1.1017');
