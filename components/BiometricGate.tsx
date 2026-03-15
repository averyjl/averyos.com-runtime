"use client";

/**
 * components/BiometricGate.tsx
 *
 * AveryOS™ Biometric Gate — Phase 116 GATE 116.2
 *
 * Canvas-entropy + keystroke-timing gate that generates a SHA-512 proof of
 * the Creator's biometric presence at the keyboard.  All entropy hashing
 * uses SHA-512 (128 hex chars) to match the cf83....∅™ Kernel Root standard.
 *
 * Upgrade from SHA-256 (Phase 116 GATE 116.2):
 *   SHA-256 was the browser default, but AveryOS™ does not settle for
 *   industry defaults when a Creator Standard exists.  SHA-512 maintains
 *   bit-level parity with the sovereign kernel anchor.
 *
 * Entropy sources:
 *   1. Canvas fingerprint (WebGL + 2D context pixel rendering)
 *   2. Keystroke timing jitter (inter-key intervals)
 *   3. Kernel anchor (KERNEL_SHA) as a sovereignty seal
 *   4. High-resolution timestamp at gate activation
 *
 * Usage:
 *   <BiometricGate onProof={(proof) => handleProof(proof)} />
 *
 *   onProof receives a {@link BiometricProof} when all entropy sources pass.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Theme ──────────────────────────────────────────────────────────────────────
const BG_DARK    = "#000000";
const GOLD       = "#D4AF37";
const GOLD_DIM   = "rgba(212,175,55,0.55)";
const GOLD_BG    = "rgba(212,175,55,0.07)";
const GOLD_BORD  = "rgba(212,175,55,0.35)";
const GREEN      = "#4ade80";
const GREEN_DIM  = "rgba(74,222,128,0.12)";
const RED_DIM    = "rgba(255,68,68,0.12)";
const MUTED      = "rgba(180,200,255,0.6)";
const FONT_MONO  = "JetBrains Mono, Courier New, monospace";

// ── Types ──────────────────────────────────────────────────────────────────────

/** The biometric proof bundle produced when all entropy checks pass. */
export interface BiometricProof {
  /** 128-char SHA-512 hex digest of composite entropy. */
  entropyHash:      string;
  /** 128-char SHA-512 hex digest of canvas fingerprint only. */
  canvasHash:       string;
  /** 128-char SHA-512 hex digest of keystroke timing only. */
  keystrokeHash:    string;
  /** Kernel version at proof generation time. */
  kernelVersion:    string;
  /** ISO-8601 timestamp of proof generation. */
  generatedAt:      string;
  /** Number of keystroke timing samples collected. */
  sampleCount:      number;
  /** Mean inter-key interval in ms. */
  meanIntervalMs:   number;
}

export interface BiometricGateProps {
  /** Called when all entropy sources have been collected and proof is ready. */
  onProof: (proof: BiometricProof) => void;
  /** Minimum number of keystrokes required before proof is generated (default: 12). */
  minKeystrokes?: number;
  /** Label shown on the typing prompt (default: generic alignment phrase). */
  typingPrompt?: string;
}

// ── SHA-512 helper (Web Crypto API — browser-safe) ────────────────────────────

/**
 * Number of raw canvas pixel bytes sampled for the fingerprint hash.
 * 128 bytes gives adequate hardware-specific entropy while staying well
 * within the canvas sampling budget.
 */
const CANVAS_SAMPLE_BYTES = 128;

/**
 * Compute SHA-512 of an arbitrary string.
 * Returns 128 hex characters — matches the AveryOS™ kernel anchor length.
 */
