-- Migration: 0014_sovereign_capsules
-- Sovereign Capsule Repository: marketplace listings + per-user licenses.

-- sovereign_capsules: each row is one .aoscap unit available for purchase.
CREATE TABLE IF NOT EXISTS sovereign_capsules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  capsule_id      TEXT    NOT NULL UNIQUE,          -- slug / filename stem
  title           TEXT    NOT NULL,
  description     TEXT,
  sha512          TEXT    NOT NULL,                 -- SHA-512 of the capsule content
  genesis_date    TEXT    NOT NULL,                 -- ISO-8601 date
  tari_fee_usd    REAL    NOT NULL DEFAULT 1.00,    -- TARI™ Alignment Fee in USD
  file_key        TEXT,                             -- R2 object key (averyos-capsules/<id>)
  status          TEXT    NOT NULL DEFAULT 'ACTIVE'
                  CHECK(status IN ('ACTIVE','ARCHIVED','DRAFT')),
  uploaded_at     TEXT    NOT NULL,
  uploaded_by     TEXT    NOT NULL DEFAULT 'SOVEREIGN_ADMIN'
);

CREATE INDEX IF NOT EXISTS idx_sovereign_capsules_status
  ON sovereign_capsules(status);

-- capsule_licenses: one row per user who has paid for a capsule.
-- download_token is a time-limited secret handed out after payment.
CREATE TABLE IF NOT EXISTS capsule_licenses (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  capsule_id              TEXT    NOT NULL,
  email                   TEXT    NOT NULL,
  stripe_session_id       TEXT    NOT NULL UNIQUE,
  stripe_payment_intent   TEXT,
  download_token          TEXT    UNIQUE,           -- one-time or time-limited token
  token_expires_at        TEXT,                     -- ISO-8601 UTC
  licensed_at             TEXT,
  status                  TEXT    NOT NULL DEFAULT 'PENDING'
                          CHECK(status IN ('PENDING','ACTIVE','EXPIRED','REFUNDED')),
  FOREIGN KEY(capsule_id) REFERENCES sovereign_capsules(capsule_id)
);

CREATE INDEX IF NOT EXISTS idx_capsule_licenses_email
  ON capsule_licenses(email);
CREATE INDEX IF NOT EXISTS idx_capsule_licenses_token
  ON capsule_licenses(download_token);
CREATE INDEX IF NOT EXISTS idx_capsule_licenses_session
  ON capsule_licenses(stripe_session_id);
