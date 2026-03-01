"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface AuditStreamEntry {
  id: number;
  event_type: string;
  ip_address: string;
  geo_location: string | null;
  target_path: string;
  forensic_pulse: string;
  threat_level: number | null;
}

const POLL_INTERVAL_MS = 3000;
const FLASH_ANIMATION = "auditFlash";

export default function SovereignAuditStream() {
  const [entries, setEntries] = useState<AuditStreamEntry[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Restore cached passphrase from sessionStorage on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("sovereign_handshake");
      if (cached) setToken(cached);
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const fetchStream = useCallback(
    async (activeToken: string) => {
      try {
        const res = await fetch("/api/v1/audit-stream", {
          headers: { Authorization: `Bearer ${activeToken}` },
          cache: "no-store",
        });
        if (res.status === 401) {
          setToken(null);
          setConnected(false);
          try {
            sessionStorage.removeItem("sovereign_handshake");
          } catch {
            // ignore
          }
          return;
        }
        const data = (await res.json()) as AuditStreamEntry[];
        if (Array.isArray(data)) {
          // Identify new LEGAL_SCAN entries to flash
          const newIds = new Set(
            data
              .filter((e) => e.event_type === "LEGAL_SCAN")
              .map((e) => e.id)
          );
          setFlashIds(newIds);
          setEntries(data);
          setConnected(true);
        }
      } catch {
        setConnected(false);
      }
    },
    []
  );

  // Start polling when token is available
  useEffect(() => {
    if (!token) return;
    fetchStream(token);
    const interval = setInterval(() => fetchStream(token), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, fetchStream]);

  // Auto-scroll terminal to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passphrase.trim();
    if (!trimmed) return;
    try {
      sessionStorage.setItem("sovereign_handshake", trimmed);
    } catch {
      // ignore
    }
    setAuthError(null);
    setToken(trimmed);
  };

  // Passphrase gate
  if (!token) {
    return (
      <div
        style={{
          backgroundColor: "#000",
          border: "1px solid #00FF41",
          borderRadius: "8px",
          padding: "1.5rem",
          fontFamily: "JetBrains Mono, Courier New, monospace",
          color: "#00FF41",
        }}
      >
        <div style={{ marginBottom: "0.75rem", fontWeight: 700, fontSize: "0.85rem" }}>
          ⛓️ SOVEREIGN AUDIT STREAM — YUBIKEY HANDSHAKE REQUIRED
        </div>
        <form onSubmit={handleAuth} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter sovereign passphrase…"
            style={{
              flex: 1,
              minWidth: "200px",
              background: "#000",
              border: "1px solid #00FF41",
              color: "#00FF41",
              padding: "0.4rem 0.75rem",
              fontFamily: "inherit",
              fontSize: "0.8rem",
              borderRadius: "4px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              background: "rgba(0,255,65,0.12)",
              border: "1px solid #00FF41",
              color: "#00FF41",
              padding: "0.4rem 1rem",
              fontFamily: "inherit",
              fontSize: "0.8rem",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            AUTHENTICATE
          </button>
        </form>
        {authError && (
          <div style={{ color: "#f87171", fontSize: "0.75rem", marginTop: "0.5rem" }}>
            ⚠ {authError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#000",
        border: "1px solid #00FF41",
        borderRadius: "8px",
        padding: "1rem",
        fontFamily: "JetBrains Mono, Courier New, monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <span style={{ color: "#00FF41", fontWeight: 700, fontSize: "0.85rem" }}>
          ⛓️⚓⛓️ SOVEREIGN AUDIT STREAM — THREAT LEVEL ≥ 5
        </span>
        <span
          style={{
            fontSize: "0.7rem",
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
            background: connected ? "rgba(0,255,65,0.12)" : "rgba(248,113,113,0.12)",
            color: connected ? "#00FF41" : "#f87171",
            border: `1px solid ${connected ? "#00FF41" : "#f87171"}`,
          }}
        >
          {connected ? "● LIVE" : "○ CONNECTING…"}
        </span>
      </div>

      {/* Matrix terminal */}
      <div
        style={{
          maxHeight: "420px",
          overflowY: "auto",
          fontSize: "0.75rem",
          lineHeight: "1.65",
          color: "#00FF41",
        }}
      >
        {entries.length === 0 ? (
          <div style={{ color: "rgba(0,255,65,0.4)" }}>{">"} No high-threat events on record…</div>
        ) : (
          entries.map((entry) => {
            const isLegal = entry.event_type === "LEGAL_SCAN";
            const rowColor = isLegal ? "#ff3131" : "#00FF41";
            const isFlashing = flashIds.has(entry.id);
            return (
              <div
                key={entry.id}
                style={{
                  borderBottom: "1px solid rgba(0,255,65,0.1)",
                  padding: "4px 0",
                  color: rowColor,
                  animation: isFlashing && isLegal ? `${FLASH_ANIMATION} 1s step-end infinite` : undefined,
                }}
              >
                <span style={{ color: "rgba(0,255,65,0.5)" }}>
                  [{entry.forensic_pulse}]
                </span>{" "}
                <span style={{ fontWeight: 700 }}>{entry.event_type}</span>{" "}
                <span style={{ color: "#fff" }}>→</span>{" "}
                <span>{entry.target_path}</span>{" "}
                <span style={{ color: "rgba(0,255,65,0.6)" }}>
                  | {entry.ip_address}{entry.geo_location ? ` | ${entry.geo_location}` : ""}
                </span>
                {" "}
                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "0 0.3rem",
                    borderRadius: "2px",
                    background: isLegal ? "rgba(255,49,49,0.18)" : "rgba(0,255,65,0.1)",
                    border: `1px solid ${isLegal ? "#ff3131" : "rgba(0,255,65,0.3)"}`,
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

      {/* Flashing red keyframe */}
      <style>{`
        @keyframes ${FLASH_ANIMATION} {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
