-- Migration: 0016_anchor_audit_logs_extend
-- Extends the anchor_audit_logs table (created in 0009) with additional
-- columns required by the Ollama ALM terminal uplink and settlement engine.
--
-- Columns added:
--   event_type     — OLLAMA_ANCHOR | OLLAMA_ALM_RESPONSE | SEAL_APPROVED | etc.
--   kernel_sha     — cf83... sovereign kernel SHA-512 at time of log
--   pulse_hash     — SHA-512(KERNEL_SHA + prompt + response)
--   thought_summary — truncated prose summary (first 512 chars of Ollama output)
--   timestamp      — ISO-8601 wall-clock time of the event
--
-- The ALTER TABLE … ADD COLUMN statements are safe to re-run; D1 will error
-- only if the column already exists.  In production Cloudflare D1 migrations
-- are applied exactly once via wrangler d1 migrations apply.

ALTER TABLE anchor_audit_logs ADD COLUMN event_type     TEXT    DEFAULT 'OLLAMA_ANCHOR';
ALTER TABLE anchor_audit_logs ADD COLUMN kernel_sha     TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN pulse_hash     TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN thought_summary TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP;
