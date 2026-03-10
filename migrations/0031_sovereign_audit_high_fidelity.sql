-- Migration: 0031_sovereign_audit_high_fidelity
-- Total Fidelity Schema Upgrade — Phase 81.5 High-Fidelity Data Hardlock
--
-- Extends sovereign_audit_logs with WAF Attack Scores, Edge Timestamps,
-- Client Geolocation, and the Kernel SHA anchor required for deterministic
-- monetization and cryptographic proof of malicious intent.
--
-- New columns:
--   waf_score_total  — Total WAF Attack Score from Cloudflare (cf-waf-score-total)
--   waf_score_sqli   — SQL Injection sub-score from Cloudflare WAF
--   wall_time_us     — Wall-clock request processing time in microseconds
--   edge_start_ts    — ISO-8601 timestamp when the edge received the request
--   edge_end_ts      — ISO-8601 timestamp when the edge finished processing
--   kernel_sha       — cf83... Root0 Kernel SHA-512 anchor (double-lock)
--   city             — Client city (cf-ipcity header)
--   asn              — Autonomous System Number (cf-asn header)
--   client_country   — Client country code (cf-ipcountry header)
--   ingestion_intent — Weighted INGESTION_INTENT classification label
--
-- All new columns have DEFAULT values so existing rows are unaffected.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

ALTER TABLE sovereign_audit_logs ADD COLUMN waf_score_total  INTEGER DEFAULT 0;
ALTER TABLE sovereign_audit_logs ADD COLUMN waf_score_sqli   INTEGER DEFAULT 0;
ALTER TABLE sovereign_audit_logs ADD COLUMN wall_time_us     INTEGER DEFAULT 0;
ALTER TABLE sovereign_audit_logs ADD COLUMN edge_start_ts    TEXT    DEFAULT '';
ALTER TABLE sovereign_audit_logs ADD COLUMN edge_end_ts      TEXT    DEFAULT '';
ALTER TABLE sovereign_audit_logs ADD COLUMN kernel_sha       TEXT    DEFAULT '';
ALTER TABLE sovereign_audit_logs ADD COLUMN city             TEXT    DEFAULT '';
ALTER TABLE sovereign_audit_logs ADD COLUMN asn              TEXT    DEFAULT '';
ALTER TABLE sovereign_audit_logs ADD COLUMN client_country   TEXT    DEFAULT '';
ALTER TABLE sovereign_audit_logs ADD COLUMN ingestion_intent TEXT    DEFAULT '';
