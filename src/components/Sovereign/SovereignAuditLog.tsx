"use client";

// AveryOS™ Sovereign Audit Stream - Legal Tripwire
// Status: [PHYSICAL EXECUTION] | Auth: Crater-Root

import React, { useEffect, useState } from "react";

interface AuditEntry {
  id: number;
  event_type: string;
  ip_address: string;
  geo_location: string | null;
  target_path: string;
  timestamp_ns: string;
  threat_level: number | null;
  forensic_pulse?: string;
}

interface TopEntity {
  ip: string;
  geo: string;
  count: number;
}

const FLASH_KEYFRAME = `
  @keyframes auditFlash {
    0%, 100% { opacity: 1; background: rgba(255,0,0,0.12); }
    50%       { opacity: 0.6; background: rgba(255,0,0,0.38); }
  }
`;

function getTopEntities(logs: AuditEntry[], limit = 5): TopEntity[] {
  const counts: Record<string, { geo: string; count: number }> = {};
  for (const log of logs) {
    const key = log.ip_address;
    if (!counts[key]) {
      counts[key] = { geo: log.geo_location ?? "UNKNOWN", count: 0 };
    }
    counts[key].count++;
  }
  return Object.entries(counts)
    .map(([ip, v]) => ({ ip, geo: v.geo, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

const SovereignAuditLog = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? (window.sessionStorage.getItem("sovereign_handshake") ?? "")
            : "";
        const res = await fetch("/api/v1/audit-stream", {
          headers: { Authorization: `Handshake ${token}` },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(Array.isArray(data) ? (data as AuditEntry[]) : []);
          setStreamError(null);
        } else {
          setStreamError(`STREAM_${res.status}`);
        }
      } catch {
        setStreamError("CONNECTION_FAILURE");
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const topEntities = getTopEntities(logs);

  return (
    <div
      style={{
        backgroundColor: "#000",
        color: "#00FF41",
        padding: "1.25rem",
        border: "1px solid #FF0000",
        borderRadius: "8px",
        fontFamily: "JetBrains Mono, Courier New, monospace",
      }}
    >
      <style>{FLASH_KEYFRAME}</style>

      <h3
        style={{
          color: "#FF0000",
          margin: "0 0 0.75rem 0",
          fontSize: "0.85rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        🛡️ LEGAL TRIPWIRE · SOVEREIGN AUDIT STREAM
      </h3>

      {/* Top 5 Legal Entities Panel */}
      {topEntities.length > 0 && (
        <div
          style={{
            marginBottom: "1rem",
            border: "1px solid rgba(255,0,0,0.3)",
            borderRadius: "6px",
            padding: "0.6rem 0.8rem",
            fontSize: "0.72rem",
          }}
        >
          <div
            style={{
              color: "#FFD700",
              fontWeight: 700,
              marginBottom: "0.4rem",
              letterSpacing: "0.06em",
            }}
          >
            ⚖️ TOP {topEntities.length} LEGAL ENTITIES DETECTED
          </div>
          {topEntities.map((e, i) => (
            <div
              key={e.ip}
              style={{
                color: i === 0 ? "#FF0000" : "#00FF41",
                padding: "2px 0",
              }}
            >
              #{i + 1}&nbsp;{e.ip}&nbsp;|&nbsp;{e.geo}&nbsp;—&nbsp;
              {e.count}&nbsp;hit{e.count !== 1 ? "s" : ""}
            </div>
          ))}
        </div>
      )}

      {/* Live log entries */}
      <div
        style={{ maxHeight: "200px", overflowY: "auto", fontSize: "0.78rem" }}
      >
        {streamError ? (
          <div
            style={{ color: "rgba(248,113,113,0.85)", fontSize: "0.75rem" }}
          >
            ⚠ {streamError}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ color: "rgba(0,255,65,0.4)" }}>
            {">"} No audit entries on record…
          </div>
        ) : (
          logs.map((log) => {
            const isCritical = (log.threat_level ?? 0) >= 10;
            return (
              <div
                key={log.id}
                style={{
                  color: isCritical ? "#FF0000" : "#00FF41",
                  animation: isCritical ? "auditFlash 1s infinite" : "none",
                  borderBottom: "1px solid rgba(0,255,65,0.1)",
                  padding: "3px 0",
                  lineHeight: 1.5,
                }}
              >
                [{log.timestamp_ns}] {log.event_type}: {log.ip_address} |{" "}
                {log.target_path}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SovereignAuditLog;
