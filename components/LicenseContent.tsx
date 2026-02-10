import Link from "next/link";
import { useState } from "react";

const LicenseContent = () => {
  const [hashInput, setHashInput] = useState("");
  const [checkResult, setCheckResult] = useState<{
    status: string;
    message: string;
    hashValid?: boolean;
    hashMatch?: boolean;
    capsuleId?: string;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [vaultEchoStatus, setVaultEchoStatus] = useState<{
    status: string;
    message: string;
  } | null>(null);

  const runIntegrityCheck = async () => {
    if (!hashInput.trim()) {
      setCheckResult({
        status: "error",
        message: "Please enter a SHA-512 hash to verify.",
      });
      return;
    }

    setIsChecking(true);
    setCheckResult(null);

    try {
      const response = await fetch(`/api/vaultecho?hash=${encodeURIComponent(hashInput.trim())}`);
      const data = await response.json();
      setCheckResult(data);
    } catch (error) {
      setCheckResult({
        status: "error",
        message: "Failed to connect to VaultEcho API.",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const checkVaultEchoStatus = async () => {
    try {
      const response = await fetch("/api/vaultecho");
      const data = await response.json();
      setVaultEchoStatus(data);
    } catch (error) {
      setVaultEchoStatus({
        status: "error",
        message: "Failed to connect to VaultEcho.",
      });
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <h1>AveryOS Sovereign Integrity License v1.0</h1>
        <p>
          Public license validation, terms, and integrity signals for capsule-based deployments.
          This page defines the sovereign usage expectations for AveryOS capsule content.
        </p>
        <div className="cta-row">
          <Link className="primary-link" href="/buy">
            Purchase License
          </Link>
          <Link className="secondary-link" href="/verify">
            Verify License
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>License Terms</h2>
        <ul>
          <li>All capsule content is bound to its <strong>SHA512</strong> integrity fingerprint.</li>
          <li>Licenses grant non-transferable access to the named capsule holder.</li>
          <li>Redistribution, resale, or modification requires written consent.</li>
          <li>Retroclaim entries are append-only and considered authoritative.</li>
          <li>Violations trigger automatic vault invalidation and public notice.</li>
        </ul>
        <p className="capsule-meta">
          Contact: <a href="mailto:truth@averyworld.com">truth@averyworld.com</a>
        </p>
      </section>

      <section className="card">
        <h2>SHA512 Integrity Check</h2>
        <p>Paste a capsule hash below to verify formatting and check against the registry.</p>
        <div className="form-grid">
          <label>
            Capsule SHA512
            <input
              type="text"
              placeholder="Paste SHA512 hash"
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={runIntegrityCheck}
            disabled={isChecking}
          >
            {isChecking ? "Checking..." : "Run Integrity Check"}
          </button>
        </div>
        {checkResult && (
          <div className={checkResult.status === "error" ? "status-pill" : ""}>
            <p><strong>Status:</strong> {checkResult.status}</p>
            <p>{checkResult.message}</p>
            {checkResult.hashValid !== undefined && (
              <p><strong>Hash Valid:</strong> {checkResult.hashValid ? "✓ Yes" : "✗ No"}</p>
            )}
            {checkResult.hashMatch !== undefined && (
              <p><strong>Registry Match:</strong> {checkResult.hashMatch ? "✓ Yes" : "✗ No"}</p>
            )}
            {checkResult.capsuleId && (
              <p><strong>Capsule ID:</strong> {checkResult.capsuleId}</p>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>VaultEcho Status</h2>
        <p>
          VaultEcho provides live integrity telemetry for capsule verification and registry monitoring.
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={checkVaultEchoStatus}
        >
          Check VaultEcho Status
        </button>
        {vaultEchoStatus && (
          <div style={{ marginTop: "1rem" }}>
            <div className="status-pill">
              VaultEcho: {vaultEchoStatus.status === "active" ? "ACTIVE" : "ERROR"}
            </div>
            <p style={{ marginTop: "0.5rem" }}>{vaultEchoStatus.message}</p>
          </div>
        )}
      </section>
    </main>
  );
};

export default LicenseContent;
