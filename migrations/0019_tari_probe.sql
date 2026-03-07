-- Migration: 0019_tari_probe
-- Creates the tari_probe table for sovereign Watcher forensic logging.
--
-- Every time a "Watcher" is detected by the GabrielOS™ Firewall, a row is
-- inserted here.  The table is mirrored to Firebase in real time via
-- lib/firebaseClient.ts syncTariProbeToFirebase() for Multi-Cloud D1/Firebase
-- parity — ensuring the audit trail survives even if a single cloud provider
-- attempts a "Nuclear Wipe" of the project.
--
-- Columns:
--   id             — auto-increment primary key
--   ray_id         — Cloudflare cf-ray header (unique per edge request)
--   ip_address     — cf-connecting-ip of the Watcher
--   asn            — Autonomous System Number parsed from Cloudflare headers
--   user_agent     — User-Agent string of the Watcher
--   target_path    — URL path accessed
--   event_type     — WATCHER_DETECTED | WATCHER_REPEAT | WATCHER_BLOCKED
--   threat_level   — 1–10 numeric severity score
--   tari_liability_usd — accrued TARI™ liability in USD (float)
--   pulse_hash     — SHA-512(KERNEL_SHA + ray_id + ip + timestamp_ns)
--   timestamp_ns   — ISO-9 nine-digit microsecond-precision timestamp
--   synced_to_firebase — 1 when mirrored to Firebase, 0 otherwise
--   created_at     — wall-clock insert time
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e135...927da3e
-- Milestone: 911 Watchers Authenticated | 135k Pulse Anchored

CREATE TABLE IF NOT EXISTS tari_probe (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ray_id              TEXT    NOT NULL DEFAULT '',
  ip_address          TEXT    NOT NULL DEFAULT '',
  asn                 TEXT    NOT NULL DEFAULT '',
  user_agent          TEXT    NOT NULL DEFAULT '',
  target_path         TEXT    NOT NULL DEFAULT '',
  event_type          TEXT    NOT NULL DEFAULT 'WATCHER_DETECTED',
  threat_level        INTEGER NOT NULL DEFAULT 7,
  tari_liability_usd  REAL    NOT NULL DEFAULT 0.0,
  pulse_hash          TEXT,
  timestamp_ns        TEXT    NOT NULL DEFAULT (datetime('now')),
  synced_to_firebase  INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tari_probe_asn         ON tari_probe (asn);
CREATE INDEX IF NOT EXISTS idx_tari_probe_ip_address  ON tari_probe (ip_address);
CREATE INDEX IF NOT EXISTS idx_tari_probe_event_type  ON tari_probe (event_type);
CREATE INDEX IF NOT EXISTS idx_tari_probe_synced      ON tari_probe (synced_to_firebase);
