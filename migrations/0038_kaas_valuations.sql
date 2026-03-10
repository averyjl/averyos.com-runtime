-- Migration: 0038_kaas_valuations
-- Phase 97/98 — KaaS (Kernel-as-a-Service) Valuations Ledger
-- Stores forensic valuation records for every entity that triggered a
-- KAAS_BREACH event.  Each row represents a distinct ASN/IP combination
-- with its current payment status ('PENDING', 'SETTLED', 'DISPUTED').

CREATE TABLE IF NOT EXISTS kaas_valuations (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  ray_id                     TEXT,
  asn                        TEXT    NOT NULL,
  ip_address                 TEXT    NOT NULL,
  tier                       INTEGER NOT NULL DEFAULT 1,
  valuation_usd              REAL    NOT NULL,
  status                     TEXT    NOT NULL DEFAULT 'PENDING',
  knowledge_cutoff_correlation TEXT,
  ingestion_verified         INTEGER NOT NULL DEFAULT 0,
  capsule_sha512             TEXT,
  stripe_invoice_id          TEXT,
  stripe_checkout_url        TEXT,
  pulse_hash                 TEXT,
  kernel_version             TEXT    NOT NULL DEFAULT 'v3.6.2',
  created_at                 TEXT    NOT NULL,
  settled_at                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_kaas_valuations_status  ON kaas_valuations (status);
CREATE INDEX IF NOT EXISTS idx_kaas_valuations_asn     ON kaas_valuations (asn);
CREATE INDEX IF NOT EXISTS idx_kaas_valuations_created ON kaas_valuations (created_at);
