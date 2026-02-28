"use client";

import React, { useEffect, useRef, useState } from "react";

type AuditLogItem = {
  id: number;
  entity: string;
  ip: string;
  status: string;
  timestamp: string;
  log_hash: string;
};

export default function AuditStreamTerminal() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/gatekeeper/logs", { cache: "no-store" });
        const data = (await res.json()) as AuditLogItem[];
        setLogs(Array.isArray(data) ? data : []);
        setConnected(true);
      } catch {
        setConnected(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div
      style={{
        backgroundColor: "#000",
        border: "1px solid #00FF41",
        borderRadius: "8px",
        padding: "1rem",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <span style={{ color: "#00FF41", fontWeight: 700, fontSize: "0.85rem" }}>
          !! LIVE FORENSIC AUDIT STREAM !!
        </span>
        <span
          style={{
            fontSize: "0.7rem",
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
            background: connected ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
            color: connected ? "#4ade80" : "#f87171",
            border: `1px solid ${connected ? "#4ade80" : "#f87171"}`,
          }}
        >
          {connected ? "● LIVE" : "○ CONNECTING…"}
        </span>
      </div>

      {/* Terminal output */}
      <div
        style={{
          maxHeight: "480px",
          overflowY: "auto",
          fontSize: "0.75rem",
          color: "#00FF41",
          lineHeight: "1.6",
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: "rgba(0,255,65,0.4)" }}>
            {">"} Awaiting audit events…
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              style={{ borderBottom: "1px solid rgba(0,255,65,0.1)", padding: "4px 0" }}
            >
              <span style={{ color: "rgba(0,255,65,0.55)" }}>[{log.timestamp}]</span>{" "}
              <span style={{ color: "#fff" }}>ACCESS_EVENT:</span> {log.entity} |{" "}
              <span>IP: {log.ip}</span> |{" "}
              <span
                style={{
                  color:
                    log.status === "SETTLEMENT_SUCCESS" || log.status === "VERIFY_CLICK"
                      ? "#4ade80"
                      : log.status.startsWith("SETTLEMENT_REJECTED")
                      ? "#f87171"
                      : "#00FF41",
                }}
              >
                STATUS: {log.status}
              </span>
              <div
                style={{
                  color: "rgba(0,255,65,0.35)",
                  fontSize: "0.65rem",
                  marginTop: "1px",
                  wordBreak: "break-all",
                  paddingLeft: "1rem",
                }}
              >
                LOG_HASH: {log.log_hash}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
