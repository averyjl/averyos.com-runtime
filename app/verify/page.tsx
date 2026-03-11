"use client";

import { useMemo, useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";

const HASH_LENGTH = 128;
const HASH_REGEX = /^[a-fA-F0-9]{128}$/;

type ValidationResult = {
  status: "success" | "error" | "not_found";
  message: string;
  capsuleId?: string;
  hashValid?: boolean;
  hashMatch?: boolean;
};

const VerifyPage = () => {
  const [hashInput, setHashInput] = useState("");
  const [capsuleIdInput, setCapsuleIdInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const isValidSha512 = useMemo(() => HASH_REGEX.test(hashInput.trim()), [hashInput]);

  const validateLicense = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      if (hashInput.trim()) {
        const value = hashInput.trim();
        if (value.length !== HASH_LENGTH || !HASH_REGEX.test(value)) {
          setValidationResult({
            status: "error",
            message: "Hash must be a valid 128-character SHA512 hex string.",
            hashValid: false,
          });
          setIsValidating(false);
          return;
        }

        const response = await fetch(`/api/vaultecho?hash=${encodeURIComponent(value)}`);
        const data = await response.json();

        if (data.hashMatch) {
          setValidationResult({
            status: "success",
            message: `License verified! Hash matched to capsule: ${data.capsuleId}`,
            capsuleId: data.capsuleId,
            hashValid: true,
            hashMatch: true,
          });
        } else if (data.hashValid) {
          setValidationResult({
            status: "not_found",
            message: "Hash format is valid but no matching capsule found in registry.",
            hashValid: true,
            hashMatch: false,
          });
        } else {
          setValidationResult({
            status: "error",
            message: data.message || "Hash validation failed.",
            hashValid: false,
          });
        }
        setIsValidating(false);
        return;
      }

      if (capsuleIdInput.trim()) {
        const response = await fetch(
          `/api/vaultecho?capsuleId=${encodeURIComponent(capsuleIdInput.trim())}`
        );
        const data = await response.json();

        if (response.status === 200 && data.capsuleId) {
          setValidationResult({
            status: "success",
            message: `Capsule '${data.capsuleId}' found in registry.`,
            capsuleId: data.capsuleId,
          });
        } else {
          setValidationResult({
            status: "not_found",
            message: `Capsule '${capsuleIdInput.trim()}' not found in registry.`,
          });
        }
        setIsValidating(false);
        return;
      }

      if (emailInput.trim()) {
        setValidationResult({
          status: "error",
          message: "Email-based validation is not yet implemented.",
        });
        setIsValidating(false);
        return;
      }

      setValidationResult({
        status: "error",
        message: "Please provide a Capsule ID or SHA512 hash to validate.",
      });
    } catch {
      setValidationResult({
        status: "error",
        message: "Failed to connect to validation service.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <main className="page">
      <AnchorBanner />
      <section className="hero">
        <h1>Capsule License Validator</h1>
        <p>
          Search by capsule ID, customer email, or SHA512 hash to verify capsule integrity and
          registry status.
        </p>
      </section>
      <section className="card">
        <h2>Lookup</h2>
        <div className="form-grid">
          <label>
            Capsule ID
            <input
              type="text"
              placeholder="e.g. sovereign-index"
              value={capsuleIdInput}
              onChange={(event) => setCapsuleIdInput(event.target.value)}
            />
          </label>
          <label>
            Customer Email
            <input
              type="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
            />
            <span className="capsule-meta">Email validation: Coming soon</span>
          </label>
          <label>
            Capsule SHA512
            <input
              type="text"
              placeholder="Paste SHA512 hash"
              value={hashInput}
              onChange={(event) => setHashInput(event.target.value)}
            />
            <span className="capsule-meta">Expected: SHA-512 (128 hex characters)</span>
          </label>
          {isValidSha512 ? (
            <p className="hash-valid">🔐 SHA512 format valid</p>
          ) : hashInput.trim() ? (
            <p className="capsule-meta">Invalid SHA512 format.</p>
          ) : (
            <p className="capsule-meta">Awaiting valid SHA512 input.</p>
          )}
          <label>
            Upload .aoscap
            <input
              type="file"
              accept=".aoscap,application/json"
              disabled
              aria-label="File upload - coming soon"
              aria-describedby="file-upload-status"
            />
            <span id="file-upload-status" className="capsule-meta">
              File validation: Coming soon
            </span>
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={validateLicense}
            disabled={isValidating}
          >
            {isValidating ? "Validating..." : "Validate License"}
          </button>
        </div>

        {validationResult && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              borderRadius: "8px",
              background: "rgba(9, 16, 34, 0.75)",
              border: `1px solid ${
                validationResult.status === "success"
                  ? "rgba(74, 222, 128, 0.4)"
                  : validationResult.status === "error"
                    ? "rgba(248, 113, 113, 0.4)"
                    : "rgba(250, 204, 21, 0.4)"
              }`,
              color: "rgba(238, 244, 255, 0.9)",
            }}
          >
            <p>
              <strong>Status:</strong>{" "}
              {validationResult.status === "success"
                ? "✓ Valid"
                : validationResult.status === "error"
                  ? "✗ Error"
                  : "⚠ Not Found"}
            </p>
            <p>{validationResult.message}</p>
            {validationResult.capsuleId && (
              <p>
                <strong>Capsule ID:</strong> {validationResult.capsuleId}
              </p>
            )}
          </div>
        )}

        <div className="status-pill" style={{ marginTop: "1rem" }}>
          Validation engine: ACTIVE
        </div>
      </section>
      <FooterBadge />
    </main>
  );
};

export default VerifyPage;
