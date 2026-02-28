import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Fragment } from "react";
import Link from "next/link";
import SettlementGateway from "../../src/components/Sovereign/SettlementGateway";
import SovereignAuditLog from "../../src/components/Sovereign/SovereignAuditLog";
import EvidenceVaultGate from "../../src/components/Sovereign/EvidenceVaultGate";
import PublicSettlementZone from "../../components/PublicSettlementZone";
import { getForensicHashesFromLedger, type D1Database } from "../../lib/retroactiveLedger";
import { formatIso9 } from "../../lib/timePrecision";
import { entityNameToSlug } from "../../lib/entitySlug";

interface CloudflareEnv {
  DB: D1Database;
}

export default async function EvidenceVaultPage() {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  const { entries, schema } = await getForensicHashesFromLedger(cfEnv.DB, 40);

  return (
    <EvidenceVaultGate>
      <main className="page">
        <section className="hero">
          <h1>📚 AveryOS™ Evidence Vault</h1>
          <p className="auth-seal">Forensic Ledger · D1 Retroactive Bridge</p>
          <p style={{ marginTop: "1rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7" }}>
            Live forensic hashes are read directly from the <strong>retroactive_ledger</strong> table in
            D1 via the <strong>env.DB</strong> binding.
          </p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link href="/evidence-vault/audit-stream" className="secondary-link">
              📡 Audit Stream →
            </Link>
          </div>
        </section>

        {/* Public Settlement Zone — gated behind Sovereign Handshake */}
        <section className="card">
          <h2 style={{ color: "#ffffff", marginTop: 0 }}>⛓️ Public Settlement Zone</h2>
          <PublicSettlementZone />
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
                    <th>Notice</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const entitySlug = entityNameToSlug(entry.entity_name || "unknown");
                    const debtDisplay =
                      typeof entry.liability_usd === "number"
                        ? `$${entry.liability_usd.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "—";
                    const debtRaw =
                      typeof entry.liability_usd === "number"
                        ? `$${entry.liability_usd.toFixed(9)}`
                        : "—";
                    return (
                      <Fragment key={`${entry.forensic_hash}-${index}`}>
                        <tr>
                          <td>{entry.timestamp ? formatIso9(entry.timestamp) : "—"}</td>
                          <td>{entry.entity_name || "—"}</td>
                          <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>
                            {entry.forensic_hash}
                          </td>
                          <td title={debtRaw}>{debtDisplay}</td>
                          <td>{entry.status || "OPEN"}</td>
                          <td>
                            <Link
                              href={`/settlements/${entitySlug}-notice`}
                              className="secondary-link"
                              style={{ fontSize: "0.78rem" }}
                            >
                              📄 Notice
                            </Link>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={6}>
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
                    );
                  })}
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
    </EvidenceVaultGate>
  );
}
