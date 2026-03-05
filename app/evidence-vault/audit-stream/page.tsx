import AuditStreamTerminal from "../../../src/components/Sovereign/AuditStreamTerminal";
import EvidenceVaultGate from "../../../src/components/Sovereign/EvidenceVaultGate";

export const metadata = {
  title: "AveryOS™ — Audit Stream",
  description: "Live forensic audit telemetry stream — GabrielOS™ Outbound Layer.",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function AuditStreamPage() {
  return (
    // EvidenceVaultGate returns null until the sessionStorage token is
    // verified — this prevents any page content from flashing before the
    // sovereign handshake is confirmed, then redirects to login if needed.
    <EvidenceVaultGate>
      <main className="page">
        <section className="hero">
          <h1>📡 AveryOS™ Audit Stream</h1>
          <p className="auth-seal">Live Telemetry · D1 Audit Log Feed</p>
          <p
            style={{
              marginTop: "1rem",
              color: "rgba(238,244,255,0.85)",
              lineHeight: "1.7",
            }}
          >
            Real-time forensic telemetry from the <strong>audit_logs</strong> table.
            Every interaction with the Evidence Vault is recorded with 9-digit microsecond precision.
          </p>
        </section>

        <section className="card" style={{ padding: 0 }}>
          <AuditStreamTerminal />
        </section>
      </main>
    </EvidenceVaultGate>
  );
}
