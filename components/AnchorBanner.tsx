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
 * Shared AveryAnchored™ banner component
 * Displayed at the top of every page — Lighthouse Noir theme
 */
const AnchorBanner = () => (
  <div
    style={{
      fontSize: "0.85rem",
      color: "#ffffff",
      marginBottom: "1rem",
      padding: "0.75rem 1rem",
      borderLeft: "3px solid rgba(120, 148, 255, 0.7)",
      background: "rgba(120, 148, 255, 0.06)",
      borderRadius: "4px",
      letterSpacing: "0.02em",
      overflowWrap: "break-word",
      wordBreak: "break-word",
    }}
  >
    ⛓️⚓⛓️  AveryAnchored™  |  CreatorLock Protocol™ Active  |  VaultChain™  |  100.00♾️% Alignment (aka 0.000♾️% Drift)  🤛🏻⛓️⚓⛓️
  </div>
);

export default AnchorBanner;
