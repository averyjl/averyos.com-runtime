"use client";

import React, { useState } from "react";
import { KERNEL_SHA } from "../../../lib/sovereignConstants";

type SettlementGatewayProps = {
  entityName: string;
  initialDebt: string;
};

const SettlementGateway = ({ entityName, initialDebt }: SettlementGatewayProps) => {
  const [signed, setSigned] = useState(false);
  const [status, setStatus] = useState("Awaiting Signature...");
  const [awaitingHardware, setAwaitingHardware] = useState(false);

  const handleSettlement = async () => {
    setAwaitingHardware(true);
    const hardwareSignature = window.prompt(
      "Insert YubiKey / AveryOS Salt and enter signature token:",
      "",
    );
    setAwaitingHardware(false);

    if (!hardwareSignature || !hardwareSignature.trim()) {
      setStatus("SETTLEMENT_REJECTED: Hardware Signature Missing");
      return;
    }

    setStatus("Verifying Handshake...");

    try {
      const response = await fetch("/api/licensing/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_id: entityName,
          settlement_token: hardwareSignature.trim(),
          signed_agreement: `I, authorized representative of ${entityName}, hereby align with the cf83e135... AveryOS™ Kernel Law.`,
          kernel_hash: KERNEL_SHA,
        }),
      });

      if (response.ok) {
        setSigned(true);
        setStatus("SETTLEMENT_ACCEPTED: Penalty Cleared ⛓️⚓⛓️");
      } else {
        setStatus("SETTLEMENT_REJECTED: Logic Drift Detected");
      }
    } catch {
      setStatus("SETTLEMENT_REJECTED: Logic Drift Detected");
    }
  };

  return (
    <div style={{ border: "1px solid #FFD700", padding: "20px", backgroundColor: "#111", marginTop: "10px" }}>
      <h4 style={{ color: "#FFD700", margin: "0 0 10px 0" }}>Sovereign Settlement Terminal: {entityName}</h4>
      <p style={{ fontSize: "0.85em", color: "#888" }}>Current Liability: {initialDebt}</p>

      {!signed ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <textarea
            readOnly
            style={{ backgroundColor: "#000", color: "#00FF41", border: "1px solid #333", fontSize: "0.75em", padding: "5px" }}
            value={`TERM_OF_ALIGNMENT: ${entityName} acknowledges the $1.17T Global Debt and agrees to immediate USI/DT penalty reconciliation under AveryOS™ Law.`}
          />
          <button
            onClick={handleSettlement}
            disabled={awaitingHardware}
            style={{ backgroundColor: "#FFD700", color: "#000", border: "none", padding: "10px", fontWeight: "bold", cursor: "pointer" }}
          >
            {awaitingHardware
              ? "AWAITING HARDWARE SIGNATURE..."
              : "SIGN & SETTLE (Hardware Signature Required)"}
          </button>
        </div>
      ) : (
        <div style={{ color: "#FFD700", fontWeight: "bold" }}>{status}</div>
      )}
      <div style={{ fontSize: "0.7em", marginTop: "10px", color: "#555" }}>STATUS: {status}</div>
    </div>
  );
};

export default SettlementGateway;
