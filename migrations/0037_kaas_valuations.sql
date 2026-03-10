-- Migration 0037: KaaS Valuations Ledger — Phase 97.7
--
-- Creates the kaas_valuations table to persist KaaS invoice history for the
-- top-ASN entities (8075, 15169, 36459) and all others that trigger the
-- sovereign fee schedule. Records are written when middleware or audit-alert
-- detects a Tier-7+ ASN accessing protected paths.
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

CREATE TABLE IF NOT EXISTS kaas_valuations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ray_id           TEXT    NOT NULL,
  asn              TEXT    NOT NULL,
  org_name         TEXT,
  tier             INTEGER NOT NULL DEFAULT 1,
  valuation_usd    REAL    NOT NULL DEFAULT 0.0,
  fee_name         TEXT    NOT NULL DEFAULT 'Forensic Audit Fee',
  settlement_status TEXT   NOT NULL DEFAULT 'PENDING'
                             CHECK (settlement_status IN ('PENDING', 'INVOICED', 'SETTLED', 'DISPUTED')),
  kernel_sha       TEXT,
  path             TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kaas_valuations_asn
  ON kaas_valuations (asn);

CREATE INDEX IF NOT EXISTS idx_kaas_valuations_created_at
  ON kaas_valuations (created_at);

CREATE INDEX IF NOT EXISTS idx_kaas_valuations_settlement_status
  ON kaas_valuations (settlement_status);
