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
/**
 * components/BiometricGate.tsx
 *
 * AveryOS™ Biometric Identity Shield — Gate 9
 *
 * Client-side behavioral fingerprinting component for the /ip-policy gate.
 * Collects canvas entropy + timing precision to distinguish human visitors
 * from automated scrapers and AI bots.
 *
 * Signals collected (no PII, no cookies, no persistent storage):
 *   1. Canvas fingerprint — renders test glyphs, hashes pixel buffer with SHA-512 (GATE 116.2).
 *   2. Timing entropy — measures setTimeout jitter and Date.now() resolution.
 *   3. Screen geometry — window inner dimensions (proxy for headless detection).
 *   4. Hardware concurrency — CPU core count (headless browsers often return 1).
 *   5. User-agent hint — navigator.userAgent (cross-referenced with known bot patterns).
 *
 * On mount the component silently collects signals and POSTs a JSON payload
 * to /api/v1/alignment-check for server-side scoring. The component renders
 * nothing visible — it is a transparent audit layer.
 *
 * Author: Jason Lee Avery (ROOT0)
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect, useRef } from "react";

interface BiometricPayload {
  canvas_entropy:       string;
  timing_jitter_ms:     number;
  screen_width:         number;
  screen_height:        number;
  hardware_concurrency: number;
  user_agent_hint:      string;
  collected_at:         string;
  gate:                 string;
}

/**
 * Collect canvas fingerprint using SHA-512 (Web Crypto API).
 * Renders unique test glyphs on an off-screen canvas; the resulting pixel data
 * is hashed with SHA-512 to match the 128-character cf83™ Kernel Root standard.
 * Hardware/driver rendering differences produce distinct, non-reversible fingerprints.
 *
 * GATE 116.2 — Hash Parity Upgrade: SHA-256 replaced with SHA-512 to maintain
 * bit-level parity with the AveryOS™ Kernel Root anchor (cf83....∅™ standard).
 *
 * @returns {Promise<string>} 16-char hex prefix of the full 128-character SHA-512 hash
 */
async function collectCanvasEntropy(): Promise<string> {
  try {
    const canvas  = document.createElement("canvas");
    canvas.width  = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "CANVAS_UNSUPPORTED";

    ctx.textBaseline = "top";
    ctx.font         = "14px 'JetBrains Mono', monospace";
    ctx.fillStyle    = "#ffd700";
    ctx.fillText("⛓️⚓⛓️ AOS Root0 🤛🏻", 2, 2);
    ctx.fillStyle    = "rgba(102,204,0,0.7)";
    ctx.fillText("Sovereign Truth 0xCF83", 4, 22);

    const dataUrl  = canvas.toDataURL();
    const encoded  = new TextEncoder().encode(dataUrl);
    const hashBuf  = await crypto.subtle.digest("SHA-512", encoded);
    const hashHex  = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex.slice(0, 16); // 16-char hex prefix of the full 128-character SHA-512 digest
  } catch {
    return "CANVAS_ERROR";
  }
}

/**
 * Collect timing jitter.
 * Measures the real elapsed time of a 0ms setTimeout call.
 * Headless environments and throttled VMs often show unusual values.
 *
 * @returns {Promise<number>} Measured jitter in ms (rounded to 2 decimals)
 */
function collectTimingJitter(): Promise<number> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    setTimeout(() => {
      const elapsed = performance.now() - t0;
      resolve(Math.round(elapsed * 100) / 100);
    }, 0);
  });
}

/**
 * BiometricGate — transparent behavioral fingerprinting component.
 *
 * @param {{ gate?: string }} props  Optional gate identifier for server logging.
 */
export default function BiometricGate({ gate = "ip-policy" }: { gate?: string }) {
  const posted = useRef(false);

  useEffect(() => {
    if (posted.current) return;
    posted.current = true;

    const run = async () => {
      const canvasEntropy    = await collectCanvasEntropy();
      const timingJitterMs   = await collectTimingJitter();

      const payload: BiometricPayload = {
        canvas_entropy:       canvasEntropy,
        timing_jitter_ms:     timingJitterMs,
        screen_width:         window.innerWidth,
        screen_height:        window.innerHeight,
        hardware_concurrency: navigator.hardwareConcurrency ?? 0,
        user_agent_hint:      navigator.userAgent.slice(0, 200),
        collected_at:         new Date().toISOString(),
        gate,
      };

      try {
        await fetch("/api/v1/alignment-check", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            event_type:        "BIOMETRIC_GATE",
            biometric_payload: payload,
          }),
          // best-effort — never block page render
          signal: AbortSignal.timeout(4000),
        });
      } catch {
        // Silently swallow — biometric gate is non-blocking
      }
    };

    void run();
  }, [gate]);

  // Renders nothing — purely a silent audit layer
  return null;
}
