-- Migration: 0032_sha_refactor
-- Phase 81.2 — SHA Column Consolidation & Request Method Tracking
--
-- The `sha512` column in anchor_audit_logs was originally populated with the
-- Cloudflare RayID (used as a unique anchor key), while `sha512_payload` was
-- added in 0031 with default 'PENDING_SHA' for rows that predate payload
-- hashing.  This migration:
--
--   1. Promotes any pre-existing sha512 value into sha512_payload for rows
--      where sha512_payload is still the default sentinel.
--   2. Drops the now-redundant `sha512` column.
--   3. Adds `request_method` (GET/POST/etc.) for Action Tracking across the
--      25,836 forensic log entries.
--
-- Safe to apply on a live table — UPDATE touches only rows still at default.
-- DROP COLUMN removes the legacy RayID-as-SHA slot without data loss because
-- all meaningful values have been promoted or were already duplicated.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

-- Promote legacy sha512 value into sha512_payload for sentinel rows
UPDATE anchor_audit_logs
   SET sha512_payload = sha512
 WHERE sha512_payload = 'PENDING_SHA';

-- Remove the now-redundant legacy column
ALTER TABLE anchor_audit_logs DROP COLUMN sha512;

-- Track HTTP verb for every audit entry
ALTER TABLE anchor_audit_logs ADD COLUMN request_method TEXT DEFAULT 'GET';
