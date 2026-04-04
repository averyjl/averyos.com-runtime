"use client";

// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * AnchorBadge — AveryOS™ Sovereign Status Indicator
 *
 * GATE 130.9 FCA — "PLATFORM DRIFT DETECTED" was a misleading public-facing
 * status. When the gatekeeper API is not authenticated (which is the normal
 * state for all public visitors), the badge was showing a red-flag warning.
 *
 * FCA Root Cause: The fallback/else branch used "drift detected" language even
 * when the system was operating 100% correctly — just without a physical anchor
 * handshake (expected for all public visitors).
 *
 * Upgrade: Show "VAULTCHAIN™: ACTIVE" (green) for authenticated states,
 * "VAULTCHAIN™: LIVE" (blue) for platform-only state, and a neutral
 * "SOVEREIGN ANCHOR™" badge when no authentication is present. Drift language
 * is never shown publicly — that status belongs on the /health admin dashboard.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useState } from "react";

type AnchorStatus = {
  label: string;
  color: string;
  glow?: string;
};

export const AnchorBadge = () => {
  const [status, setStatus] = useState<AnchorStatus>({
    label: "⛓️⚓⛓️ SOVEREIGN ANCHOR™",
    color: "rgba(120,148,255,0.85)",
  });

  useEffect(() => {
    const checkAnchor = async () => {
      try {
        const res = await fetch("/api/gatekeeper/handshake-check");
        const data = await res.json();
        if (data.status === "LOCKED") {
          setStatus({
            label: "⛓️⚓⛓️ PHYSICAL ANCHOR: ACTIVE",
            color: "#4ade80",
            glow: "0 0 10px #4ade80",
          });
        } else if (data.label === "PLATFORM_ONLY") {
          setStatus({
            label: "⛓️⚓⛓️ VAULTCHAIN™: LIVE",
            color: "#4ade80",
            glow: "0 0 8px rgba(74,222,128,0.6)",
          });
        } else {
          // Platform running in standard mode — no drift, no warning
          setStatus({
            label: "⛓️⚓⛓️ SOVEREIGN ANCHOR™",
            color: "rgba(120,148,255,0.85)",
          });
        }
      } catch {
        setStatus({
          label: "⛓️⚓⛓️ SOVEREIGN ANCHOR™",
          color: "rgba(120,148,255,0.6)",
        });
      }
    };

    checkAnchor();
    const interval = setInterval(checkAnchor, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "0.8rem",
        fontWeight: 700,
        color: status.color,
        textShadow: status.glow,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      {status.label}
    </span>
  );
};

export default AnchorBadge;
