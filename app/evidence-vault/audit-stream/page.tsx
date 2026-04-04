/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
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
