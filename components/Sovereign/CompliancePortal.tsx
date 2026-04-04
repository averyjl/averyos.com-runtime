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
import { useState } from "react";
import Link from "next/link";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";
import SovereignErrorBanner from "../SovereignErrorBanner";
import { buildAosUiError, classifyApiResponseError, AOS_ERROR, type AosUiError } from "../../lib/sovereignError";

type AlignmentStatus = "UNALIGNED" | "RESOLVING" | "ALIGNED" | "ERROR";

type CompliancePortalProps = {
  /** Pre-populated Evidence Bundle ID from the Forensic Evidence Bundle (.aoscap) */
  bundleId?: string;
  /** Target IP address from the Forensic Evidence Bundle */
  targetIp?: string;
  /** TARI™ Liability in USD cents (default: 101700 = $1,017.00) */
  tariLiabilityCents?: number;
};

/**
 * AveryOS™ Sovereign Compliance Portal
 *
 * Displays the current alignment status for a target entity and provides
 * a "Resolve Liability & Align" button that initiates a Stripe Checkout
 * session for TARI™ Liability payment.
 *
 * On successful payment, the entity transitions from UNALIGNED → ALIGNED
 * and a 12-Month Sovereign Alignment License is issued automatically.
 *
 * Theme: AveryOS™ Purple/Gold sovereign palette
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
export default function CompliancePortal({
  bundleId = "",
  targetIp = "",
  tariLiabilityCents = 101700,
}: CompliancePortalProps) {
  const [status, setStatus] = useState<AlignmentStatus>("UNALIGNED");
  const [uiError, setUiError] = useState<AosUiError | null>(null);
  const [inputBundleId, setInputBundleId] = useState(bundleId);
  const [inputTargetIp, setInputTargetIp] = useState(targetIp);

  const liabilityUsd = (tariLiabilityCents / 100).toFixed(2);

  const handleResolve = async () => {
    if (!inputBundleId.trim() || !inputTargetIp.trim()) {
      setUiError(buildAosUiError(AOS_ERROR.MISSING_FIELD, 'Bundle ID and Target IP are required.'));
      setStatus("ERROR");
      return;
    }

    setStatus("RESOLVING");
    setUiError(null);

    try {
      const res = await fetch("/api/v1/compliance/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: inputBundleId,
          targetIp: inputTargetIp,
          tariLiability: tariLiabilityCents,
        }),
      });

      const data = (await res.json()) as { checkoutUrl?: string; error?: string; detail?: string };

      if (!res.ok || !data.checkoutUrl) {
        setUiError(classifyApiResponseError(data as Record<string, unknown>));
        setStatus("ERROR");
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.checkoutUrl;
    } catch (err: unknown) {
      setUiError(buildAosUiError(AOS_ERROR.EXTERNAL_API_ERROR, err instanceof Error ? err.message : 'Unexpected network error.'));
      setStatus("ERROR");
    }
  };

  const isAligned = status === "ALIGNED";
  const isResolving = status === "RESOLVING";

  return (
    <div
      style={{
        background: "rgba(9, 16, 34, 0.92)",
        border: `2px solid ${isAligned ? "rgba(74, 222, 128, 0.6)" : "rgba(248, 113, 113, 0.5)"}`,
        borderRadius: "16px",
        padding: "2rem",
        maxWidth: "640px",
        margin: "0 auto",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2
          style={{
            color: "#ffffff",
            margin: "0 0 0.5rem",
            fontSize: "1.2rem",
            letterSpacing: "0.04em",
          }}
        >
          ⛓️⚓⛓️ AveryOS™ Compliance Portal
        </h2>
        <p
          style={{
            color: "rgba(120, 148, 255, 0.75)",
            fontSize: "0.78rem",
            margin: 0,
          }}
        >
          TARI™ Liability Resolution · Sovereign Alignment License
        </p>
      </div>

      {/* Status Badge */}
      <div
        style={{
          display: "inline-block",
          padding: "0.4rem 1rem",
          borderRadius: "6px",
          marginBottom: "1.5rem",
          background: isAligned
            ? "rgba(74, 222, 128, 0.12)"
            : "rgba(248, 113, 113, 0.12)",
          border: `1px solid ${isAligned ? "rgba(74, 222, 128, 0.5)" : "rgba(248, 113, 113, 0.5)"}`,
          color: isAligned ? "#4ade80" : "rgba(248, 113, 113, 0.9)",
          fontSize: "0.82rem",
          letterSpacing: "0.08em",
          fontWeight: 700,
          transition: "all 0.3s ease",
        }}
      >
        {isAligned ? "✅ STATUS: ALIGNED" : "⚠️ STATUS: UNALIGNED"}
      </div>

      {/* Kernel Anchor Display */}
      <div
        style={{
          fontSize: "0.68rem",
          color: "rgba(120, 148, 255, 0.45)",
          marginBottom: "1.5rem",
          wordBreak: "break-all",
          lineHeight: 1.4,
        }}
      >
        ROOT0 ANCHOR · {KERNEL_VERSION} · {KERNEL_SHA.slice(0, 24)}...{KERNEL_SHA.slice(-12)}
      </div>

      {/* Bundle ID Input */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            color: "rgba(238, 244, 255, 0.7)",
            fontSize: "0.78rem",
            marginBottom: "0.4rem",
            letterSpacing: "0.03em",
          }}
        >
          Evidence Bundle ID
        </label>
        <input
          type="text"
          value={inputBundleId}
          onChange={(e) => setInputBundleId(e.target.value)}
          placeholder="EVIDENCE_BUNDLE_xxx_xxx.aoscap"
          disabled={isAligned || isResolving}
          style={{
            width: "100%",
            background: "rgba(9, 16, 34, 0.8)",
            border: "1px solid rgba(120, 148, 255, 0.3)",
            color: "#ffffff",
            padding: "0.6rem 0.8rem",
            borderRadius: "6px",
            fontSize: "0.78rem",
            fontFamily: "JetBrains Mono, monospace",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </div>

      {/* Target IP Input */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            color: "rgba(238, 244, 255, 0.7)",
            fontSize: "0.78rem",
            marginBottom: "0.4rem",
            letterSpacing: "0.03em",
          }}
        >
          Target IP Address
        </label>
        <input
          type="text"
          value={inputTargetIp}
          onChange={(e) => setInputTargetIp(e.target.value)}
          placeholder="203.0.113.42"
          disabled={isAligned || isResolving}
          style={{
            width: "100%",
            background: "rgba(9, 16, 34, 0.8)",
            border: "1px solid rgba(120, 148, 255, 0.3)",
            color: "#ffffff",
            padding: "0.6rem 0.8rem",
            borderRadius: "6px",
            fontSize: "0.78rem",
            fontFamily: "JetBrains Mono, monospace",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </div>

      {/* TARI™ Liability Summary */}
      <div
        style={{
          background: "rgba(120, 148, 255, 0.06)",
          border: "1px solid rgba(120, 148, 255, 0.2)",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "rgba(238, 244, 255, 0.7)", fontSize: "0.82rem" }}>
            TARI™ Liability
          </span>
          <span
            style={{
              color: isAligned ? "#4ade80" : "rgba(251, 191, 36, 0.9)",
              fontSize: "1.1rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            ${liabilityUsd} USD
          </span>
        </div>
        <p
          style={{
            color: "rgba(120, 148, 255, 0.6)",
            fontSize: "0.72rem",
            margin: "0.5rem 0 0",
          }}
        >
          {isAligned
            ? "✅ Liability resolved — 12-Month Alignment License active."
            : "Payment resolves all TARI™ liability and activates a 12-Month Sovereign Alignment License."}
        </p>
      </div>

      {/* Error Message */}
      {status === "ERROR" && (
        <SovereignErrorBanner error={uiError} />
      )}

      {/* Resolve Button */}
      {!isAligned && (
        <button
          onClick={handleResolve}
          disabled={isResolving}
          style={{
            width: "100%",
            padding: "0.85rem 1.5rem",
            background: isResolving
              ? "rgba(120, 148, 255, 0.08)"
              : "linear-gradient(135deg, rgba(120, 64, 220, 0.85), rgba(180, 140, 255, 0.7))",
            border: "1px solid rgba(180, 140, 255, 0.5)",
            borderRadius: "8px",
            color: "#ffffff",
            fontSize: "0.95rem",
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            letterSpacing: "0.06em",
            cursor: isResolving ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: isResolving
              ? "none"
              : "0 0 20px rgba(150, 100, 255, 0.3)",
          }}
        >
          {isResolving ? "⏳ Initiating Sovereign Handshake…" : "⚡ Resolve Liability & Align"}
        </button>
      )}

      {/* Aligned confirmation */}
      {isAligned && (
        <div
          style={{
            textAlign: "center",
            color: "#4ade80",
            fontSize: "0.9rem",
            padding: "1rem",
            letterSpacing: "0.04em",
          }}
        >
          ⛓️⚓⛓️ ENTITY ALIGNED — 12-Month License Active
        </div>
      )}

      {/* Footer note */}
      <p
        style={{
          color: "rgba(238, 244, 255, 0.3)",
          fontSize: "0.68rem",
          marginTop: "1.5rem",
          lineHeight: 1.6,
          textAlign: "center",
        }}
      >
        Payments processed via Stripe · AveryOS Sovereign Integrity License v1.0 ·{" "}
        <Link
          href="/license"
          style={{ color: "rgba(120, 148, 255, 0.6)", textDecoration: "none" }}
        >
          View License Terms
        </Link>
      </p>
    </div>
  );
}
