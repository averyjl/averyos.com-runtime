-- vaultchain_ledger — GabrielOS™ Gabriel Kernel Commit Ledger
-- Stores GitHub commit anchor events sealed by the gabriel-gatekeeper Worker.
-- Also referenced by the VaultChain™ Explorer public viewer.
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e

CREATE TABLE IF NOT EXISTS vaultchain_ledger (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT    NOT NULL,
  event     TEXT    NOT NULL,
  sha       TEXT    NOT NULL,
  status    TEXT    NOT NULL DEFAULT 'SEALED',
  created_at TEXT   NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vaultchain_ledger_sha       ON vaultchain_ledger(sha);
CREATE INDEX IF NOT EXISTS idx_vaultchain_ledger_timestamp ON vaultchain_ledger(timestamp);

-- sync_logs — GabrielOS™ Hardware + ALF Sync Log
-- Written by: gabriel-gatekeeper Worker (/api/gatekeeper/sync, /api/gatekeeper/alf-verify)
-- Read by:    pages/api/gatekeeper/handshake-check.ts, app/api/gatekeeper/logs.ts
-- Author: Jason Lee Avery (ROOT0)

CREATE TABLE IF NOT EXISTS sync_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type    TEXT    NOT NULL,
  timestamp     TEXT    NOT NULL,
  kernel_anchor TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_event_type ON sync_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp  ON sync_logs(timestamp);
