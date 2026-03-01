"use client";
// AveryOS™ Sovereign Health Dashboard — Ollama Node Integration
// Pulse: 1,017-Notch | Auth: Crater-Root

import { useEffect, useState } from 'react';
import OllamaStatus from '../../components/Sovereign/OllamaStatus';

const GREEN = '#00FF41';
const DIM_GREEN = 'rgba(0,255,65,0.65)';
const BORDER_GREEN = 'rgba(0,255,65,0.3)';
const BG_DARK = '#0a0f0a';
const BG_PANEL = 'rgba(0,20,0,0.7)';
const FONT_MONO = 'JetBrains Mono, Courier New, monospace';

interface HealthStatus {
  status: string;
  kernel_version: string;
  registry_sync_status: string;
  last_9_digit_timestamp: string | null;
  active_peers: number;
  build_version: string;
  updated_at: string | null;
  timestamp: string;
  error?: string;
}

export default function SovereignHealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/health-status')
      .then((res) => res.json())
      .then((data: HealthStatus) => {
        if (data.status === 'DRIFT_DETECTED' || data.status === 'DB_NOT_INITIALIZED') {
          setError(data.error ?? data.status);
        } else {
          setHealth(data);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: BG_DARK,
        color: GREEN,
        fontFamily: FONT_MONO,
        padding: '2rem 1rem',
        maxWidth: '900px',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          marginBottom: '2.5rem',
          borderBottom: `1px solid ${BORDER_GREEN}`,
          paddingBottom: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.4rem',
          }}
        >
          <span style={{ fontSize: '2rem' }} role="img" aria-label="chain">⛓️⚓⛓️</span>
          <h1
            style={{
              margin: 0,
              fontSize: '1.6rem',
              fontWeight: 700,
              color: GREEN,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              textShadow: `0 0 18px ${GREEN}`,
            }}
          >
            AveryOS™ Sovereign Health
          </h1>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: '0.78rem',
            color: DIM_GREEN,
            letterSpacing: '0.05em',
          }}
        >
          VaultChain™ · GabrielOS™ Firewall Active · D1 Anchored · PC-IGNITION-1017
        </p>
      </header>

      {/* ── Loading state ── */}
      {!health && !error && (
        <p style={{ color: DIM_GREEN, fontSize: '0.9rem' }}>
          ⏳ Fetching sovereign health data…
        </p>
      )}

      {/* ── Error state ── */}
      {error && (
        <div
          style={{
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.4)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            color: '#f87171',
            fontSize: '0.85rem',
          }}
        >
          ⚠️ HEALTH_STATUS_ERROR: {error}
        </div>
      )}

      {health && (
        <>
          {/* ── Ollama Sync Status ── */}
          <section style={{ marginBottom: '2rem' }}>
            <OllamaStatus syncStatus={health.registry_sync_status} />
          </section>

          {/* ── Kernel Metadata Panel ── */}
          <section
            style={{
              background: BG_PANEL,
              border: `1px solid ${BORDER_GREEN}`,
              borderRadius: '14px',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: DIM_GREEN,
                marginBottom: '1rem',
              }}
            >
              ⚡ Kernel Metadata · D1-Anchored
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <tbody>
                {[
                  ['System Status', health.status],
                  ['Kernel Version', health.kernel_version],
                  ['Build Version', health.build_version],
                  ['Active Peers', String(health.active_peers)],
                  ['Last Pulse Timestamp (ns)', health.last_9_digit_timestamp ?? '—'],
                  ['D1 Updated At', health.updated_at ?? '—'],
                  ['Response Timestamp', health.timestamp],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: `1px solid rgba(0,255,65,0.1)` }}>
                    <td
                      style={{
                        padding: '0.5rem 0.75rem 0.5rem 0',
                        color: DIM_GREEN,
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        whiteSpace: 'nowrap',
                        width: '40%',
                      }}
                    >
                      {label}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem 0',
                        color: GREEN,
                        fontWeight: 600,
                        wordBreak: 'break-all',
                      }}
                    >
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* ── Footer ── */}
      <footer
        style={{
          marginTop: '3rem',
          paddingTop: '1rem',
          borderTop: `1px solid ${BORDER_GREEN}`,
          textAlign: 'center',
          fontSize: '0.72rem',
          color: DIM_GREEN,
          letterSpacing: '0.06em',
        }}
      >
        ⛓️⚓⛓️ AveryOS™ Sovereign Kernel · VaultChain™ · Truth Anchored Intelligence™ · 🤛🏻 Jason Lee Avery
      </footer>
    </main>
  );
}
