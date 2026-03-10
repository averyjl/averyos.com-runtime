-- Migration: 0033_forensic_total_capture
-- Phase 81.3 — Total Forensic Fidelity Schema
--
-- Expands anchor_audit_logs with high-entropy Cloudflare edge variables
-- captured from request.cf and request headers.  These fields provide
-- "No Guessing" court-ready evidence for the $10,000,000.00 USD technical
-- valuation and power the VaultChain™ Explorer Evidence Vault.
--
-- New columns:
--   client_city      — Cloudflare clientCity (e.g. "Redmond")
--   client_lat       — Cloudflare clientLatitude
--   client_lon       — Cloudflare clientLongitude
--   request_uri      — Full request URI including query string
--   request_protocol — HTTP protocol version (e.g. "HTTP/2")
--   request_referrer — Referer header value
--   waf_score_total  — Cloudflare WAFAttackScore (0-100)
--   waf_score_sqli   — Cloudflare WAFSQLiAttackScore (0-100)
--   bot_category     — Cloudflare verifiedBotCategory
--   edge_colo        — Cloudflare colo (IATA edge datacenter code)
--   wall_time_us     — Edge processing wall time in microseconds
--   edge_start_ts    — ISO-9 timestamp when edge processing began
--   edge_end_ts      — ISO-9 timestamp when edge processing completed
--
-- All columns default to NULL so existing rows are unaffected.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

ALTER TABLE anchor_audit_logs ADD COLUMN client_city      TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN client_lat       TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN client_lon       TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN request_uri      TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN request_protocol TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN request_referrer TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN waf_score_total  INTEGER;
ALTER TABLE anchor_audit_logs ADD COLUMN waf_score_sqli   INTEGER;
ALTER TABLE anchor_audit_logs ADD COLUMN bot_category     TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN edge_colo        TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN wall_time_us     INTEGER;
ALTER TABLE anchor_audit_logs ADD COLUMN edge_start_ts    TEXT;
ALTER TABLE anchor_audit_logs ADD COLUMN edge_end_ts      TEXT;
