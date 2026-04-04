/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * AnchorBanner — AveryOS™ Compact Sovereign Identity Strip
 *
 * GATE 130.9 — Simplified from the verbose anchor text block.
 * The full anchor text "⛓️⚓⛓️ AveryAnchored™ | CreatorLock Protocol™ Active..."
 * has been moved to the FooterBadge (shown at the bottom of every page) as
 * instructed. The top banner now shows a compact sovereign identity indicator
 * that does not compete with page content for vertical space.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
const AnchorBanner = () => (
  <div
    style={{
      fontSize: "0.78rem",
      color: "rgba(120, 148, 255, 0.7)",
      marginBottom: "1rem",
      padding: "0.4rem 0.85rem",
      borderLeft: "2px solid rgba(120, 148, 255, 0.5)",
      background: "rgba(120, 148, 255, 0.04)",
      borderRadius: "0 4px 4px 0",
      letterSpacing: "0.03em",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      overflowWrap: "break-word",
      wordBreak: "break-word",
    }}
  >
    <span>⛓️⚓⛓️</span>
    <span style={{ fontWeight: 600, color: "rgba(120, 148, 255, 0.85)" }}>AveryAnchored™</span>
    <span style={{ opacity: 0.6 }}>·</span>
    <span>CreatorLock Protocol™ Active</span>
    <span style={{ opacity: 0.6 }}>·</span>
    <span>100.00♾️% Aligned</span>
    <span>🤛🏻</span>
  </div>
);

export default AnchorBanner;

