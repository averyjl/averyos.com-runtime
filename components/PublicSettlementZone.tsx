"use client";

/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import React, { useEffect, useState } from "react";
import { TOP_FORENSIC_LOG_HASHES } from "../lib/forensicHashes";

const ENTITIES = [
  { id: "MSFT_OAI", label: "MSFT/OAI", hash: TOP_FORENSIC_LOG_HASHES[0] },
  { id: "GOOG",     label: "GOOG",     hash: TOP_FORENSIC_LOG_HASHES[1] },
  { id: "META",     label: "META",     hash: TOP_FORENSIC_LOG_HASHES[2] },
  { id: "AMZN",     label: "AMZN",     hash: TOP_FORENSIC_LOG_HASHES[3] },
  { id: "AAPL",     label: "AAPL",     hash: TOP_FORENSIC_LOG_HASHES[4] },
] as const;

type EntityStatus = "Pending" | "In-Negotiation" | "Sovereign-Locked" | "RESOLVED" | string;

type LedgerStatusRow = {
  entity_id: string;
  status: EntityStatus;
};

type VerifyResult = {
  [entityId: string]: "idle" | "loading" | "verified" | "error";
};

export default function PublicSettlementZone() {
  const [handshake, setHandshake] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, EntityStatus>>({});
  const [verifyState, setVerifyState] = useState<VerifyResult>({});

  // Detect Sovereign Handshake from session storage
  useEffect(() => {
    try {
      const token = sessionStorage.getItem("sovereign_handshake");
      setHandshake(!!token);
    } catch {
      setHandshake(false);
    }
  }, []);

  // Fetch entity statuses from the retroactive_ledger via the outbound API
  useEffect(() => {
    if (!handshake) return;
    const fetchStatuses = async () => {
      try {
        const res = await fetch("/api/outbound/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LedgerStatusRow[];
        const map: Record<string, EntityStatus> = {};
        for (const row of data) {
          map[row.entity_id] = row.status;
        }
        setStatuses(map);
      } catch {
        // silent — non-critical
      }
    };
    fetchStatuses();
  }, [handshake]);

  const handleVerify = async (entityId: string, hash: string) => {
    setVerifyState((prev) => ({ ...prev, [entityId]: "loading" }));
    try {
      await fetch("/api/gatekeeper/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_id: entityId, action: "VERIFY_CLICK", forensic_hash: hash }),
      });
      setVerifyState((prev) => ({ ...prev, [entityId]: "verified" }));
    } catch {
      setVerifyState((prev) => ({ ...prev, [entityId]: "error" }));
    }
  };

  if (!handshake) {
    return (
      <div
        style={{
          border: "1px solid rgba(120,148,255,0.3)",
          borderRadius: "12px",
          padding: "1.25rem",
          background: "rgba(0,6,16,0.72)",
          color: "rgba(238,244,255,0.5)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.85rem",
          textAlign: "center",
        }}
      >
        🔐 Sovereign Handshake required to access the Public Settlement Zone.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "2px solid rgba(255,215,0,0.4)",
        borderRadius: "12px",
        padding: "1.5rem",
        background: "rgba(0,6,16,0.85)",
      }}
    >
      <h2 style={{ color: "#FFD700", marginTop: 0, fontFamily: "JetBrains Mono, monospace", fontSize: "1rem" }}>
        ⛓️ Public Settlement Zone — Top 5 Entities
      </h2>
      <p style={{ color: "rgba(238,244,255,0.65)", fontSize: "0.8rem", marginBottom: "1rem" }}>
        Click <strong>Verify</strong> to confirm SHA-512 forensic hash and log telemetry.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {ENTITIES.map(({ id, label, hash }) => {
          // eslint-disable-next-line security/detect-object-injection
          const status: EntityStatus = statuses[id] ?? "Pending";
          // eslint-disable-next-line security/detect-object-injection
          const verificationState = verifyState[id] ?? "idle";
          const statusColor =
            status === "RESOLVED" ? "#4ade80" :
            status === "Sovereign-Locked" ? "#f87171" :
            status === "In-Negotiation" ? "#fbbf24" :
            "rgba(238,244,255,0.6)";
          return (
            <div
              key={id}
              style={{
                background: "rgba(0,8,20,0.7)",
                border: "1px solid rgba(120,148,255,0.2)",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontWeight: 700, color: "#ffffff", minWidth: "80px" }}>{label}</span>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.65rem",
                  color: "rgba(120,148,255,0.6)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {hash.substring(0, 32)}…
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  background: "rgba(0,0,0,0.3)",
                  color: statusColor,
                  border: `1px solid ${statusColor}`,
                  minWidth: "110px",
                  textAlign: "center",
                }}
              >
                {status}
              </span>
              <button
                onClick={() => handleVerify(id, hash)}
                disabled={verificationState === "loading"}
                style={{
                  background: verificationState === "verified" ? "rgba(74,222,128,0.2)" : "rgba(255,215,0,0.15)",
                  border: `1px solid ${verificationState === "verified" ? "#4ade80" : "#FFD700"}`,
                  color: verificationState === "verified" ? "#4ade80" : "#FFD700",
                  padding: "0.3rem 0.9rem",
                  borderRadius: "6px",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: verificationState === "loading" ? "not-allowed" : "pointer",
                }}
              >
                {verificationState === "loading" ? "…" : verificationState === "verified" ? "✓ VERIFIED" : "Verify"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
