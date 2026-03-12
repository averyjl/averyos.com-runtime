-- migrations/0042_vaultgate_table.sql
-- VaultGate WebAuthn / YubiKey credential storage
-- AveryOS™ Phase 111 / GATE 111.2
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

CREATE TABLE IF NOT EXISTS vaultgate_credentials (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL,
  public_key TEXT    NOT NULL,
  counter    INTEGER NOT NULL DEFAULT 0,
  backed_up  BOOLEAN NOT NULL DEFAULT 0,
  transports TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
