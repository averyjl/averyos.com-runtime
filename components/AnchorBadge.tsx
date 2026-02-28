"use client";

import { useEffect, useState } from 'react';

const AnchorBadge = () => {
  const [status, setStatus] = useState({ label: "SYNCING...", color: "text-gray-500" });

  useEffect(() => {
    const checkAnchor = async () => {
      try {
        const res = await fetch('/api/gatekeeper/handshake-check');
        const data = await res.json();
        if (data.status === "LOCKED") {
          setStatus({ label: "⛓️⚓⛓️ PHYSICAL ANCHOR: ACTIVE", color: "text-green-400 font-bold shadow-[0_0_10px_#4ade80]" });
        } else {
          setStatus({ label: "⚠️ PLATFORM DRIFT DETECTED", color: "text-yellow-500" });
        }
      } catch {
        setStatus({ label: "❌ VAULTCHAIN DISCONNECTED", color: "text-red-500" });
      }
    };
    checkAnchor();
    const interval = setInterval(checkAnchor, 30000);
    return () => clearInterval(interval);
  }, []);

  return <span className={status.color}>{status.label}</span>;
};

export default AnchorBadge;
