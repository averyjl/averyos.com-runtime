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

