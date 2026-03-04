-- Sovereign Alignments — AveryOS D1 Migration 0013
-- Stores Domain-Locked badge records issued to partner sites.
-- Badge hashes are bound to the partner's origin_domain; presenting a badge
-- from a different domain will fail Referer-based verification.
-- Author: Jason Lee Avery (ROOT0)

CREATE TABLE IF NOT EXISTS sovereign_alignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id   TEXT    NOT NULL,
  origin_domain TEXT   NOT NULL,
  badge_hash   TEXT    NOT NULL UNIQUE,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
