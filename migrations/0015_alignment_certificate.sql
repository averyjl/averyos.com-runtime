-- Migration: 0015_alignment_certificate
-- Extends sovereign_alignments with Sovereign Certificate fields:
--   partner_name   — display name of the corporate / individual entity
--   settlement_id  — TARI™ settlement identifier
--   alignment_hash — sha512(partnerId + settlementId + KERNEL_SHA + timestamp)
--   tari_reference — human-readable TARI reference (e.g. TARI-SETTLE-1017-001)
--   valid_until    — ISO-8601 UTC expiry timestamp

ALTER TABLE sovereign_alignments ADD COLUMN partner_name    TEXT;
ALTER TABLE sovereign_alignments ADD COLUMN settlement_id   TEXT;
ALTER TABLE sovereign_alignments ADD COLUMN alignment_hash  TEXT;
ALTER TABLE sovereign_alignments ADD COLUMN tari_reference  TEXT;
ALTER TABLE sovereign_alignments ADD COLUMN valid_until     TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sovereign_alignments_alignment_hash
  ON sovereign_alignments(alignment_hash)
  WHERE alignment_hash IS NOT NULL;