async function sha512hex(input: string): Promise<string> {
  const buf  = new TextEncoder().encode(input);
  const hash = await globalThis.crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Canvas fingerprint ─────────────────────────────────────────────────────────

/**
 * Generate a canvas fingerprint by rendering a complex scene and extracting
 * the raw pixel bytes.  Returns a SHA-512 hex digest.
 */
async function canvasFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width  = 280;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    if (!ctx) return sha512hex(`canvas_unavailable|${KERNEL_SHA}|${Date.now()}`);

    // Render a scene whose output is hardware/driver dependent
    const grad = ctx.createLinearGradient(0, 0, 280, 0);
    grad.addColorStop(0, "#D4AF37");
    grad.addColorStop(0.5, "#000000");
    grad.addColorStop(1, "#4ade80");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 280, 80);

    ctx.font      = "bold 16px JetBrains Mono, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("AveryOS™ cf83....∅™ Kernel Root", 8, 28);
    ctx.fillText(`SHA-512 | ${KERNEL_VERSION}`, 8, 54);

    // Arc overlays — GPU-dependent rendering
    ctx.strokeStyle = "rgba(212,175,55,0.7)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(250, 40, 28, 0, Math.PI * 2);
    ctx.stroke();

    // Extract raw pixel data → SHA-512
    const pixels = ctx.getImageData(0, 0, 280, 80).data;
    const hex    = Array.from(pixels.subarray(0, CANVAS_SAMPLE_BYTES))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return sha512hex(`canvas|${hex}|${KERNEL_SHA}`);
  } catch {
    return sha512hex(`canvas_error|${KERNEL_SHA}|${Date.now()}`);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

const BiometricGate: React.FC<BiometricGateProps> = ({
  onProof,
  minKeystrokes = 12,
  typingPrompt  = "Truth Anchored Intelligence — AveryOS™ Sovereign Kernel v3.6.2",
}) => {
  const [typedValue,   setTypedValue]   = useState("");
  const [proofState,   setProofState]   = useState<"idle" | "collecting" | "hashing" | "done" | "error">("idle");
  const [statusMsg,    setStatusMsg]    = useState("");
  const [proof,        setProof]        = useState<BiometricProof | null>(null);

  const timingsRef    = useRef<number[]>([]);
  const lastKeyTimeRef = useRef<number>(0);
  const canvasHashRef = useRef<string>("");

  // Pre-compute canvas fingerprint on mount
  useEffect(() => {
    canvasFingerprint().then((h) => { canvasHashRef.current = h; });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key.startsWith("Meta") || e.key.startsWith("Control")) return;
    const now = performance.now();
    if (lastKeyTimeRef.current > 0) {
      timingsRef.current.push(now - lastKeyTimeRef.current);
    }
    lastKeyTimeRef.current = now;
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTypedValue(e.target.value);
    if (proofState === "idle") setProofState("collecting");
  }, [proofState]);

  const generateProof = useCallback(async () => {
    if (timingsRef.current.length < minKeystrokes) {
      setStatusMsg(`Type at least ${minKeystrokes} characters to build keystroke entropy.`);
      return;
    }
    setProofState("hashing");
    setStatusMsg("Computing SHA-512 biometric proof…");

    try {
      const timings = timingsRef.current;
      const meanMs  = timings.reduce((a, b) => a + b, 0) / timings.length;
      const now     = new Date().toISOString();

      // Keystroke timing hash — SHA-512 over serialised intervals
      const keystrokeData  = timings.map((t) => t.toFixed(4)).join(",");
      const keystrokeHash  = await sha512hex(`keystroke|${keystrokeData}|${KERNEL_SHA}`);

      // Canvas fingerprint (may have been pre-computed or computed now)
      const cHash = canvasHashRef.current || await canvasFingerprint();

      // Composite entropy: canvas + keystroke + kernel + timestamp
      const compositeInput = `${cHash}|${keystrokeHash}|${KERNEL_SHA}|${now}`;
      const entropyHash    = await sha512hex(compositeInput);

      const result: BiometricProof = {
        entropyHash,
        canvasHash:    cHash,
        keystrokeHash,
        kernelVersion: KERNEL_VERSION,
        generatedAt:   now,
        sampleCount:   timings.length,
        meanIntervalMs: meanMs,
      };

      setProof(result);
      setProofState("done");
      setStatusMsg("Biometric proof generated — SHA-512 ✓");
      onProof(result);
    } catch (err) {
      setProofState("error");
      setStatusMsg(`Proof generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [minKeystrokes, onProof]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background:   BG_DARK,
      border:       `1px solid ${GOLD_BORD}`,
      borderRadius: "12px",
      padding:      "1.6rem",
      fontFamily:   FONT_MONO,
      color:        GOLD,
      maxWidth:     "640px",
    }}>
      <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        🔐 AveryOS™ Biometric Gate
      </div>
      <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: "1.2rem" }}>
        GATE 116.2 · SHA-512 · Canvas + Keystroke Entropy
      </div>

      {proofState !== "done" && (
        <>
          <div style={{ fontSize: "0.82rem", color: GOLD_DIM, marginBottom: "0.5rem" }}>
            Type the phrase below to collect keystroke timing entropy:
          </div>
          <div style={{
            padding:      "0.6rem 0.9rem",
            background:   GOLD_BG,
            border:       `1px solid ${GOLD_BORD}`,
            borderRadius: "6px",
            fontSize:     "0.8rem",
            marginBottom: "0.8rem",
            userSelect:   "all",
          }}>
            {typingPrompt}
          </div>
          <input
            type="text"
            value={typedValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type here…"
            style={{
              width:        "100%",
              background:   "rgba(20,20,20,0.95)",
              border:       `1px solid ${GOLD_BORD}`,
              borderRadius: "6px",
              color:        GOLD,
              fontFamily:   FONT_MONO,
              fontSize:     "0.88rem",
              padding:      "0.55rem 0.8rem",
              outline:      "none",
              boxSizing:    "border-box",
              marginBottom: "0.8rem",
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div style={{ fontSize: "0.75rem", color: MUTED, marginBottom: "0.9rem" }}>
            Keystrokes collected: {timingsRef.current.length} / {minKeystrokes} minimum
          </div>
          <button
            onClick={generateProof}
            disabled={proofState === "hashing"}
            style={{
              background:   proofState === "hashing" ? "rgba(212,175,55,0.2)" : GOLD_BG,
              border:       `1px solid ${GOLD_BORD}`,
              borderRadius: "8px",
              color:        GOLD,
              fontFamily:   FONT_MONO,
              fontSize:     "0.88rem",
              padding:      "0.6rem 1.2rem",
              cursor:       proofState === "hashing" ? "wait" : "pointer",
              fontWeight:   600,
            }}
          >
            {proofState === "hashing" ? "Computing SHA-512…" : "Generate Biometric Proof"}
          </button>
        </>
      )}

      {statusMsg && (
        <div style={{
          marginTop:  "0.9rem",
          padding:    "0.6rem 0.9rem",
          background: proofState === "done" ? GREEN_DIM : proofState === "error" ? RED_DIM : GOLD_BG,
          borderRadius: "6px",
          fontSize:   "0.8rem",
          color:      proofState === "done" ? GREEN : proofState === "error" ? "#ff6666" : GOLD_DIM,
        }}>
          {statusMsg}
        </div>
      )}

      {proof && proofState === "done" && (
        <div style={{
          marginTop:  "1rem",
          padding:    "0.9rem",
          background: "rgba(0,10,0,0.6)",
          border:     `1px solid rgba(74,222,128,0.3)`,
          borderRadius: "8px",
          fontSize:   "0.74rem",
          color:      MUTED,
        }}>
          <div style={{ color: GREEN, fontWeight: 700, marginBottom: "0.5rem" }}>
            ✅ SHA-512 Biometric Proof
          </div>
          <div>Hash: <span style={{ color: GOLD, wordBreak: "break-all" }}>{proof.entropyHash}</span></div>
          <div style={{ marginTop: "0.4rem" }}>
            Samples: {proof.sampleCount} · Mean interval: {proof.meanIntervalMs.toFixed(1)} ms
          </div>
          <div>Generated: {proof.generatedAt}</div>
          <div>Kernel: {proof.kernelVersion}</div>
        </div>
      )}
    </div>
  );
};

export default BiometricGate;
