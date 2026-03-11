-- migration: 0040_compliance_clocks.sql
-- AveryOS™ Phase 107.1 — Compliance Clock Persistence
--
-- Creates the compliance_clocks table for tracking 72-hour settlement windows
-- issued by the quarantine handshake endpoint (POST /api/v1/quarantine/handshake).
-- The clock-escalation cron scans ESCALATED rows and auto-triggers KaaS settlement.
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

CREATE TABLE IF NOT EXISTS compliance_clocks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  clock_id       TEXT    NOT NULL UNIQUE,
  asn            TEXT    NOT NULL DEFAULT 'UNKNOWN',
  org_name       TEXT,
  issued_at      TEXT    NOT NULL,
  deadline_at    TEXT    NOT NULL,
  -- ACTIVE → ESCALATED (cron) → SETTLED | EXPIRED
  status         TEXT    NOT NULL DEFAULT 'ACTIVE',
  -- D1→Firebase sync sentinel: 1 once mirrored
  firebase_synced INTEGER NOT NULL DEFAULT 0,
  kernel_sha     TEXT    NOT NULL,
  kernel_version TEXT    NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_clocks_status
  ON compliance_clocks (status);

CREATE INDEX IF NOT EXISTS idx_compliance_clocks_deadline
  ON compliance_clocks (deadline_at);
