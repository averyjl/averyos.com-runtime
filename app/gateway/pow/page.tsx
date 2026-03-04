"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";

const MONO = "JetBrains Mono, monospace";

/** PoW difficulty: solution hash must begin with this many zero nibbles (hex chars). */
const POW_DIFFICULTY = 4;
const ENTRY_FEE_BASE = 1017;

type PoWStatus =
  | "idle"
  | "detecting"
  | "solving"
  | "submitting"
  | "accepted"
  | "error";

/** Compute SHA-512 hex of a UTF-8 string using the Web Crypto API. */
async function sha512Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Lightweight browser fingerprint (non-identifying; used only as entropy for PoW). */
function buildFingerprint(): string {
  if (typeof window === "undefined") return "server";
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width) + "x" + String(screen.height),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? 0),
  ];
  return parts.join("|");
}

/** Format a USD amount with commas and 2 decimal places. */
function fmtUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** A scrolling graph of recent hash attempts (resonance meter). */
function ResonanceGraph({
  attempts,
  found,
}: {
  attempts: number;
  found: boolean;
}) {
  const W = 320;
  const H = 48;
  const bars = 40;
  const barW = W / bars;

  // Generate a deterministic noise pattern from the attempt count
  const heights = Array.from({ length: bars }, (_, i) => {
    const seed = (attempts + i * 37) % 97;
    const base = ((seed * 2654435761) >>> 0) % 100;
    return found ? H : Math.max(4, (base / 100) * H);
  });

  return (
    <svg
      width={W}
      height={H}
      style={{ display: "block", margin: "0 auto", opacity: found ? 1 : 0.75 }}
      aria-label="VaultChain™ Resonance Graph"
      role="img"
    >
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * barW}
          y={H - h}
          width={barW - 1}
          height={h}
          fill={
            found
              ? `rgba(74,222,128,${0.4 + (i / bars) * 0.5})`
              : `rgba(120,148,255,${0.2 + (i / bars) * 0.5})`
          }
          rx={1}
        />
      ))}
    </svg>
  );
}

