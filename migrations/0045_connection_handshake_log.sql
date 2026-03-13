-- migrations/0045_connection_handshake_log.sql
-- AveryOS™ Sovereign Connection Handshake Log
--
-- Every external service call (Stripe, Firebase, Cloudflare API, etc.) that
-- goes through sovereignFetch() in lib/handshake.ts is logged here.
-- Failed connections (timeout, network error, non-2xx/3xx) are explicitly
-- recorded as ok=0 so operators can audit connectivity issues.
--
-- R2 mirror path: cloudflare-managed-42f4b874/QA/qa_build_results/
--
-- Author: Jason Lee Avery (ROOT0)
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

CREATE TABLE IF NOT EXISTS connection_handshake_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name    TEXT    NOT NULL,          -- e.g. "Stripe", "Firebase", "Cloudflare"
  url             TEXT    NOT NULL,          -- request URL (truncated to 512 chars)
  status_code     INTEGER NOT NULL DEFAULT 0,-- HTTP status returned (0 = no response)
  ok              INTEGER NOT NULL DEFAULT 0,-- 1 = confirmed success, 0 = failure
  error_message   TEXT,                      -- reason if ok=0
  duration_ms     REAL    NOT NULL,          -- round-trip time in ms
  phase           TEXT,                      -- e.g. "114.3"
  kernel_sha      TEXT    NOT NULL,
  kernel_version  TEXT    NOT NULL,
  logged_at       TEXT    NOT NULL           -- ISO-9 timestamp
);

CREATE INDEX IF NOT EXISTS idx_handshake_service   ON connection_handshake_log (service_name);
CREATE INDEX IF NOT EXISTS idx_handshake_ok        ON connection_handshake_log (ok);
CREATE INDEX IF NOT EXISTS idx_handshake_logged    ON connection_handshake_log (logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_handshake_status    ON connection_handshake_log (status_code);
