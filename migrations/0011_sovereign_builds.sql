-- Migration: 0011_sovereign_builds
-- Creates the sovereign_builds table for VaultChain™ build provenance records.
-- Each row represents a CI/CD build registered through the sovereign-provenance
-- GitHub Actions workflow, optionally sealed with a hardware (YubiKey/USB) signature.
CREATE TABLE IF NOT EXISTS sovereign_builds (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_name          TEXT    NOT NULL,
  commit_sha         TEXT    NOT NULL,
  artifact_hash      TEXT    NOT NULL,
  provenance_data    TEXT,
  hardware_signature TEXT,
  btc_anchor_height  INTEGER,
  registered_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  sealed_at          TEXT
);
