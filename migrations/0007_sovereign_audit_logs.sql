CREATE TABLE IF NOT EXISTS sovereign_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    geo_location TEXT,
    target_path TEXT NOT NULL,
    timestamp_ns TEXT NOT NULL,
    threat_level INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON sovereign_audit_logs(timestamp_ns);
