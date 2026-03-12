"use client";

// AveryOS™ YubiKey Hardware Handshake
// Status: [PHYSICAL EXECUTION] | Auth: Crater-Root

import React, { useState } from "react";

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

interface YubiKeyHandshakeProps {
  onSuccess?: () => void;
}

const YubiKeyHandshake = ({ onSuccess }: YubiKeyHandshakeProps) => {
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const startHandshake = async () => {
    setStatus("pending");
    setErrorMessage("");
    try {
      const res = await fetch("/api/v1/auth/challenge");
      if (!res.ok) {
        throw new Error(`Challenge fetch failed: ${res.status}`);
      }
      const { challenge, timeout } = (await res.json()) as {
        challenge: string;
        timeout: number;
      };

      // [LOGIC INTENT] Triggers WebAuthn/FIDO2 Hardware Request
      const authResult = await window.navigator.credentials.get({
        publicKey: {
          challenge: base64urlToBuffer(challenge),
          timeout: timeout ?? 60000,
          allowCredentials: [],
          userVerification: "preferred",
        },
      });

      if (authResult) {
        window.sessionStorage.setItem("sovereign_handshake", "active");
        setAuthorized(true);
        setStatus("idle");
        onSuccess?.();
      }
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "HANDSHAKE_FAILURE: Logic Drift or Hardware Missing";
      console.error("HANDSHAKE_FAILURE:", error);
      setStatus("error");
      setErrorMessage(msg);
    }
  };

  if (authorized) {
    return (
      <div
        style={{
          background: "rgba(0,255,65,0.08)",
          border: "2px solid rgba(0,255,65,0.5)",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          fontFamily: "JetBrains Mono, monospace",
          color: "#00FF41",
          textAlign: "center",
          fontSize: "1rem",
          fontWeight: 700,
        }}
      >
        ✅ Sovereign Handshake Active — YubiKey Verified
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(26,0,0,0.85)",
        border: "2px solid rgba(255,51,51,0.5)",
        borderRadius: "12px",
        padding: "1.5rem",
        fontFamily: "JetBrains Mono, monospace",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "rgba(255,51,51,0.8)",
          marginBottom: "0.25rem",
        }}
      >
        ⛓️ YubiKey Hardware Handshake · FIDO2 / WebAuthn
      </div>
      <p
        style={{
          color: "rgba(238,244,255,0.8)",
          fontSize: "0.85rem",
          margin: 0,
          lineHeight: "1.65",
        }}
      >
        Insert your registered YubiKey and click the button below to initiate the
        hardware handshake. This verifies Sovereign Administrator identity via
        FIDO2/WebAuthn.
      </p>
      <button
        onClick={startHandshake}
        disabled={status === "pending"}
        style={{
          background:
            status === "pending"
              ? "rgba(255,51,51,0.1)"
              : "rgba(255,51,51,0.2)",
          border: "1px solid #ff3333",
          color: "#ff3333",
          padding: "0.7rem 1.5rem",
          borderRadius: "8px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.9rem",
          fontWeight: 700,
          cursor: status === "pending" ? "not-allowed" : "pointer",
          letterSpacing: "0.05em",
        }}
      >
        {status === "pending"
          ? "🔄 AUTHENTICATING…"
          : "🔐 Initiate YubiKey Handshake"}
      </button>
      {status === "error" && (
        <p
          style={{
            color: "#f87171",
            fontSize: "0.8rem",
            margin: 0,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          ⚠ {errorMessage}
        </p>
      )}
    </div>
  );
};

export default YubiKeyHandshake;
