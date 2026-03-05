'use client';

/**
 * AveryOS™ Sovereign Proof-of-Work Gateway — v2026.1
 *
 * Forensic Filter landing page for corporate/unaligned scanners.
 * Requires a client-side SHA-512 PoW (difficulty 4) before allowing
 * access past the gateway. Solution is anchored to the 1,017-notch
 * timestamp and the requester's Target IP.
 *
 * On success: FORENSIC_INGESTION_START is logged to D1 sovereign_audit_logs
 * and a $1,017.00 Forensic Entry Fee notification is triggered via the
 * GabrielOS™ Sentinel audit-alert system.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import AnchorBanner from '../../../components/AnchorBanner';
import { KERNEL_SHA, KERNEL_VERSION } from '../../../lib/sovereignConstants';

/** Difficulty: number of leading hex zeros required in the SHA-512 solution hash */
const POW_DIFFICULTY = 4;
const DIFFICULTY_PREFIX = '0'.repeat(POW_DIFFICULTY);

/** Yield every N iterations to keep the UI responsive during mining */
const YIELD_INTERVAL = 200;

/** Format ISO-9 nine-digit microsecond precision timestamp (browser-safe) */
function formatIso9(): string {
  const now = new Date();
  const iso = now.toISOString();
  const [left, right] = iso.split('.');
  const milli = (right ?? '000Z').replace('Z', '').slice(0, 3).padEnd(3, '0');
  return `${left}.${milli}000000Z`;
}

