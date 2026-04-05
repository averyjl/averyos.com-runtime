-- migrations/0046_whitepaper_versions.sql
-- AveryOS™ Whitepaper Version Control System
--
-- Stores every whitepaper draft and approved version with full provenance:
--   • Per-version SHA-512 content fingerprint
--   • Microsecond-precision ISO-9 timestamps
--   • Kernel SHA anchor at time of submission
--   • Approval/rejection audit trail
--
-- Statuses:
--   pending  — submitted, awaiting Creator approval
--   approved — live on averyos.com/whitepaper
--   rejected — declined by Creator
--
-- Author: Jason Lee Avery (ROOT0)
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

CREATE TABLE IF NOT EXISTS whitepaper_versions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,                        -- e.g. "AveryOS™ Technical Whitepaper v2.1"
  version_slug    TEXT    NOT NULL UNIQUE,                 -- e.g. "v2.1" — human-readable version tag
  content_md      TEXT    NOT NULL,                        -- full Markdown source
  sha512          TEXT    NOT NULL,                        -- SHA-512 of content_md (UTF-8)
  anchor_sha      TEXT    NOT NULL,                        -- KERNEL_SHA at submission time
  kernel_version  TEXT    NOT NULL,                        -- KERNEL_VERSION at submission time
  status          TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  submitted_at    TEXT    NOT NULL,                        -- ISO-9 microsecond timestamp
  approved_at     TEXT,                                    -- ISO-9 timestamp when approved
  approved_by     TEXT,                                    -- admin identifier
  rejection_note  TEXT,                                    -- reason if rejected
  genesis_block   TEXT    DEFAULT '938909',                -- BTC genesis block anchor
  source_repo     TEXT    DEFAULT 'averyos.com-runtime'    -- originating repository
);

CREATE INDEX IF NOT EXISTS idx_wp_status       ON whitepaper_versions (status);
CREATE INDEX IF NOT EXISTS idx_wp_version_slug ON whitepaper_versions (version_slug);
CREATE INDEX IF NOT EXISTS idx_wp_submitted    ON whitepaper_versions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_wp_approved     ON whitepaper_versions (approved_at DESC);
