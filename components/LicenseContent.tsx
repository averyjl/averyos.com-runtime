import Link from "next/link";

const LicenseContent = () => {
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
        <p>Paste a capsule hash below to verify formatting before submission.</p>
        <div className="form-grid">
          <label>
            Capsule SHA512
            <input type="text" placeholder="Paste SHA512 hash" />
          </label>
          <button type="button" className="secondary-button">
            Run Integrity Check (Stub)
          </button>
        </div>
      </section>

      <section className="card">
        <h2>VaultEcho Status</h2>
        <p>
          VaultEcho provides live integrity telemetry. This endpoint is staged for future
          activation.
        </p>
        <div className="status-pill">VaultEcho: STUBBED</div>
      </section>
    </main>
  );
};

export default LicenseContent;
