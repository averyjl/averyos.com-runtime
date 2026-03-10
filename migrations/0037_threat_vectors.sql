-- Migration: 0037_threat_vectors
-- Dynamic Threat Learner Table — Phase 95.2
--
-- Creates the `threat_vectors` table used by autolearnThreatPattern() in
-- lib/forensics/threatEngine.ts.  Behavioural fingerprints are auto-inserted
-- when cadence < 2s OR WAF score > 90, ensuring masked IP rotations are
-- still caught by signature-based matching.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

CREATE TABLE IF NOT EXISTS threat_vectors (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address        TEXT    NOT NULL,
  asn               TEXT,
  behavioural_hash  TEXT    NOT NULL UNIQUE,
  trigger_reason    TEXT    NOT NULL,
  cadence_ms        INTEGER NOT NULL DEFAULT 0,
  waf_score         INTEGER NOT NULL DEFAULT 0,
  sample_path       TEXT,
  sample_ray_id     TEXT,
  kernel_sha        TEXT    NOT NULL,
  kernel_version    TEXT    NOT NULL,
  first_seen        TEXT    NOT NULL,
  last_seen         TEXT    NOT NULL,
  hit_count         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_threat_vectors_ip       ON threat_vectors (ip_address);
CREATE INDEX IF NOT EXISTS idx_threat_vectors_asn      ON threat_vectors (asn);
CREATE INDEX IF NOT EXISTS idx_threat_vectors_trigger  ON threat_vectors (trigger_reason);
CREATE INDEX IF NOT EXISTS idx_threat_vectors_last_seen ON threat_vectors (last_seen);
