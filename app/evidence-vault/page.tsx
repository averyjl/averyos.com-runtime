import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Fragment } from "react";
import SettlementGateway from "../../src/components/Sovereign/SettlementGateway";
import SovereignAuditLog from "../../src/components/Sovereign/SovereignAuditLog";
import { getForensicHashesFromLedger, type D1Database } from "../../lib/retroactiveLedger";
import { formatIso9 } from "../../lib/timePrecision";

interface CloudflareEnv {
  DB: D1Database;
}

export default async function EvidenceVaultPage() {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  const { entries, schema } = await getForensicHashesFromLedger(cfEnv.DB, 40);

  return (
    <main className="page">
      <section className="hero">
        <h1>📚 AveryOS™ Evidence Vault</h1>
        <p className="auth-seal">Forensic Ledger · D1 Retroactive Bridge</p>
        <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7" }}>
          Live forensic hashes are read directly from the <strong>retroactive_ledger</strong> table in
          D1 via the <strong>env.DB</strong> binding.
        </p>
      </section>

      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>⛓️ Forensic Hashes</h2>
        {!schema.exists ? (
          <p style={{ color: "rgba(248,113,113,0.9)" }}>
            retroactive_ledger table not found in D1.
          </p>
        ) : !schema.hashColumn ? (
          <p style={{ color: "rgba(248,113,113,0.9)" }}>
            retroactive_ledger is present, but no forensic hash column was detected.
          </p>
        ) : entries.length === 0 ? (
          <p style={{ color: "rgba(238,244,255,0.75)" }}>
            No forensic hashes are currently populated.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Entity</th>
                  <th>Forensic Hash</th>
                  <th>Liability (USD)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <Fragment key={`${entry.forensic_hash}-${index}`}>
                    <tr>
                      <td>{entry.timestamp ? formatIso9(entry.timestamp) : "—"}</td>
                      <td>{entry.entity_name || "—"}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>
                        {entry.forensic_hash}
                      </td>
                      <td>
                        {typeof entry.liability_usd === "number"
                          ? `$${entry.liability_usd.toFixed(9)}`
                          : "—"}
                      </td>
                      <td>{entry.status || "OPEN"}</td>
                    </tr>
                    <tr>
                      <td colSpan={5}>
                        <SettlementGateway
                          entityName={entry.entity_name || "UNRESOLVED_ENTITY"}
                          initialDebt={
                            typeof entry.liability_usd === "number"
                              ? `$${entry.liability_usd.toFixed(9)}`
                              : "Pending D1 Liability"
                          }
                        />
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>🛡️ Sovereign Audit Log</h2>
        <SovereignAuditLog />
      </section>
    </main>
  );
}
