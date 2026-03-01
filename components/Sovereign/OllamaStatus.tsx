// AveryOS™ Ollama Local Sync Status
// Auth: Crater | Node: PC-IGNITION-1017

import React from 'react';
import { OLLAMA_SYNC_STATUS_ACTIVE } from '../../lib/sovereignConstants';

const FONT_MONO = 'JetBrains Mono, Courier New, monospace';

const OllamaStatus = ({ syncStatus }: { syncStatus: string }) => {
  const isActive = syncStatus === OLLAMA_SYNC_STATUS_ACTIVE;
  const statusColor = isActive ? '#00FF41' : '#FF0000';
  const statusLabel = isActive ? 'ACTIVE' : 'DISCONNECTED';
  const statusIcon = isActive ? '🟢' : '🔴';

  return (
    <div
      style={{
        background: 'rgba(0,20,0,0.7)',
        border: `1px solid ${statusColor}`,
        borderRadius: '10px',
        padding: '1.25rem 1.5rem',
        fontFamily: FONT_MONO,
        color: statusColor,
        boxShadow: `0 0 18px ${statusColor}33`,
      }}
    >
      <div
        style={{
          fontSize: '0.68rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: isActive ? 'rgba(0,255,65,0.65)' : 'rgba(255,0,0,0.65)',
          marginBottom: '0.5rem',
        }}
      >
        ⚡ Ollama Sovereign Node
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '1.2rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textShadow: `0 0 14px ${statusColor}`,
        }}
      >
        <span role="img" aria-label={statusLabel}>{statusIcon}</span>
        {statusLabel}
      </div>
      <div
        style={{
          marginTop: '0.4rem',
          fontSize: '0.72rem',
          color: isActive ? 'rgba(0,255,65,0.65)' : 'rgba(255,0,0,0.65)',
          letterSpacing: '0.05em',
        }}
      >
        registry_sync_status: {syncStatus}
      </div>
    </div>
  );
};

export default OllamaStatus;
