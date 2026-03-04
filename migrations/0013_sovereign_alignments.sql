-- Migration: 0013_sovereign_alignments
-- Creates the sovereign_alignments table for partner/individual alignment records.
CREATE TABLE IF NOT EXISTS sovereign_alignments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id      TEXT    NOT NULL,
  email           TEXT    NOT NULL,
  alignment_type  TEXT    NOT NULL CHECK(alignment_type IN ('CORPORATE_ALIGNMENT', 'INDIVIDUAL_ALIGNMENT')),
  badge_hash      TEXT    NOT NULL UNIQUE,
  aligned_at      TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_sovereign_alignments_badge_hash ON sovereign_alignments(badge_hash);
CREATE INDEX IF NOT EXISTS idx_sovereign_alignments_partner    ON sovereign_alignments(partner_id);
