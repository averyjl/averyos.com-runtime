-- Migration: 0018_anchor_audit_logs_rayid
-- Extends anchor_audit_logs (0009 + 0016) with edge-request forensic columns.
--
-- New columns:
--   ray_id     — Cloudflare cf-ray header value (e.g. "abc123def456-IAD")
--   ip_address — cf-connecting-ip from the edge request
--   path       — request pathname (e.g. "/hooks", "/.env")
--   asn        — autonomous system number parsed from Cloudflare headers
--
-- These columns are written by middleware.ts logRayIdAudit() on every request
-- and are consumed by the Forensic Dashboard at /admin/forensics.
--
-- The ALTER TABLE … ADD COLUMN statements are applied exactly once by wrangler's
-- migration-tracking system.  Each column has a safe DEFAULT so existing rows
-- are unaffected.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e

ALTER TABLE anchor_audit_logs ADD COLUMN ray_id     TEXT    DEFAULT '';
ALTER TABLE anchor_audit_logs ADD COLUMN ip_address TEXT    DEFAULT '';
ALTER TABLE anchor_audit_logs ADD COLUMN path       TEXT    DEFAULT '';
ALTER TABLE anchor_audit_logs ADD COLUMN asn        TEXT    DEFAULT '';
