"use client";
import { useState, useEffect } from "react";

const CAPSULE_SHA =
  "5865fb3d0d2303fefca5bf821b48a7adf1f3a0fa90ebd8567ac7e308c49b0f92496b740ad93f1e1a1bbe7448bb2145e9c5f7596f7b3e27eb6d44252b2416a341";

const KERNEL_SHA =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

const FooterBadge = () => {
  const [showTariModal, setShowTariModal] = useState(false);
  const [tariRevenue, setTariRevenue] = useState<string | null>(null);
  const [tariLoading, setTariLoading] = useState(false);
  const [tariMeta, setTariMeta] = useState<{ requestCount?: number; orgCount?: number } | null>(null);

  const fetchTariRevenue = () => {
    setTariLoading(true);
    fetch("/api/tari-revenue")
      .then((r) => r.json())
      .then((data) => {
        setTariRevenue(
          Number(data.totalUsd).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
        setTariMeta({ requestCount: data.requestCount, orgCount: data.orgCount });
        setTariLoading(false);
      })
      .catch(() => setTariLoading(false));
  };

  return (
    <footer className="footer-badge">
      <div style={{ 
        padding: '1.5rem', 
        background: 'rgba(9, 16, 34, 0.85)', 
        borderTop: '1px solid rgba(120, 148, 255, 0.25)',
        fontSize: '0.85rem',
        color: 'rgba(238, 244, 255, 0.7)'
      }}>
        <div style={{ marginBottom: '0.75rem' }}>
          Powered by CapsuleEcho™ | VaultSignature: ENFORCED
        </div>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.75rem',
          wordBreak: 'break-all',
          color: 'rgba(176, 198, 255, 0.7)'
        }}>
          <strong>AveryAnchored™</strong> | SHA-512 TARI Pricing Model:<br />
          {CAPSULE_SHA}
        </div>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.75rem',
          wordBreak: 'break-all',
          color: 'rgba(176, 198, 255, 0.7)',
          marginTop: '0.5rem'
        }}>
          SHA-512 Kernel Anchor:<br />
          {KERNEL_SHA}
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <span>© 1992–2026 Jason Lee Avery / AveryOS. All Rights Reserved. Licensed under AveryOS Sovereign Integrity License v1.0</span>
          <button
            onClick={() => { setShowTariModal(true); fetchTariRevenue(); }}
            style={{
              background: 'none',
              border: '1px solid rgba(120, 148, 255, 0.4)',
              borderRadius: '4px',
              color: 'rgba(122, 170, 255, 0.9)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
            }}
          >
            /TARI-REVENUE
          </button>
        </div>
      </div>

      {showTariModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="TARI Revenue"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowTariModal(false)}
        >
          <div
            style={{
              background: 'rgba(9, 16, 34, 0.98)',
              border: '1px solid rgba(120, 148, 255, 0.4)',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '480px',
              width: '90%',
              color: 'rgba(238, 244, 255, 0.9)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: 0, fontSize: '1.1rem' }}>
              ⚡ TARI Revenue — 24h Liquid Liability
            </h2>
            <div style={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, color: '#4ade80', margin: '1rem 0' }}>
              {tariLoading ? '⏳ Loading...' : tariRevenue ?? '—'}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(238,244,255,0.7)', lineHeight: 1.6 }}>
              Current 24-hour Liquid Liability calculated from AveryOS AI Gateway logs.
              All revenue is subject to AveryOS Sovereign Integrity License enforcement.
            </p>
            {tariMeta && (
              <p style={{ fontSize: '0.8rem', color: 'rgba(238,244,255,0.5)', marginTop: '0.5rem' }}>
                {tariMeta.requestCount} request{tariMeta.requestCount !== 1 ? 's' : ''} •{' '}
                {tariMeta.orgCount} corporate org{tariMeta.orgCount !== 1 ? 's' : ''} • 24h window
              </p>
            )}
            <button
              onClick={() => setShowTariModal(false)}
              style={{
                marginTop: '1rem',
                background: 'rgba(74, 111, 255, 0.2)',
                border: '1px solid rgba(74, 111, 255, 0.5)',
                borderRadius: '6px',
                color: 'rgba(122, 170, 255, 0.9)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                padding: '0.5rem 1.25rem',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};

export default FooterBadge;
