"use client";

import { useEffect, useState } from "react";

type AnchorStatus = {
  label: string;
  color: string;
  glow?: string;
};

export const AnchorBadge = () => {
  const [status, setStatus] = useState<AnchorStatus>({
    label: "SYNCING...",
    color: "rgba(148,163,184,0.8)",
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
        } else {
          setStatus({
            label: "⚠️ PLATFORM DRIFT DETECTED",
            color: "#fbbf24",
          });
        }
      } catch {
        setStatus({
          label: "❌ VAULTCHAIN™ DISCONNECTED",
          color: "#f87171",
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
      }}
    >
      {status.label}
    </span>
  );
};

export default AnchorBadge;
