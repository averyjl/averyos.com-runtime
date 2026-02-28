import AuditStreamTerminal from "../../../src/components/Sovereign/AuditStreamTerminal";

export const metadata = {
  title: "AveryOS™ — Audit Stream",
  description: "Live forensic audit telemetry stream — GabrielOS™ Outbound Layer.",
};

export default function AuditStreamPage() {
  return (
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
  );
}
