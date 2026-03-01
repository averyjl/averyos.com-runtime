-- Migration: 0009_anchor_audit_logs
-- Creates the anchor_audit_logs table for sovereign capsule anchoring records.
CREATE TABLE IF NOT EXISTS anchor_audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  anchored_at TEXT    NOT NULL,
  sha512      TEXT    NOT NULL,
  btc_height  INTEGER,
  btc_hash    TEXT
);
