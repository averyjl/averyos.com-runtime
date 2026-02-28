CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  ip TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now', 'localtime'))
);

INSERT INTO audit_logs (entity, ip, status, timestamp)
SELECT 'System_Init', '127.0.0.1', 'AVERYOS_BOOT_SUCCESS', datetime('now', 'localtime')
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE entity = 'System_Init' AND status = 'AVERYOS_BOOT_SUCCESS');
