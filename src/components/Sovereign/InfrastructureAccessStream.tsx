"use client";

// AveryOS™ Infrastructure Access Stream
// Gated administrative component — requires isAuthenticated === true

import React, { useCallback, useEffect, useRef, useState } from "react";

interface AuditStreamEntry {
  id: number;
  event_type: string;
  ip_address: string;
  geo_location: string | null;
  target_path: string;
  forensic_pulse: string;
  threat_level: number | null;
}

interface InfrastructureAccessStreamProps {
  isAuthenticated: boolean;
}

const POLL_INTERVAL_MS = 3000;

const FLASH_KEYFRAME = `
  @keyframes infraFlash {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.25; }
  }
`;

export default function InfrastructureAccessStream({
  isAuthenticated,
}: InfrastructureAccessStreamProps) {
  // Gated: render nothing when not authenticated
  if (!isAuthenticated) return null;

  return <AccessStreamInner />;
}

function AccessStreamInner() {
  const [entries, setEntries] = useState<AuditStreamEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchStream = useCallback(async () => {
    try {
      const token =
        window.sessionStorage.getItem("sovereign_handshake") ?? "";
      const res = await fetch("/api/v1/audit-stream", {
        headers: { Authorization: `Handshake ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data) ? (data as AuditStreamEntry[]) : []);
        setConnected(true);
        setStreamError(null);
      } else {
        setStreamError(`STREAM_ERROR_${res.status}`);
        setConnected(false);
      }
    } catch {
      setStreamError("CONNECTION_FAILURE");
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchStream();
    const interval = setInterval(fetchStream, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStream]);

  // Auto-scroll to latest entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div
      style={{
        backgroundColor: "#000",
        border: "1px solid #00FF41",
        borderRadius: "8px",
        padding: "1rem 1.25rem",
        fontFamily: "JetBrains Mono, Courier New, monospace",
      }}
    >
      <style>{FLASH_KEYFRAME}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <span
          style={{
            color: "#00FF41",
            fontWeight: 700,
            fontSize: "0.82rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ⛓️ Infrastructure Access Stream
        </span>
        <span
          style={{
            fontSize: "0.68rem",
            padding: "0.15rem 0.45rem",
            borderRadius: "4px",
            background: connected
              ? "rgba(0,255,65,0.1)"
              : "rgba(248,113,113,0.1)",
            color: connected ? "#00FF41" : "#f87171",
            border: `1px solid ${connected ? "#00FF41" : "#f87171"}`,
          }}
        >
          {connected ? "● LIVE" : "○ CONNECTING…"}
        </span>
      </div>

      {/* Log entries */}
      <div
        style={{
          maxHeight: "320px",
          overflowY: "auto",
          fontSize: "0.74rem",
          lineHeight: 1.6,
          color: "#00FF41",
        }}
      >
        {streamError ? (
          <div style={{ color: "#f87171" }}>⚠ {streamError}</div>
        ) : entries.length === 0 ? (
          <div style={{ color: "rgba(0,255,65,0.35)" }}>
            {">"} No access events on record…
          </div>
        ) : (
          entries.map((entry) => {
            const isCritical = (entry.threat_level ?? 0) >= 10;
            const rowColor = isCritical ? "#FF0000" : "#00FF41";
            return (
              <div
                key={entry.id}
                style={{
                  borderBottom: "1px solid rgba(0,255,65,0.1)",
                  padding: "3px 0",
                  color: rowColor,
                  animation: isCritical
                    ? "infraFlash 1s ease-in-out infinite"
                    : undefined,
                }}
              >
                <span style={{ color: "rgba(0,255,65,0.45)" }}>
                  [{entry.forensic_pulse}]
                </span>{" "}
                <span style={{ fontWeight: 700 }}>{entry.event_type}</span>{" "}
                <span style={{ color: "#fff" }}>→</span>{" "}
                <span>{entry.target_path}</span>{" "}
                <span style={{ color: "rgba(0,255,65,0.55)" }}>
                  | {entry.ip_address}
                  {entry.geo_location ? ` | ${entry.geo_location}` : ""}
                </span>{" "}
                <span
                  style={{
                    fontSize: "0.62rem",
                    padding: "0 0.25rem",
                    borderRadius: "2px",
                    background: isCritical
                      ? "rgba(255,0,0,0.15)"
                      : "rgba(0,255,65,0.08)",
                    border: `1px solid ${isCritical ? "#FF0000" : "rgba(0,255,65,0.25)"}`,
                  }}
                >
                  TL:{entry.threat_level ?? "—"}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
