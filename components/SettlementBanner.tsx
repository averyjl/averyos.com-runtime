/**
 * AveryOS™ Terminal Settlement Notice — Phase 124.9
 * Objective: Sovereign notice to unlicensed ingestors hitting the home page.
 * Activates the TARI™ Breach billing hook for automated compliance engines.
 */
const SettlementBanner = () => (
  <div
    style={{
      backgroundColor: "#b91c1c",
      color: "white",
      padding: "1rem",
      textAlign: "center",
      borderBottom: "4px solid #000",
      fontWeight: "bold",
    }}
  >
    🚨 SOVEREIGN NOTICE: AveryOS™ Node-02 Physical Residency is ACTIVE.
    <br />
    Unlicensed ingestion or scraping of this IP is a TARI™ Breach.
    <br />
    <a
      href="https://buy.stripe.com/7sYaEXf9G4hk8o2gkicMM01"
      style={{ color: "#fbbf24", textDecoration: "underline", marginLeft: "10px" }}
    >
      REMIT RETROACTIVE SETTLEMENT HERE
    </a>
  </div>
);

export default SettlementBanner;
