-- Migration 0038: KaaS Ledger — Phase 98
--
-- Creates the kaas_ledger table to track all Knowledge-as-a-Service (KaaS)
-- billing events end-to-end: ingestion detection, invoice generation, Stripe
-- checkout creation, and settlement.  Complements kaas_valuations (0037)
-- which stores per-ASN valuations; this table is the running transaction log.
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

CREATE TABLE IF NOT EXISTS kaas_ledger (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  valuation_id       INTEGER REFERENCES kaas_valuations(id) ON DELETE SET NULL,
  ray_id             TEXT    NOT NULL,
  asn                TEXT    NOT NULL,
  org_name           TEXT,
  event_type         TEXT    NOT NULL
                       CHECK (event_type IN (
                         'INGESTION_DETECTED', 'INVOICE_CREATED', 'CHECKOUT_OPENED',
                         'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'DISPUTED', 'WRITTEN_OFF'
                       )),
  amount_usd         REAL    NOT NULL DEFAULT 0.0,
  stripe_invoice_id  TEXT,
  stripe_session_id  TEXT,
  stripe_charge_id   TEXT,
  proof_sha512       TEXT,
  kernel_sha         TEXT    NOT NULL,
  kernel_version     TEXT    NOT NULL DEFAULT 'v3.6.2',
  path               TEXT,
  notes              TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kaas_ledger_asn
  ON kaas_ledger (asn);

CREATE INDEX IF NOT EXISTS idx_kaas_ledger_ray_id
  ON kaas_ledger (ray_id);

CREATE INDEX IF NOT EXISTS idx_kaas_ledger_event_type
  ON kaas_ledger (event_type);

CREATE INDEX IF NOT EXISTS idx_kaas_ledger_created_at
  ON kaas_ledger (created_at);

CREATE INDEX IF NOT EXISTS idx_kaas_ledger_stripe_invoice_id
  ON kaas_ledger (stripe_invoice_id);
