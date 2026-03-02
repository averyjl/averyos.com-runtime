"use client";

// AveryOS™ Infrastructure Access Stream — Enterprise Monitoring
// Gated: renders only when isAuthenticated === true
// Highlights known corporate-crawler traffic in flashing red (#FF0000)

import React, { useCallback, useEffect, useRef, useState } from "react";

interface AccessEntry {
  id: number;
  event_type: string;
  ip_address: string;
  user_agent: string | null;
  geo_location: string | null;
  target_path: string;
  forensic_pulse: string;
  threat_level: number | null;
}

interface Props {
  isAuthenticated: boolean;
  /** Bearer token forwarded to /api/v1/audit-stream. Defaults to sessionStorage sovereign_handshake. */
  token?: string;
}

const POLL_INTERVAL_MS = 3000;
const FLASH_ANIMATION = "infraAccessFlash";

// User-agent substrings used to identify high-priority corporate crawlers
const CORPORATE_UA_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "Microsoft", pattern: /bingbot|msnbot|microsoft|bingpreview/i },
  { name: "Google", pattern: /googlebot|google|adsbot-google|mediapartners-google/i },
  { name: "Meta", pattern: /facebookexternalhit|facebot|meta/i },
  { name: "Amazon", pattern: /amazonbot|alexa|aws/i },
  { name: "Apple", pattern: /applebot/i },
];

function detectCorporate(userAgent: string | null): string | null {
  if (!userAgent) return null;
  for (const { name, pattern } of CORPORATE_UA_PATTERNS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}

export default function InfrastructureAccessStream({ isAuthenticated, token: propToken }: Props) {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchStream = useCallback(async () => {
    // Resolve token on every poll to pick up fresh sessionStorage values
    let activeToken = propToken ?? "";
    if (!activeToken) {
      try {
        activeToken =
          (typeof window !== "undefined" &&
            window.sessionStorage.getItem("sovereign_handshake")) ||
          "";
      } catch {
        activeToken = "";
      }
    }
    try {
      const res = await fetch("/api/v1/audit-stream", {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        cache: "no-store",
      });
      if (!res.ok) {
        setConnected(false);
        return;
      }
      const data = (await res.json()) as AccessEntry[];
      if (Array.isArray(data)) {
        const corporateIds = new Set(
          data
            .filter((e) => detectCorporate(e.user_agent) !== null)
            .map((e) => e.id)
        );
        setFlashIds(corporateIds);
        setEntries(data);
        setConnected(true);
      }
    } catch {
      setConnected(false);
    }
  }, [propToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStream();
    const interval = setInterval(fetchStream, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchStream]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  if (!isAuthenticated) return null;

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
          ⛓️⚓⛓️ INFRASTRUCTURE ACCESS STREAM
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

      {/* Entry list */}
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
          <div style={{ color: "rgba(0,255,65,0.4)" }}>
            {">"} No access events on record…
          </div>
        ) : (
          entries.map((entry) => {
            const corporate = detectCorporate(entry.user_agent);
            const isHighPriority = corporate !== null;
            const rowColor = isHighPriority ? "#FF0000" : "#00FF41";
            const isFlashing = flashIds.has(entry.id);
            return (
              <div
                key={entry.id}
                style={{
                  borderBottom: "1px solid rgba(0,255,65,0.1)",
                  padding: "4px 0",
                  color: rowColor,
                  animation: isFlashing
                    ? `${FLASH_ANIMATION} 1s step-end infinite`
                    : undefined,
                }}
              >
                <span style={{ color: "rgba(0,255,65,0.5)" }}>
                  [{entry.forensic_pulse}]
                </span>{" "}
                <span style={{ fontWeight: 700 }}>{entry.event_type}</span>{" "}
                <span style={{ color: "#fff" }}>→</span>{" "}
                <span>{entry.target_path}</span>{" "}
                <span style={{ color: "rgba(0,255,65,0.6)" }}>
                  | {entry.ip_address}
                  {entry.geo_location ? ` | ${entry.geo_location}` : ""}
                </span>
                {isHighPriority && (
                  <span
                    style={{
                      marginLeft: "0.4rem",
                      fontSize: "0.65rem",
                      padding: "0 0.3rem",
                      borderRadius: "2px",
                      background: "rgba(255,0,0,0.18)",
                      border: "1px solid #FF0000",
                      color: "#FF0000",
                      fontWeight: 700,
                    }}
                  >
                    ⚠ {corporate?.toUpperCase()}
                  </span>
                )}
                {" "}
                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "0 0.3rem",
                    borderRadius: "2px",
                    background: isHighPriority
                      ? "rgba(255,0,0,0.18)"
                      : "rgba(0,255,65,0.1)",
                    border: `1px solid ${isHighPriority ? "#FF0000" : "rgba(0,255,65,0.3)"}`,
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

      {/* Flash keyframe */}
      <style>{`
        @keyframes ${FLASH_ANIMATION} {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
