"use client";
import Link from "next/link";
import { KERNEL_SHA, DISCLOSURE_MIRROR_PATH } from "../lib/sovereignConstants";

const CAPSULE_SHA =
  "5865fb3d0d2303fefca5bf821b48a7adf1f3a0fa90ebd8567ac7e308c49b0f92496b740ad93f1e1a1bbe7448bb2145e9c5f7596f7b3e27eb6d44252b2416a341";

const FooterBadge = () => {
  return (
    <footer className="footer-badge">
      <div style={{ 
        padding: '1.5rem', 
        background: 'rgba(0, 6, 14, 0.92)', 
        borderTop: '1px solid rgba(120, 148, 255, 0.22)',
        fontSize: '0.85rem',
        color: 'rgba(120, 148, 255, 0.75)',
        textAlign: 'center'
      }}>
        {/* Quick navigation links */}
        <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem 1.25rem' }}>
          {(
            [
              { href: '/', label: 'Home', newTab: false },
              { href: '/license', label: 'License', newTab: false },
              { href: '/licensing', label: 'Licensing Hub', newTab: false },
              { href: '/ip-policy', label: 'IP Policy', newTab: false },
              { href: '/verify', label: 'Verify', newTab: false },
              { href: '/contact', label: 'Contact', newTab: false },
              { href: DISCLOSURE_MIRROR_PATH, label: '🤛🏻 The Proof', newTab: true },
            ] as Array<{ href: string; label: string; newTab: boolean }>
          ).map(({ href, label, newTab }) => (
            <Link
              key={href}
              href={href}
              target={newTab ? '_blank' : undefined}
              rel={newTab ? 'noopener noreferrer' : undefined}
              style={{ color: 'rgba(120, 148, 255, 0.65)', textDecoration: 'none', fontSize: '0.8rem' }}
            >
              {label}
            </Link>
          ))}
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          Powered by CapsuleEcho™ | VaultSignature: ENFORCED
        </div>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.75rem',
          wordBreak: 'break-all',
          color: 'rgba(120, 148, 255, 0.55)'
        }}>
          <strong>AveryAnchored™</strong> | SHA-512 TARI Pricing Model:<br />
          {CAPSULE_SHA}
        </div>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.75rem',
          wordBreak: 'break-all',
          color: 'rgba(120, 148, 255, 0.55)',
          marginTop: '0.5rem'
        }}>
          SHA-512 Kernel Anchor:<br />
          {KERNEL_SHA}
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textAlign: 'center' }}>
          <span>© 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved. Licensed under AveryOS™ Sovereign Integrity License v1.0</span>
        </div>
        {/* Privacy, Terms, and IP Policy — subtle links under copyright */}
        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '1.25rem' }}>
          <Link href="/privacy" style={{ color: 'rgba(120,148,255,0.4)', textDecoration: 'none', fontSize: '0.75rem' }}>Privacy</Link>
          <Link href="/terms" style={{ color: 'rgba(120,148,255,0.4)', textDecoration: 'none', fontSize: '0.75rem' }}>Terms</Link>
          <Link href="/ip-policy" style={{ color: 'rgba(120,148,255,0.4)', textDecoration: 'none', fontSize: '0.75rem' }}>IP Policy</Link>
        </div>
      </div>
    </footer>
  );
};

export default FooterBadge;
