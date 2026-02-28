"use client";

import React, { useEffect, useState } from "react";

type AuditLogItem = {
  id: number;
  entity: string;
  ip: string;
  status: string;
  timestamp: string;
  log_hash: string;
};

const SovereignAuditLog = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/gatekeeper/logs", { cache: "no-store" });
        const data = (await res.json()) as AuditLogItem[];
        setLogs(Array.isArray(data) ? data : []);
      } catch {
        setLogs([]);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ backgroundColor: "#000", border: "1px solid #FF0000", padding: "15px", marginTop: "30px" }}>
      <h3 style={{ color: "#FF0000", margin: "0 0 10px 0" }}>!! LIVE FORENSIC AUDIT STREAM !!</h3>
      <div style={{ maxHeight: "260px", overflowY: "scroll", fontSize: "0.8em", color: "#00FF41" }}>
        {logs.map((log) => (
          <div key={log.id} style={{ borderBottom: "1px solid #222", padding: "6px 0" }}>
            [{log.timestamp}] ACCESS_EVENT: {log.entity} | IP: {log.ip} | STATUS: {log.status}
            <div style={{ color: "#888", fontSize: "0.75em", marginTop: "2px", wordBreak: "break-all" }}>
              LOG_HASH: {log.log_hash}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SovereignAuditLog;
