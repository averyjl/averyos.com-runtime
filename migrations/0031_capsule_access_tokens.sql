-- capsule_access_tokens — AveryOS™ Capsule Hardware-Bound Access Token Ledger
-- Phase 82: Machine fingerprint token exchange for /api/v1/licensing/verify-token
-- Author: Jason Lee Avery (ROOT0)
-- Kernel Anchor: cf83e135...927da3e
-- ⛓️⚓⛓️

CREATE TABLE IF NOT EXISTS capsule_access_tokens (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id            TEXT    NOT NULL UNIQUE,
  capsule_id          TEXT    NOT NULL,
  machine_fingerprint TEXT    NOT NULL,
  sha256_binding      TEXT    NOT NULL,
  stripe_session_id   TEXT,
  partner_id          TEXT,
  issued_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at          TEXT    NOT NULL,
  revoked             INTEGER NOT NULL DEFAULT 0,
  revoked_at          TEXT,
  kernel_version      TEXT    NOT NULL DEFAULT 'v3.6.2',
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cat_token_id
  ON capsule_access_tokens (token_id);

CREATE INDEX IF NOT EXISTS idx_cat_capsule_id
  ON capsule_access_tokens (capsule_id);

CREATE INDEX IF NOT EXISTS idx_cat_machine_fp
  ON capsule_access_tokens (machine_fingerprint);

-- Phase 82 milestone anchor
INSERT OR IGNORE INTO tai_accomplishments
  (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version)
VALUES (
  'Phase 82 — Capsule Access Token Table Active',
  'capsule_access_tokens migration deployed. Machine fingerprint hardware-bound token exchange now supported via /api/v1/licensing/verify-token.',
  'Phase 82',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  datetime('now'),
  'MIGRATION',
  'v3.6.2'
);