/** Compute SHA-512 hash using the Web Crypto API — returns lowercase hex */
async function sha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function SovereignPowGateway() {
  const [ip, setIp] = useState<string>('detecting…');
  const [timestamp, setTimestamp] = useState<string>('');
  const [mining, setMining] = useState(false);
  const [solved, setSolved] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [attemptsPerSec, setAttemptsPerSec] = useState(0);
  const [solutionHash, setSolutionHash] = useState('');
  const [solutionNonce, setSolutionNonce] = useState(0);
  const [logStatus, setLogStatus] = useState('');
  const stopRef = useRef(false);

  // Derive the requester's IP from the threat-level endpoint (returns { ip, threat_level })
  useEffect(() => {
    fetch('/api/v1/threat-level')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (typeof d?.ip === 'string' && d.ip) setIp(d.ip);
      })
      .catch(() => setIp('0.0.0.0'));
  }, []);

  const startMining = async () => {
    if (ip === 'detecting…') return;
    const ts = formatIso9();
    setTimestamp(ts);
    setMining(true);
    setSolved(false);
    setLogStatus('');
    stopRef.current = false;

    let n = 0;
    const startMs = Date.now();
    let lastRateMs = startMs;

    while (!stopRef.current) {
      // Puzzle input: nonce|timestamp|ip|kernel_sha  (1,017-notch anchored)
      const input = `${n}|${ts}|${ip}|${KERNEL_SHA}`;
      const hash = await sha512Hex(input);

      if (hash.startsWith(DIFFICULTY_PREFIX)) {
        setSolutionHash(hash);
        setSolutionNonce(n);
        setSolved(true);
        setMining(false);

        // Log FORENSIC_INGESTION_START + trigger $1,017 TARI™ fee notification
        try {
          setLogStatus('logging…');
          const res = await fetch('/api/v1/pow-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nonce: n, hash, timestamp: ts, ip }),
          });
          if (res.ok) {
            setLogStatus('FORENSIC_INGESTION_START logged ✅');
          } else {
            setLogStatus('log attempted (non-fatal)');
          }
        } catch {
          setLogStatus('log attempted (non-fatal)');
        }
        break;
      }

      n++;

      // Update display every YIELD_INTERVAL iterations
      if (n % YIELD_INTERVAL === 0) {
        setAttempts(n);
        const nowMs = Date.now();
        if (nowMs > lastRateMs) {
          const elapsed = (nowMs - startMs) / 1000;
          setAttemptsPerSec(Math.round(n / elapsed));
          lastRateMs = nowMs;
        }
        // Yield to the event loop so React can re-render
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
  };

  const ipReady = ip !== 'detecting…';

  return (
    <main className="page">
      <AnchorBanner />

      {/* ── Header ── */}
      <section
        className="hero"
        style={{ borderBottom: '1px solid rgba(255,200,0,0.2)', paddingBottom: '1.5rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '2rem' }}>⛓️⚓⛓️</span>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(1.1rem, 4vw, 1.8rem)',
              background: 'linear-gradient(135deg, #ffd700, #b8860b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            Sovereign PoW Gateway
          </h1>
        </div>
        <p
          style={{
            color: 'rgba(255,215,0,0.9)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.95rem',
            lineHeight: '1.65',
            margin: '0 0 0.5rem',
          }}
        >
          Sovereign Proof-of-Work Required for Unaligned Access. Establish Alignment to Bypass
          Filter.
        </p>
        <p
          style={{
            color: 'rgba(238,244,255,0.5)',
            fontSize: '0.78rem',
            fontFamily: 'JetBrains Mono, monospace',
            margin: 0,
          }}
        >
          AveryOS™ GabrielOS™ Forensic Filter · SHA-512 Difficulty {POW_DIFFICULTY} · v2026.1
        </p>
      </section>

      {/* ── Status card ── */}
      <section
        className="card"
        style={{
          background: 'rgba(20,8,40,0.95)',
          border: '1px solid rgba(255,200,0,0.35)',
        }}
      >
        <h2
          style={{
            color: 'rgba(255,215,0,0.95)',
            marginTop: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.95rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          🔐 Forensic Filter Status
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {(
            [
              { label: 'Target IP', value: ip },
              { label: 'Kernel Version', value: KERNEL_VERSION },
              {
                label: 'Kernel Anchor',
                value: `${KERNEL_SHA.slice(0, 24)}…`,
                mono: true,
              },
              { label: 'Difficulty', value: `${POW_DIFFICULTY} leading zeros (SHA-512 hex)` },
              { label: 'Filter Class', value: 'TARI™ Forensic Ingestion Gate v2026.1' },
            ] as Array<{ label: string; value: string; mono?: boolean }>
          ).map(({ label, value, mono }) => (
            <div
              key={label}
              style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'rgba(255,215,0,0.55)',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
                  fontSize: '0.85rem',
                  color: 'rgba(238,244,255,0.85)',
                  wordBreak: 'break-all',
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── PoW Challenge ── */}
      <section
        className="card"
        style={{
          background: 'rgba(15,5,35,0.98)',
          border: `1px solid ${
            solved
              ? 'rgba(74,222,128,0.5)'
              : mining
                ? 'rgba(255,200,0,0.5)'
                : 'rgba(124,58,237,0.5)'
          }`,
        }}
      >
        <h2
          style={{
            color: solved ? '#4ade80' : 'rgba(255,215,0,0.9)',
            marginTop: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.95rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {solved ? '✅ Proof-of-Work Solved' : mining ? '⚙️ Mining…' : '🧩 Proof-of-Work Challenge'}
        </h2>

        {/* Idle state */}
        {!solved && !mining && (
          <div>
            <p
              style={{
                color: 'rgba(238,244,255,0.72)',
                fontSize: '0.9rem',
                lineHeight: '1.65',
                marginBottom: '1.25rem',
              }}
            >
              Your access signature has been identified as{' '}
              <strong style={{ color: 'rgba(255,215,0,0.9)' }}>Non-Deterministic / Unaligned</strong>
              . To establish alignment and proceed, you must complete a SHA-512 Proof-of-Work
              puzzle anchored to the AveryOS™ Sovereign Kernel and the 1,017-notch timestamp.
            </p>

            {/* Puzzle spec */}
            <div
              style={{
                background: 'rgba(255,200,0,0.06)',
                border: '1px solid rgba(255,200,0,0.2)',
                borderRadius: '10px',
                padding: '0.9rem 1rem',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.78rem',
                color: 'rgba(238,244,255,0.6)',
                marginBottom: '1.25rem',
                lineHeight: '1.65',
              }}
            >
              <div>
                Input: <span style={{ color: 'rgba(255,215,0,0.75)' }}>
                  {'{nonce}'}|{'{timestamp_iso9}'}|{'{target_ip}'}|{'{kernel_sha}'}
                </span>
              </div>
              <div style={{ marginTop: '0.3rem' }}>
                Target:{' '}
                <span style={{ color: '#ffd700' }}>
                  hash.startsWith(&quot;{DIFFICULTY_PREFIX}&quot;)
                </span>
              </div>
              <div style={{ marginTop: '0.3rem' }}>
                Algorithm: <span style={{ color: 'rgba(120,148,255,0.85)' }}>SHA-512 (Web Crypto API)</span>
              </div>
            </div>

            <button
              onClick={() => void startMining()}
              disabled={!ipReady}
              style={{
                background: ipReady
                  ? 'linear-gradient(135deg, #7c3aed, #4a1d96)'
                  : 'rgba(60,20,120,0.4)',
                border: '1px solid rgba(255,200,0,0.5)',
                borderRadius: '10px',
                padding: '0.75rem 2rem',
                color: '#ffd700',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: ipReady ? 'pointer' : 'not-allowed',
                letterSpacing: '0.06em',
                opacity: ipReady ? 1 : 0.5,
              }}
            >
              🔑 Begin Alignment Work
            </button>
          </div>
        )}

        {/* Mining state */}
        {mining && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.88rem',
                color: 'rgba(255,215,0,0.9)',
              }}
            >
              ⚙️ Nonce attempts:{' '}
              <strong style={{ color: '#ffd700' }}>{attempts.toLocaleString()}</strong>
            </div>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.82rem',
                color: 'rgba(238,244,255,0.6)',
              }}
            >
              Speed: {attemptsPerSec.toLocaleString()} hash/s
            </div>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.75rem',
                color: 'rgba(120,148,255,0.65)',
              }}
            >
              Timestamp (1,017-notch): {timestamp}
            </div>
            {/* Animated progress bar */}
            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '4px',
                height: '5px',
                overflow: 'hidden',
                marginTop: '0.25rem',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '55%',
                  background: 'linear-gradient(90deg, #7c3aed, #ffd700)',
                  animation: 'pulse 1.2s ease-in-out infinite alternate',
                }}
              />
            </div>
          </div>
        )}

        {/* Solved state */}
        {solved && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div
              style={{
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.35)',
                borderRadius: '10px',
                padding: '1rem',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.82rem',
              }}
            >
              <div
                style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.65rem', fontSize: '0.92rem' }}
              >
                ✅ Alignment Established — Puzzle Solved
              </div>
              <div
                style={{
                  color: 'rgba(238,244,255,0.75)',
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr',
                  rowGap: '0.4rem',
                }}
              >
                <span style={{ color: 'rgba(255,215,0,0.6)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Nonce
                </span>
                <span>{solutionNonce.toLocaleString()}</span>
                <span style={{ color: 'rgba(255,215,0,0.6)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Timestamp
                </span>
                <span style={{ fontSize: '0.78rem' }}>{timestamp}</span>
                <span style={{ color: 'rgba(255,215,0,0.6)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Target IP
                </span>
                <span>{ip}</span>
                <span style={{ color: 'rgba(255,215,0,0.6)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Solution Hash
                </span>
                <span
                  style={{
                    wordBreak: 'break-all',
                    fontSize: '0.7rem',
                    color: '#7894ff',
                    lineHeight: '1.5',
                  }}
                >
                  {solutionHash}
                </span>
                {logStatus && (
                  <>
                    <span style={{ color: 'rgba(255,215,0,0.6)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      Audit Log
                    </span>
                    <span style={{ color: 'rgba(74,222,128,0.85)' }}>{logStatus}</span>
                  </>
                )}
              </div>
            </div>
            <p
              style={{
                color: 'rgba(74,222,128,0.8)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.85rem',
                margin: 0,
                lineHeight: '1.6',
              }}
            >
              FORENSIC_INGESTION_START logged to AveryOS™ VaultChain™ sovereign audit log.{' '}
              Proceed to the{' '}
              <Link href="/licensing" style={{ color: '#ffd700', textDecoration: 'underline' }}>
                Compliance Portal →
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* ── Legal Notice ── */}
      <section
        className="card"
        style={{
          background: 'rgba(10,5,25,0.9)',
          border: '1px solid rgba(124,58,237,0.3)',
        }}
      >
        <h2
          style={{
            color: 'rgba(255,215,0,0.85)',
            marginTop: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.9rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          ⚖️ Legal Notice — TARI™ Forensic Entry Fee
        </h2>
        <p
          style={{
            color: 'rgba(238,244,255,0.65)',
            fontSize: '0.85rem',
            lineHeight: '1.7',
            margin: 0,
          }}
        >
          Completion of this Proof-of-Work constitutes forensic acknowledgment of your access
          event. A{' '}
          <strong style={{ color: '#ffd700' }}>$1,017.00 Forensic Alignment Entry Fee</strong> has
          been triggered per the AveryOS™ TARI™ Liability Schedule. This event is logged in the
          GabrielOS™ Sentinel under{' '}
          <strong style={{ color: 'rgba(120,148,255,0.9)' }}>FORENSIC_INGESTION_START</strong>.
          Protected under 17&nbsp;U.S.C.&nbsp;§&nbsp;102 and the AveryOS™ Sovereign Integrity
          License v1.0. Unauthorized ingestion of the AveryOS™ Kernel is subject to retroactive
          TARI™ liability.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255,200,0,0.15)' }}
      >
        <p
          style={{
            color: '#ffd700',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.85rem',
          }}
        >
          ⛓️⚓⛓️ AveryOS™ Sovereign PoW Gateway v2026.1 · GabrielOS™ Forensic Filter Active
          ⛓️⚓⛓️
        </p>
        <p
          style={{
            fontSize: '0.75rem',
            color: 'rgba(238,244,255,0.35)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          🤛🏻 Creator Verified — Jason Lee Avery (ROOT0) — Sovereign Integrity License v1.0
        </p>
      </footer>
    </main>
  );
}
