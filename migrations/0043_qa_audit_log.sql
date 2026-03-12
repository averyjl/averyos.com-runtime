-- migrations/0043_qa_audit_log.sql
-- AveryOS™ Sovereign QA Engine — Phase 112 / GATE 112.1
-- QA run audit log persisted to D1 and VaultChain.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

CREATE TABLE IF NOT EXISTS qa_audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          TEXT    NOT NULL UNIQUE,
  trigger         TEXT    NOT NULL,                  -- 'ci' | 'manual' | 'scheduled' | 'ai_generator'
  status          TEXT    NOT NULL,                  -- 'pass' | 'fail' | 'partial'
  total_tests     INTEGER NOT NULL DEFAULT 0,
  passed_tests    INTEGER NOT NULL DEFAULT 0,
  failed_tests    INTEGER NOT NULL DEFAULT 0,
  sha512          TEXT    NOT NULL,                  -- SHA-512 tamper-evident seal
  kernel_sha      TEXT    NOT NULL,
  kernel_version  TEXT    NOT NULL,
  run_details     TEXT,                              -- JSON blob of QaRunRecord.suites
  created_at      TEXT    NOT NULL                   -- ISO-9 timestamp
);

CREATE INDEX IF NOT EXISTS idx_qa_audit_log_created  ON qa_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_audit_log_status   ON qa_audit_log (status);
CREATE INDEX IF NOT EXISTS idx_qa_audit_log_trigger  ON qa_audit_log (trigger);
