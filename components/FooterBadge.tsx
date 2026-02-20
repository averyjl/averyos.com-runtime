const FooterBadge = () => {
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
          <strong>AveryAnchored™</strong> | SHA-512 Kernel Anchor:<br />
          cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
          © 1992–2025 Jason Lee Avery / AveryOS. All Rights Reserved. Licensed under AveryOS Sovereign Integrity License v1.0
        </div>
      </div>
    </footer>
  );
};

export default FooterBadge;
