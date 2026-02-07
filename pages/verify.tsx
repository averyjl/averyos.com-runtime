import Head from "next/head";
import { useMemo, useState } from "react";
import { getSiteUrl } from "../lib/siteConfig";
import { verifyCapsuleHash } from "../scripts/verifyCapsuleHash";

const HASH_LENGTH = 128;

const VerifyPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/verify`;
  const [hashInput, setHashInput] = useState("");

  const isValidSha512 = useMemo(() => verifyCapsuleHash(hashInput), [hashInput]);

  const validateHash = () => {
    const value = hashInput.trim();
    if (value.length !== HASH_LENGTH || !verifyCapsuleHash(value)) {
      alert("Hash must be a valid 128-character SHA512 hex string.");
      return;
    }
    alert("SHA512 hash format verified.");
  };

  return (
    <>
      <Head>
        <title>Verify Capsule License</title>
        <meta
          name="description"
          content="Validate AveryOS capsule licenses by capsule ID, customer email, or hash."
        />
        <meta property="og:title" content="Verify Capsule License" />
        <meta
          property="og:description"
          content="Validate AveryOS capsule licenses by capsule ID, customer email, or hash."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <section className="hero">
          <h1>Capsule License Validator</h1>
          <p>
            Search by capsule ID, customer email, or SHA512 hash. File uploads are validated in
            future runtime releases.
          </p>
        </section>
        <section className="card">
          <h2>Lookup</h2>
          <div className="form-grid">
            <label>
              Capsule ID
              <input type="text" placeholder="e.g. sovereign-index" />
            </label>
            <label>
              Customer Email
              <input type="email" placeholder="you@example.com" />
            </label>
            <label>
              Capsule SHA512
              <input
                type="text"
                placeholder="Paste SHA512 hash"
                value={hashInput}
                onChange={(event) => setHashInput(event.target.value)}
              />
              <span className="capsule-meta-small">Expected: SHA-512 (128 hex characters)</span>
              <span className="capsule-meta-text">Expected: SHA-512 (128 hex characters)</span>
            </label>
            {isValidSha512 ? (
              <p className="hash-valid">🔐 SHA512 format valid</p>
            ) : (
              <p className="capsule-meta-small">Awaiting valid SHA512 input.</p>
              <p className="capsule-meta-text">Awaiting valid SHA512 input.</p>
            )}
            <label>
              Upload .aoscap
              <input type="file" accept=".aoscap,application/json" />
            </label>
            <button type="button" className="primary-button" onClick={validateHash}>
              Validate License (Stub)
            </button>
          </div>
          <div className="status-pill">Validation engine: STUBBED</div>
        </section>
      </main>
    </>
  );
};

export default VerifyPage;
