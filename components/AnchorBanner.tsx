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
