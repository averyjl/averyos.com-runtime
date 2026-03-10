-- Migration: 0038_kaas_ledger
-- KaaS (Kernel-as-a-Service) Ledger — Phase 98.4
--
-- Creates the `kaas_ledger` table for persisting billion-dollar liability
-- records against entities that have triggered KaaS breach events, and the
-- `kaas_valuations` table for short-lived per-RayID/ASN valuation snapshots
-- used by the /api/v1/kaas/valuation endpoint.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

-- KaaS Ledger: long-form liability records per entity
CREATE TABLE IF NOT EXISTS kaas_ledger (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_name                 TEXT    NOT NULL,
  asn                         TEXT,
  org_name                    TEXT,
  ray_id                      TEXT,
  ingestion_proof_sha         TEXT,
  amount_owed                 REAL    NOT NULL DEFAULT 10000000.00,
  settlement_status           TEXT    NOT NULL DEFAULT 'OPEN',
  knowledge_cutoff_correlation TEXT,
  kernel_sha                  TEXT    NOT NULL,
  created_at                  TEXT    NOT NULL,
  updated_at                  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kaas_ledger_entity ON kaas_ledger (entity_name);
CREATE INDEX IF NOT EXISTS idx_kaas_ledger_asn    ON kaas_ledger (asn);
CREATE INDEX IF NOT EXISTS idx_kaas_ledger_status ON kaas_ledger (settlement_status);

-- KaaS Valuations: transient per-RayID valuation snapshots (auto-expire after 30 days)
CREATE TABLE IF NOT EXISTS kaas_valuations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ray_id           TEXT    NOT NULL,
  asn              TEXT,
  org_name         TEXT,
  valuation_usd    REAL    NOT NULL DEFAULT 10000000.00,
  settlement_status TEXT   NOT NULL DEFAULT 'OPEN',
  kernel_sha       TEXT    NOT NULL,
  created_at       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kaas_valuations_ray_id ON kaas_valuations (ray_id);
CREATE INDEX IF NOT EXISTS idx_kaas_valuations_asn    ON kaas_valuations (asn);
