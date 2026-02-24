import { LGIC_CAPSULE_SHA } from "../lib/capsuleConstants";

const CapsuleEchoFooter = () => {
  return (
    <footer className="footer-badge">
      <div style={{
        padding: '1.5rem',
        background: 'rgba(9, 16, 34, 0.85)',
        borderTop: '1px solid rgba(120, 148, 255, 0.25)',
        fontSize: '0.85rem',
        color: 'rgba(238, 244, 255, 0.7)',
      }}>
        <div style={{ marginBottom: '0.75rem' }}>
          Powered by CapsuleEcho™ | VaultSignature: ENFORCED
        </div>
        <div style={{
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          wordBreak: 'break-all',
          color: 'rgba(176, 198, 255, 0.7)',
        }}>
          <strong>CapsuleEcho™</strong> | LGIC Capsule SHA:<br />
          {LGIC_CAPSULE_SHA}
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
          © 1992–2025 Jason Lee Avery / AveryOS. All Rights Reserved. Licensed under AveryOS Sovereign Integrity License v1.0
        </div>
      </div>
    </footer>
  );
};

export default CapsuleEchoFooter;
