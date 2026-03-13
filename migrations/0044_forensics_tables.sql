-- migrations/0044_forensics_tables.sql
-- AveryOS™ Phase 114.3 — Forensic Engine Tables
--
-- Creates three tables:
--   1. chat_archives      — Full chat session archive with Merkle proofs (GATE 114.3.1)
--   2. vitality_metrics   — Performance Engine timing records (GATE 114.3.2)
--   3. qa_build_results   — QA / Performance / Security engine build-time results
--                           (saved to D1 + R2 cloudflare-managed-42f4b874/QA/qa_build_results/)
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

-- ── 1. Chat Archives (Phase 114.3 GATE 114.3.1) ───────────────────────────────
CREATE TABLE IF NOT EXISTS chat_archives (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT    NOT NULL,
  exchange_index  INTEGER NOT NULL CHECK (exchange_index >= 0),  -- 0-based, non-negative
  phase           TEXT    NOT NULL,          -- e.g. "114.3.1"
  prompt_text     TEXT    NOT NULL,          -- exact full prompt (all bytes)
  reply_text      TEXT    NOT NULL,          -- exact full reply (all bytes)
  prompt_sha256   TEXT    NOT NULL,          -- SHA-256 of prompt_text
  reply_sha256    TEXT    NOT NULL,          -- SHA-256 of reply_text
  leaf_hash       TEXT    NOT NULL,          -- SHA-256(prompt + NUL + reply)
  merkle_root     TEXT,                      -- session Merkle root (filled after session)
  prompt_at       TEXT    NOT NULL,          -- ISO-9 timestamp of prompt
  reply_at        TEXT    NOT NULL,          -- ISO-9 timestamp of reply
  kernel_sha      TEXT    NOT NULL,
  kernel_version  TEXT    NOT NULL,
  archived_at     TEXT    NOT NULL           -- ISO-9 timestamp of insertion

  , UNIQUE (session_id, exchange_index)
);

CREATE INDEX IF NOT EXISTS idx_chat_archives_session  ON chat_archives (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_archives_phase    ON chat_archives (phase);
CREATE INDEX IF NOT EXISTS idx_chat_archives_archived ON chat_archives (archived_at DESC);

-- ── 2. Vitality Metrics (Phase 114.3 GATE 114.3.2) ───────────────────────────
CREATE TABLE IF NOT EXISTS vitality_metrics (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  function_name   TEXT    NOT NULL,          -- name of measured function / operation
  start_ns        TEXT    NOT NULL,          -- ISO-9 start timestamp
  end_ns          TEXT    NOT NULL,          -- ISO-9 end timestamp
  delta_ms        REAL    NOT NULL,          -- elapsed ms (float)
  status          TEXT    NOT NULL,          -- "OK" | "ERROR" | "THROTTLED"
  error_message   TEXT,                      -- populated on ERROR status
  phase           TEXT    NOT NULL DEFAULT '114.3.2',
  kernel_sha      TEXT    NOT NULL,
  kernel_version  TEXT    NOT NULL,
  recorded_at     TEXT    NOT NULL           -- ISO-9 insertion timestamp
);

CREATE INDEX IF NOT EXISTS idx_vitality_function   ON vitality_metrics (function_name);
CREATE INDEX IF NOT EXISTS idx_vitality_status     ON vitality_metrics (status);
CREATE INDEX IF NOT EXISTS idx_vitality_recorded   ON vitality_metrics (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vitality_delta      ON vitality_metrics (delta_ms DESC);

-- ── 3. QA Build Results (logs from QA/Performance/Security engines) ───────────
-- Persisted to D1 + R2 path: cloudflare-managed-42f4b874/QA/qa_build_results/
CREATE TABLE IF NOT EXISTS qa_build_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  build_id        TEXT    NOT NULL UNIQUE,   -- CI run ID or UUID
  engine          TEXT    NOT NULL,          -- "QA" | "PERFORMANCE" | "SECURITY" | "FULL"
  branch          TEXT,                      -- git branch
  commit_sha      TEXT,                      -- git commit SHA
  status          TEXT    NOT NULL,          -- "pass" | "fail" | "partial"
  total_checks    INTEGER NOT NULL DEFAULT 0,
  passed_checks   INTEGER NOT NULL DEFAULT 0,
  failed_checks   INTEGER NOT NULL DEFAULT 0,
  duration_ms     REAL,                      -- total run duration
  r2_object_key   TEXT,                      -- R2 path for full result JSON
  result_json     TEXT,                      -- inline JSON (trimmed to 64 KB)
  kernel_sha      TEXT    NOT NULL,
  kernel_version  TEXT    NOT NULL,
  created_at      TEXT    NOT NULL           -- ISO-9 timestamp
);

CREATE INDEX IF NOT EXISTS idx_qa_build_engine   ON qa_build_results (engine);
CREATE INDEX IF NOT EXISTS idx_qa_build_status   ON qa_build_results (status);
CREATE INDEX IF NOT EXISTS idx_qa_build_created  ON qa_build_results (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_build_branch   ON qa_build_results (branch);
