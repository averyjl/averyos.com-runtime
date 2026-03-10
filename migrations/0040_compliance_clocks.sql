-- Migration: 0040_compliance_clocks
-- Compliance Clocks Table — Phase 106 / Gate 106.4
--
-- Tracks 72-hour settlement clocks issued by the Forensic Sandbox Handshake,
-- Statutory Handshake, and Compliance Notice endpoints.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

CREATE TABLE IF NOT EXISTS compliance_clocks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  clock_id        TEXT    NOT NULL UNIQUE,
  entity_id       TEXT,                            -- ASN, IP, or org identifier
  asn             TEXT,
  org_name        TEXT,
  status          TEXT    NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | EXPIRED | SETTLED
  issued_at       TEXT    NOT NULL,
  deadline_at     TEXT    NOT NULL,
  settled_at      TEXT,
  escalated_at    TEXT,
  source_endpoint TEXT,                            -- Which endpoint triggered the clock
  affidavit_token TEXT,                            -- Linked affidavit token (if any)
  debt_cents      INTEGER,                         -- Debt amount at issuance
  stripe_session_id TEXT,                          -- Stripe session if escalated
  kernel_sha      TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_clocks_status     ON compliance_clocks (status);
CREATE INDEX IF NOT EXISTS idx_compliance_clocks_asn        ON compliance_clocks (asn);
CREATE INDEX IF NOT EXISTS idx_compliance_clocks_entity_id  ON compliance_clocks (entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_clocks_deadline   ON compliance_clocks (deadline_at);
