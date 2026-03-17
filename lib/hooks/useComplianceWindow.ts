/**
 * lib/hooks/useComplianceWindow.ts
 *
 * AveryOS™ 72-Hour Compliance Window Hook — GATE 118.2 / GATE 118.6.4
 *
 * Returns the elapsed time since the JWKS ACTIVE broadcast (2026-03-12 00:00 UTC)
 * and whether the 72-hour compliance acknowledgment window is still ACTIVE.
 *
 * Shape:
 *   { status: "ACTIVE" | "ELAPSED", label: string }
 *
 * label is a human-readable elapsed string, e.g. "71h 59m 30s" or "4d 12h 07m".
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use client";

import { useState, useEffect } from "react";

/** ISO-8601 UTC date/time of the JWKS ACTIVE broadcast that started the compliance clock. */
const COMPLIANCE_START_UTC = new Date("2026-03-12T00:00:00Z");

/** The 72-hour window expressed in milliseconds. */
const WINDOW_MS = 72 * 60 * 60 * 1_000;

export interface ComplianceWindowResult {
  /** "ACTIVE" when < 72 h have elapsed; "ELAPSED" afterwards. */
  status: "ACTIVE" | "ELAPSED";
  /** Human-readable elapsed time string, e.g. "71h 59m 30s" or "4d 12h 07m". */
  label: string;
}

/**
 * Format an elapsed milliseconds value as a compact human-readable string.
 * Examples: "4d 12h 07m", "71h 59m 30s", "0h 00m 05s"
 */
function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const days    = Math.floor(totalSeconds / 86_400);
  const hours   = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${hours}h ${pad(minutes)}m`;
  }
  return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/**
 * Returns the current state of the 72-hour compliance window, updating every
 * second while the component that uses this hook is mounted.
 */
export function useComplianceWindow(): ComplianceWindowResult {
  const [result, setResult] = useState<ComplianceWindowResult>(() => {
    const elapsed = Date.now() - COMPLIANCE_START_UTC.getTime();
    return {
      status: elapsed < WINDOW_MS ? "ACTIVE" : "ELAPSED",
      label:  formatElapsed(elapsed),
    };
  });

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - COMPLIANCE_START_UTC.getTime();
      setResult({
        status: elapsed < WINDOW_MS ? "ACTIVE" : "ELAPSED",
        label:  formatElapsed(elapsed),
      });
    };

    const id = setInterval(tick, 1_000);
    tick(); // immediate first tick
    return () => clearInterval(id);
  }, []);

  return result;
}
