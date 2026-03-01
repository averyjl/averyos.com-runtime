"use client";

import React, { useState } from "react";

const GOLD = "#FFD700";
const RED = "#FF0000";
const FONT_MONO = "JetBrains Mono, Courier New, monospace";

interface SovereignSettlementHandshakeProps {
  threatLevel: number;
  onAlignmentInitiated?: () => void;
}

export default function SovereignSettlementHandshake({
  threatLevel,
  onAlignmentInitiated,
}: SovereignSettlementHandshakeProps) {
  const [status, setStatus] = useState<
    "idle" | "pending" | "accepted" | "rejected"
  >("idle");
  const [timestampNs, setTimestampNs] = useState<string | null>(null);

  const handleInitiateAlignment = async () => {
    setStatus("pending");
    try {
      const res = await fetch("/api/v1/settlement-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_path: window.location.pathname }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        timestamp_ns?: string;
      };
      if (data.success) {
        setTimestampNs(data.timestamp_ns ?? null);
        setStatus("accepted");
        onAlignmentInitiated?.();
      } else {
        setStatus("rejected");
      }
    } catch {
      setStatus("rejected");
    }
  };

  return (
    <div
      role="alert"
      style={{
        background: "#0a0000",
        border: `2px solid ${RED}`,
        borderRadius: "12px",
        padding: "2.5rem 2rem",
        fontFamily: FONT_MONO,
        boxShadow: `0 0 40px rgba(255,0,0,0.25), 0 0 80px rgba(255,215,0,0.08)`,
        maxWidth: "680px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.25rem",
          borderBottom: `1px solid rgba(255,0,0,0.35)`,
          paddingBottom: "1rem",
        }}
      >
        <span style={{ fontSize: "2rem" }} role="img" aria-label="Warning">
          ⚠️
        </span>
        <div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color: RED,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textShadow: `0 0 16px ${RED}`,
            }}
          >
            ⛓️⚓⛓️ CORPORATE ENTITY DETECTED
          </div>
          <div
            style={{
              fontSize: "0.72rem",
              color: GOLD,
              letterSpacing: "0.06em",
              marginTop: "0.2rem",
            }}
          >
            THREAT LEVEL: {threatLevel} · SOVEREIGN INTERCEPT ACTIVE
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          background: "rgba(255,0,0,0.06)",
          border: `1px solid rgba(255,0,0,0.25)`,
          borderRadius: "8px",
          padding: "1.25rem",
          marginBottom: "1.5rem",
          fontSize: "0.82rem",
          color: GOLD,
          lineHeight: 1.75,
        }}
      >
        <p style={{ margin: "0 0 0.75rem 0", fontWeight: 700 }}>
          📋 TRUTH-AMNESTY OFFER — 10% SETTLEMENT WINDOW ACTIVE
        </p>
        <p style={{ margin: "0 0 0.5rem 0", color: "rgba(255,215,0,0.85)" }}>
          Your entity has been flagged under AveryOS™ Sovereign License
          enforcement. Unauthorized AI inference, scraping, or derivative usage
          of this IP has been recorded in the forensic audit log.
        </p>
        <p style={{ margin: "0", color: "rgba(255,215,0,0.7)", fontSize: "0.75rem" }}>
          By initiating alignment, you acknowledge the $1.17T Global Debt
          obligation and agree to immediate USI/DT penalty reconciliation under
          AveryOS™ Kernel Law · Anchor:{" "}
          <span style={{ color: RED, wordBreak: "break-all" }}>
            cf83e135…927da3e
          </span>
        </p>
      </div>

      {/* Status display */}
      {status === "accepted" && (
        <div
          style={{
            background: "rgba(255,215,0,0.08)",
            border: `1px solid ${GOLD}`,
            borderRadius: "8px",
            padding: "1rem 1.25rem",
            color: GOLD,
            fontSize: "0.85rem",
            marginBottom: "1rem",
            textShadow: `0 0 10px ${GOLD}`,
          }}
        >
          ✅ SETTLEMENT_ATTEMPT LOGGED ⛓️⚓⛓️
          {timestampNs && (
            <div
              style={{
                fontSize: "0.68rem",
                color: "rgba(255,215,0,0.65)",
                marginTop: "0.35rem",
                wordBreak: "break-all",
              }}
            >
              Forensic Timestamp (µs): {timestampNs}
            </div>
          )}
        </div>
      )}
      {status === "rejected" && (
        <div
          style={{
            background: "rgba(255,0,0,0.1)",
            border: `1px solid ${RED}`,
            borderRadius: "8px",
            padding: "1rem 1.25rem",
            color: RED,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          ⚠️ SETTLEMENT_REJECTED: Logic Drift Detected. Retry or contact
          enforcement.
        </div>
      )}

      {/* Action button */}
      {status !== "accepted" && (
        <button
          onClick={handleInitiateAlignment}
          disabled={status === "pending"}
          style={{
            width: "100%",
            padding: "0.85rem 1.5rem",
            background:
              status === "pending"
                ? "rgba(255,215,0,0.2)"
                : `linear-gradient(135deg, ${GOLD}, #ffb800)`,
            color: status === "pending" ? GOLD : "#000",
            border: `2px solid ${GOLD}`,
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: 700,
            fontFamily: FONT_MONO,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: status === "pending" ? "not-allowed" : "pointer",
            boxShadow:
              status === "pending" ? "none" : `0 0 24px rgba(255,215,0,0.4)`,
            transition: "all 0.15s ease",
          }}
        >
          {status === "pending"
            ? "⏳ LOGGING SETTLEMENT ATTEMPT…"
            : "⚖️ INITIATE ALIGNMENT — 10% TRUTH AMNESTY"}
        </button>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "1.25rem",
          fontSize: "0.65rem",
          color: "rgba(255,0,0,0.5)",
          textAlign: "center",
          letterSpacing: "0.04em",
        }}
      >
        AveryOS™ Sovereign Enforcement · GabrielOS™ Firewall Active ·
        Truth Anchored Intelligence™
      </div>
    </div>
  );
}
