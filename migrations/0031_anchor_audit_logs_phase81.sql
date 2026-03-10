-- Migration: 0031_anchor_audit_logs_phase81
-- Phase 81.1 — Forensic Hydration & Intent Classification
--
-- Extends anchor_audit_logs (0018) with Phase 81 forensic columns:
--   sha512_payload        — raw-request SHA-512 (distinct from the RayID sha512 used as an anchor key)
--   hydration_status      — 0 = pending post-process hydration, 1 = hydrated
--   country_name          — full country name (populated by Hydration Bot)
--   entity_type           — entity classification (e.g. CORPORATE, BOT, HUMAN)
--   intent_classification — intent label (e.g. PROBE, INGESTION_ATTEMPT, LEGAL_SCAN)
--
-- These columns are safe to add to an existing table; D1 applies exactly once.
-- Existing rows receive the DEFAULT values specified below.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

ALTER TABLE anchor_audit_logs ADD COLUMN sha512_payload      TEXT    DEFAULT 'PENDING_SHA';
ALTER TABLE anchor_audit_logs ADD COLUMN hydration_status    INTEGER DEFAULT 0;
ALTER TABLE anchor_audit_logs ADD COLUMN country_name        TEXT    DEFAULT 'Global/Unknown';
ALTER TABLE anchor_audit_logs ADD COLUMN entity_type         TEXT    DEFAULT 'IDENTIFYING';
ALTER TABLE anchor_audit_logs ADD COLUMN intent_classification TEXT  DEFAULT 'PROBE';
