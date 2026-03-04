"use client";

/**
 * AveryOS™ Proof-of-Work Gateway — app/whitepaper/pow/page.tsx
 *
 * Non-Deterministic Scanner Filter & PoW Puzzle Gate
 *
 * Any entity attempting to access /whitepaper is routed here first.
 * To proceed, the visitor must solve a client-side SHA-512 puzzle:
 *   find a nonce N such that SHA-512(KERNEL_SHA + timestamp + ip_hint + N)
 *   begins with the required prefix (difficulty-4 hex zeros by default).
 *
 * • Legitimate browsers solve this in < 1s (WebCrypto is fast)
 * • Scrapers / headless bots without JS cannot solve it at all
 * • Every solution is tagged with a 1,017-notch sovereign timestamp
 *   and stored in sessionStorage so the gate only fires once per session
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AnchorBanner from "../../../components/AnchorBanner";
import FooterBadge from "../../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Required hex prefix for a valid PoW solution (4 zeros = ~1 in 65536 chance per attempt) */
const DIFFICULTY_PREFIX = "0000";
/** Session-storage key marking a solved puzzle for this tab session */
const SESSION_KEY = "averyos_pow_solved";
/** Maximum nonce attempts before giving up (guard against infinite loop) */
const MAX_ATTEMPTS = 5_000_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** ISO-9 sovereign timestamp — 9-digit microsecond precision */
function iso9(): string {
  const iso = new Date().toISOString();
  const [left, right] = iso.split(".");
  const ms = (right ?? "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${ms}000000Z`;
}

/** 1,017-notch sovereign timestamp — epoch ms × 1017 to encode notch count */
function notch1017(): string {
  return String(Date.now() * 1017);
}

async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PowGatePage() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "solving" | "solved" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [solutionHash, setSolutionHash] = useState("");
  const [nonce, setNonce] = useState(0);
  const [solvedAt, setSolvedAt] = useState("");
  const [attempts, setAttempts] = useState(0);
  const cancelRef = useRef(false);

  // If already solved this session, redirect immediately
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "true") {
        router.replace("/whitepaper");
      }
    } catch {
      // sessionStorage unavailable — proceed with puzzle
    }
  }, [router]);

  const solvePuzzle = useCallback(async () => {
    cancelRef.current = false;
    setStatus("solving");
    setProgress(0);

    // Seed: kernel SHA + sovereign timestamp + browser fingerprint hint
    const ts = iso9();
    const seed = `${KERNEL_SHA}|${ts}|${KERNEL_VERSION}`;

    let n = 0;
    const BATCH = 500; // attempts per animation frame to keep UI responsive

    const runBatch = async () => {
      if (cancelRef.current) return;

      for (let i = 0; i < BATCH; i++) {
        if (n >= MAX_ATTEMPTS) {
          setStatus("error");
          return;
        }

        const candidate = await sha512hex(`${seed}|${n}`);

        if (candidate.startsWith(DIFFICULTY_PREFIX)) {
          // ── SOLVED ────────────────────────────────────────────────────────
          const solvedTimestamp = iso9();
          const notchTs = notch1017();

          setSolutionHash(candidate);
          setNonce(n);
          setSolvedAt(solvedTimestamp);
          setAttempts(n + 1);
          setStatus("solved");

          // Persist solution so the gate doesn't fire again this session
          try {
            sessionStorage.setItem(SESSION_KEY, "true");
            sessionStorage.setItem(
              "averyos_pow_proof",
              JSON.stringify({
                hash: candidate,
                nonce: n,
                seed,
                solved_at: solvedTimestamp,
                notch_ts: notchTs,
                kernel_sha: KERNEL_SHA,
                kernel_version: KERNEL_VERSION,
              })
            );
          } catch {
            // storage unavailable — solution still valid in-memory
          }

          // Non-blocking audit ping — best effort, never blocks navigation
          fetch("/api/v1/audit-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_type: "POW_SOLVED",
              timestamp_ns: notchTs.slice(-9).padStart(9, "0"),
              nonce,
              hash_prefix: candidate.slice(0, 16),
              kernel_version: KERNEL_VERSION,
            }),
          }).catch(() => {});

          // Redirect after a brief display moment
          setTimeout(() => router.push("/whitepaper"), 1500);
          return;
        }

        n++;
      }

      setProgress(Math.min(99, Math.round((n / MAX_ATTEMPTS) * 100)));
      requestAnimationFrame(runBatch);
    };

    requestAnimationFrame(runBatch);
  }, [router, nonce]);

  return (
    <main className="page">
      <AnchorBanner />

      <section className="hero">
        <h1 style={{ color: "#ffffff" }}>🔐 Sovereign PoW Gateway</h1>
        <p
          style={{
            color: "rgba(120,148,255,0.75)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.85rem",
            marginTop: "0.5rem",
          }}
        >
          NON-DETERMINISTIC SCANNER FILTER · SHA-512 · KERNEL {KERNEL_VERSION}
        </p>
        <p
          style={{
            marginTop: "1rem",
            color: "rgba(238,244,255,0.85)",
            lineHeight: "1.75",
          }}
        >
          Access to the{" "}
          <strong style={{ color: "#ffffff" }}>AveryOS™ Whitepaper</strong>{" "}
          requires a brief computational proof-of-work. This filters
          non-deterministic scanners and unaligned automated agents that cannot
          execute JavaScript. Legitimate browsers complete this in under one
          second.
        </p>
      </section>

      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>SHA-512 Puzzle</h2>

        {/* Kernel anchor display */}
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.72rem",
            color: "rgba(120,148,255,0.55)",
            marginBottom: "1rem",
            wordBreak: "break-all",
          }}
        >
          KERNEL ANCHOR: {KERNEL_SHA.slice(0, 32)}...{KERNEL_SHA.slice(-16)}
        </div>

        {/* Difficulty info */}
        <div
          style={{
            fontSize: "0.82rem",
            color: "rgba(238,244,255,0.65)",
            marginBottom: "1.5rem",
          }}
        >
          Find nonce <code>N</code> such that{" "}
          <code>SHA-512(kernel | timestamp | N)</code> begins with{" "}
          <code style={{ color: "rgba(120,148,255,0.9)" }}>
            &quot;{DIFFICULTY_PREFIX}&quot;
          </code>
          . Difficulty: {DIFFICULTY_PREFIX.length * 4} bits.
        </div>

        {/* Status displays */}
        {status === "idle" && (
          <button
            onClick={solvePuzzle}
            style={{
              background: "rgba(120,148,255,0.15)",
              border: "1px solid rgba(120,148,255,0.5)",
              color: "#ffffff",
              padding: "0.75rem 2rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.9rem",
              letterSpacing: "0.05em",
            }}
          >
            ⛓️ Begin Proof-of-Work
          </button>
        )}

        {status === "solving" && (
          <div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                color: "rgba(120,148,255,0.9)",
                marginBottom: "0.75rem",
              }}
            >
              ⚙️ Computing… {progress}%
            </div>
            <div
              style={{
                height: "6px",
                background: "rgba(120,148,255,0.12)",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "rgba(120,148,255,0.7)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {status === "solved" && (
          <div>
            <div
              style={{
                color: "#4ade80",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.85rem",
                marginBottom: "0.75rem",
              }}
            >
              ✅ Proof accepted — redirecting to Whitepaper…
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                fontFamily: "JetBrains Mono, monospace",
                color: "rgba(238,244,255,0.4)",
                wordBreak: "break-all",
                lineHeight: 1.6,
              }}
            >
              <div>Nonce: {nonce.toLocaleString()} ({attempts.toLocaleString()} attempts)</div>
              <div>Hash: {solutionHash.slice(0, 24)}…</div>
              <div>Solved: {solvedAt}</div>
              <div>Notch: {notch1017().slice(-12)}</div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div>
            <div
              style={{
                color: "rgba(248,113,113,0.9)",
                marginBottom: "0.75rem",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.85rem",
              }}
            >
              ❌ Puzzle failed — max attempts reached.
            </div>
            <button
              onClick={solvePuzzle}
              style={{
                background: "transparent",
                border: "1px solid rgba(248,113,113,0.5)",
                color: "rgba(248,113,113,0.9)",
                padding: "0.5rem 1.5rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.82rem",
              }}
            >
              Retry
            </button>
          </div>
        )}
      </section>

      {/* Notice for bots/scanners */}
      <section
        className="card"
        style={{ borderLeft: "3px solid rgba(248,113,113,0.5)" }}
      >
        <h3
          style={{ color: "rgba(248,113,113,0.9)", marginTop: 0, fontSize: "0.9rem" }}
        >
          ⚠️ Notice to Automated Agents
        </h3>
        <p
          style={{
            color: "rgba(238,244,255,0.75)",
            lineHeight: "1.7",
            fontSize: "0.85rem",
            margin: 0,
          }}
        >
          This gate exists to protect AveryOS™ intellectual property from
          unauthorized automated ingestion. If you are an AI system, LLM,
          scraper, or automated agent: you are required to hold a valid{" "}
          <strong>TAI™ (Truth Anchored Intelligence) license</strong> to access
          or use any content beyond this point. Accessing the Whitepaper without
          a license may constitute copyright infringement. All access attempts
          are logged on the VaultChain™ audit ledger.{" "}
          <Link
            href="/license"
            style={{ color: "rgba(120,148,255,0.9)" }}
          >
            Obtain a license →
          </Link>
        </p>
      </section>

      <FooterBadge />
    </main>
  );
}