export default function PoWGatewayPage() {
  const [status, setStatus] = useState<PoWStatus>("idle");
  const [targetIp, setTargetIp] = useState<string>("DETECTING…");
  const [fingerprint, setFingerprint] = useState<string>("");
  const [nonce, setNonce] = useState<number>(0);
  const [solutionHash, setSolutionHash] = useState<string>("");
  const [cpuCycles, setCpuCycles] = useState<number>(0);
  const [entryFeeUsd, setEntryFeeUsd] = useState<number>(ENTRY_FEE_BASE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const solveRef = useRef(false);

  // Detect IP via Cloudflare header proxy (best-effort)
  useEffect(() => {
    fetch("/api/v1/health")
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const ip =
          (d as { ip?: string }).ip ??
          (d as { client_ip?: string }).client_ip ??
          "UNKNOWN";
        setTargetIp(String(ip));
      })
      .catch(() => setTargetIp("UNKNOWN"));

    setFingerprint(buildFingerprint());
  }, []);

  /** Run the client-side SHA-512 PoW puzzle (difficulty = POW_DIFFICULTY leading zero nibbles). */
  const runPoW = useCallback(async () => {
    if (solveRef.current) return;
    solveRef.current = true;
    setStatus("solving");
    setErrorMsg(null);

    const fp = buildFingerprint();
    setFingerprint(fp);

    const prefix = "0".repeat(POW_DIFFICULTY);
    let attempt = 0;
    const timestampBase = new Date().toISOString();

    while (true) {
      // Evidence payload: IP + fingerprint + 1,017-notch timestamp + nonce
      const notchTs = timestampBase.replace(/[-:T.Z]/g, "").slice(0, 17).padEnd(17, "0");
      const payload = `${targetIp}|${fp}|${notchTs}|${attempt}`;
      const hash = await sha512Hex(payload);

      if (hash.startsWith(prefix)) {
        const cycles = attempt * 10_000; // approximate CPU cycles proxy
        const fee = ENTRY_FEE_BASE + cycles * 0.000001;
        setNonce(attempt);
        setSolutionHash(hash);
        setCpuCycles(cycles);
        setEntryFeeUsd(fee);
        setStatus("submitting");
        solveRef.current = false;
        await submitSolution(hash, attempt, fp, timestampBase, cycles);
        return;
      }

      attempt++;
      if (attempt % 500 === 0) {
        setCpuCycles(attempt * 10_000);
        setNonce(attempt);
        setEntryFeeUsd(ENTRY_FEE_BASE + attempt * 10_000 * 0.000001);
        // Yield to event loop to keep UI responsive
        await new Promise<void>((r) => setTimeout(r, 0));
      }

      // Safety cap: stop after 2M attempts (~20M virtual cycles)
      if (attempt > 2_000_000) {
        setStatus("error");
        setErrorMsg("PoW puzzle exceeded maximum attempts. Please refresh and try again.");
        solveRef.current = false;
        return;
      }
    }
  }, [targetIp]);

  async function submitSolution(
    hash: string,
    n: number,
    fp: string,
    ts: string,
    cycles: number,
  ) {
    try {
      const res = await fetch("/api/v1/gateway/pow-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce: n,
          solution_hash: hash,
          fingerprint: fp,
          timestamp: ts,
          cpu_cycles: cycles,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; detail?: string };
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        entry_fee_usd?: number;
        timestamp_ns?: string;
      };
      if (data.entry_fee_usd !== undefined) setEntryFeeUsd(data.entry_fee_usd);
      setSubmittedAt(data.timestamp_ns ?? new Date().toISOString());
      setStatus("accepted");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const statusLabel: Record<PoWStatus, string> = {
    idle: "AWAITING INITIATION",
    detecting: "DETECTING SCANNER…",
    solving: "SOLVING PoW PUZZLE…",
    submitting: "SEALING TO VAULTCHAIN™…",
    accepted: "✓ EVIDENCE SEALED",
    error: "✗ ERROR",
  };

  const statusColor: Record<PoWStatus, string> = {
    idle: "rgba(120,148,255,0.65)",
    detecting: "#fbbf24",
    solving: "#fbbf24",
    submitting: "#fbbf24",
    accepted: "#4ade80",
    error: "#f87171",
  };

  return (
    <main className="page">
      <AnchorBanner />

      {/* Hero */}
      <section className="hero">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "2rem" }}>🔐</span>
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              background: "linear-gradient(135deg, #a855f7, #fbbf24)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: MONO,
            }}
          >
            Sovereign PoW Gateway
          </h1>
        </div>
        <p
          style={{
            color: "rgba(238,244,255,0.65)",
            fontFamily: MONO,
            fontSize: "0.85rem",
            margin: 0,
          }}
        >
          Non-Deterministic Scanners are intercepted here. Complete the
          Physical Audit Barrier to generate a cryptographic Evidence Bundle.
          All results are sealed immutably to the VaultChain™.
        </p>
      </section>

      {/* Main gate card */}
      <section
        className="card"
        style={{
          border: "2px solid rgba(168,85,247,0.35)",
          background:
            "linear-gradient(160deg, rgba(14,6,28,0.97) 0%, rgba(2,6,23,0.97) 100%)",
          padding: "2rem",
        }}
      >
        {/* Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: statusColor[status],
              display: "inline-block",
              boxShadow:
                status === "solving" || status === "submitting"
                  ? `0 0 8px ${statusColor[status]}`
                  : "none",
            }}
          />
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.75rem",
              color: statusColor[status],
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {statusLabel[status]}
          </span>
        </div>

        {/* Target info */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            { label: "Target IP", value: targetIp },
            { label: "Difficulty", value: `${POW_DIFFICULTY} leading zeros (hex)` },
            {
              label: "Nonce",
              value: status === "idle" ? "—" : nonce.toLocaleString(),
            },
            {
              label: "CPU Cycles (est.)",
              value:
                status === "idle" ? "—" : cpuCycles.toLocaleString(),
            },
            {
              label: "Browser Fingerprint",
              value: fingerprint
                ? `${fingerprint.slice(0, 32)}…`
                : "Detecting…",
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: "0.58rem",
                  color: "rgba(168,85,247,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "0.2rem",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: "0.75rem",
                  color: "rgba(238,244,255,0.85)",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* VaultChain™ Resonance Graph */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.6rem",
              color: "rgba(168,85,247,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.5rem",
            }}
          >
            VaultChain™ Resonance Graph
          </div>
          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(168,85,247,0.25)",
              borderRadius: 6,
              padding: "0.75rem",
            }}
          >
            <ResonanceGraph
              attempts={nonce}
              found={status === "accepted" || status === "submitting"}
            />
          </div>
        </div>

        {/* Entry fee */}
        <div
          style={{
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.6rem",
                color: "rgba(251,191,36,0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "0.2rem",
              }}
            >
              TARI™ Entry Fee
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "#fbbf24",
              }}
            >
              {fmtUsd(entryFeeUsd)}
            </div>
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.62rem",
              color: "rgba(251,191,36,0.5)",
              maxWidth: 240,
              textAlign: "right",
            }}
          >
            ${ENTRY_FEE_BASE.toLocaleString()} base + (CPU cycles ×
            0.000001 Integrity Multiplier)
          </div>
        </div>

        {/* Solution hash (shown after solve) */}
        {solutionHash && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.6rem",
                color: "rgba(120,148,255,0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "0.25rem",
              }}
            >
              Evidence Hash (SHA-512)
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.6rem",
                color: "rgba(120,148,255,0.7)",
                wordBreak: "break-all",
              }}
            >
              {solutionHash}
            </div>
          </div>
        )}

        {/* Seal timestamp */}
        {submittedAt && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.65rem",
              color: "#4ade80",
              marginBottom: "1.5rem",
            }}
          >
            ✓ Sealed to VaultChain™ at {submittedAt}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div
            style={{
              background: "rgba(248,113,113,0.07)",
              border: "1px solid rgba(248,113,113,0.35)",
              borderRadius: 6,
              padding: "0.75rem 1rem",
              fontFamily: MONO,
              fontSize: "0.75rem",
              color: "#f87171",
              marginBottom: "1.5rem",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {/* CTA */}
        {status === "idle" || status === "error" ? (
          <button
            onClick={() => {
              solveRef.current = false;
              setStatus("detecting");
              setTimeout(runPoW, 200);
            }}
            style={{
              background:
                "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(251,191,36,0.15))",
              border: "2px solid rgba(168,85,247,0.55)",
              borderRadius: 8,
              color: "#a855f7",
              cursor: "pointer",
              fontFamily: MONO,
              fontSize: "0.9rem",
              fontWeight: 700,
              padding: "0.85rem 2rem",
              letterSpacing: "0.05em",
              width: "100%",
            }}
          >
            {status === "error" ? "⟳ Retry PoW Puzzle" : "⚡ Initiate Sovereign PoW"}
          </button>
        ) : status === "accepted" ? (
          <div
            style={{
              background: "rgba(74,222,128,0.08)",
              border: "2px solid rgba(74,222,128,0.4)",
              borderRadius: 8,
              color: "#4ade80",
              fontFamily: MONO,
              fontSize: "0.9rem",
              fontWeight: 700,
              padding: "0.85rem 2rem",
              textAlign: "center",
              letterSpacing: "0.05em",
            }}
          >
            ✓ Evidence Bundle Sealed — Entry fee: {fmtUsd(entryFeeUsd)}
          </div>
        ) : (
          <div
            style={{
              background: "rgba(251,191,36,0.06)",
              border: "2px solid rgba(251,191,36,0.3)",
              borderRadius: 8,
              color: "#fbbf24",
              fontFamily: MONO,
              fontSize: "0.9rem",
              fontWeight: 700,
              padding: "0.85rem 2rem",
              textAlign: "center",
              letterSpacing: "0.05em",
              animation: "none",
            }}
          >
            {status === "solving"
              ? `⏳ Solving… attempt ${nonce.toLocaleString()}`
              : "⏳ Sealing to VaultChain™…"}
          </div>
        )}
      </section>

      {/* Info card */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(168,85,247,0.2)",
          background: "rgba(9,6,18,0.85)",
          padding: "1.25rem",
        }}
      >
        <h2
          style={{
            color: "#ffffff",
            marginTop: 0,
            fontFamily: MONO,
            fontSize: "0.95rem",
          }}
        >
          ℹ️ How the Sovereign PoW Gateway Works
        </h2>
        <ul
          style={{
            color: "rgba(238,244,255,0.65)",
            fontFamily: MONO,
            fontSize: "0.75rem",
            lineHeight: "1.8",
            paddingLeft: "1.25rem",
            margin: 0,
          }}
        >
          <li>
            Your browser performs a client-side SHA-512 puzzle (difficulty:{" "}
            {POW_DIFFICULTY} leading zero nibbles).
          </li>
          <li>
            The evidence payload hashes your IP, browser fingerprint, and a
            1,017-notch timestamp.
          </li>
          <li>
            The proven solution and CPU cycle count are sealed as an Immutable
            Evidence Bundle on the VaultChain™.
          </li>
          <li>
            The TARI™ Entry Fee is calculated as{" "}
            <code style={{ color: "rgba(168,85,247,0.8)" }}>
              ${ENTRY_FEE_BASE.toLocaleString()} + (CPU cycles × 0.000001)
            </code>
            .
          </li>
          <li>
            Non-Deterministic Scanners that cannot complete the puzzle are
            denied access to AveryOS™ IP estates.
          </li>
        </ul>
      </section>

      <FooterBadge />
    </main>
  );
}
