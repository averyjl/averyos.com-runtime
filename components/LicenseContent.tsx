import Link from "next/link";
import { useState } from "react";
import AnchorBanner from "./AnchorBanner";

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
      <AnchorBanner />
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
        <div style={{ lineHeight: "1.8", color: "rgba(238,244,255,0.85)" }}>
          <p style={{ fontWeight: 600, color: "rgba(122,170,255,0.9)" }}>
            © 1992–2026 Jason Lee Avery / AveryOS. All Rights Reserved.
          </p>
          <p>
            This project, all associated capsules, runtime logic, media, trademarks, and documentation are
            licensed under the <strong>AveryOS Sovereign Integrity License v1.0</strong> (aka "The SIL-1" —
            A Sovereign Authorship Enforcement License).
          </p>

          <h3 style={{ color: "rgba(122,170,255,0.9)" }}>🔒 License Terms (Non-Negotiable):</h3>
          <ul style={{ lineHeight: "1.9" }}>
            <li>
              No individual, organization, system, AI model, government, or entity — past, present, or future —
              may use, duplicate, copy, fork, simulate, derive, or host this project or any portion of it
              without a valid, active license directly from the creator, Jason Lee Avery.
            </li>
            <li>
              This license is perpetual, exclusive, and globally enforceable. All rights not expressly
              granted are fully retained and protected under U.S. and international law.
            </li>
            <li>
              Licensing is <strong>MANDATORY</strong> even for:
              <ul>
                <li>Derivative works</li>
                <li>ML/AI training datasets</li>
                <li>Research / archival use</li>
                <li>Internal usage, mirroring, or simulated playback</li>
              </ul>
            </li>
          </ul>

          <h3 style={{ color: "rgba(122,170,255,0.9)" }}>🧬 Sovereign Proof Anchor</h3>
          <p>
            This project is sealed via VaultSig and deterministic SHA lineage anchored to the Creator:
          </p>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem", background: "rgba(0,0,0,0.3)", padding: "0.75rem", borderRadius: "6px", border: "1px solid rgba(120,148,255,0.2)", wordBreak: "break-all", lineHeight: 1.6 }}>
            <strong>SHA-512 Anchor:</strong><br />
            cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
          </div>
          <p style={{ marginTop: "0.75rem" }}>
            <strong>Glyph:</strong> 🤛🏻 &nbsp;|&nbsp;
            <strong>Runtime Mode:</strong> Sovereign FullStack &nbsp;|&nbsp;
            <strong>License Enforcement:</strong> CapsuleEcho | LicenseBot | CreatorLock ENABLED
          </p>

          <h3 style={{ color: "rgba(122,170,255,0.9)" }}>📩 To Request a License:</h3>
          <ul style={{ lineHeight: "1.9" }}>
            <li>Email: <a href="mailto:truth@averyworld.com" style={{ color: "rgba(120,148,255,0.9)" }}>truth@averyworld.com</a></li>
            <li>Or visit: <a href="https://averyos.com/pay" style={{ color: "rgba(120,148,255,0.9)" }}>averyos.com/pay</a></li>
          </ul>
          <p>
            Failure to obtain a license may result in takedown notices, breach-of-contract assertions,
            or sovereign code tracing and enforcement mechanisms.
          </p>

          <h3 style={{ color: "rgba(122,170,255,0.9)" }}>🔐 Respect Sovereign Authorship</h3>
          <p>
            This isn&apos;t just a license — it&apos;s a boundary of authorship, protection of minor children,
            and invocation of glyph-locked truth speech.
          </p>
          <p>
            Any attempt to clone, commercialize, misrepresent, or auto-consume this repository without
            a license is a direct violation of this sovereign covenant.
          </p>
        </div>
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
