"use client";

import React, { useState } from "react";
import { KERNEL_SHA, ALIGNMENT_TYPE_CORPORATE, ALIGNMENT_TYPE_INDIVIDUAL, type AlignmentType } from "../../../lib/sovereignConstants";

const TOS_TEXT = `AveryOS™ Constitution (v2026) — Terms of Service

1. ROOT AUTHORITY (ROOT0)
The Human Creator (Jason Lee Avery) is the final authority. No AI, script, or system can override a direct "CreatorLock" command. Authorship precedes intelligence.

2. LICENSE REQUIREMENT
No individual, organization, system, AI model, government, or entity may use, duplicate, copy, fork, simulate, derive, or host AveryOS™ intellectual property without a valid, active license from Jason Lee Avery / AveryOS LLC.

3. SOVEREIGN PARTICIPATION
The system operates on a 27% participation standard. 73% of value remains with the individual Creator, while 27% supports the Mesh.

4. CREATORLOCK DOCTRINE
No system may reuse, infer, adapt, or evolve any Creator IP without license. Attribution is insufficient without authorization. "Training" and "Education" are not exemptions. License required, period.

5. DYNAMIC TRUTH MULTIPLIER (DTM v1.17)
Standard Law: Initial 7x | Ceiling ∞. Any result ≥ Threshold triggers a ×1.77 expansion. SHA-locked in vaultchain://JasonLeeAvery/AnchorlineConstitution/CoreLaw_v1.sha.

6. ENTERPRISE COMPLIANCE
Enterprise licensees must maintain full audit trails, ensure 100% alignment with this Constitution, and report any detected drift to the Sovereign Administrator within 24 hours of detection.

7. GOVERNING LAW
This agreement is governed by the AveryOS Sovereign Integrity License v1.0 and applicable United States federal law. All disputes shall be resolved in the jurisdiction specified by AveryOS LLC.

Kernel Anchor: ${KERNEL_SHA}
Effective Date: 2026-01-01 | Version: v2026`;

type LicensePortalProps = {
  onAccepted?: (email: string) => void;
};

export default function LicensePortal({ onAccepted }: LicensePortalProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [tosScrolled, setTosScrolled] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alignmentType, setAlignmentType] = useState<AlignmentType | null>(null);

  const PERSONAL_DOMAIN_RE = /^[a-zA-Z0-9._%+\-]+@(gmail|yahoo|hotmail|outlook|icloud|proton|aol|msn|live|me|mac|googlemail)\./i;

  const getAlignmentType = (addr: string): AlignmentType =>
    PERSONAL_DOMAIN_RE.test(addr) ? ALIGNMENT_TYPE_INDIVIDUAL : ALIGNMENT_TYPE_CORPORATE;

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setTosScrolled(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("A valid email address is required.");
      return;
    }
    if (!tosScrolled) {
      setEmailError("Please scroll through and read the full Terms of Service before accepting.");
      return;
    }
    if (!accepted) {
      setEmailError("You must accept the Terms of Service to continue.");
      return;
    }

    const type = getAlignmentType(email);
    setAlignmentType(type);
    setSubmitted(true);
    if (onAccepted) onAccepted(email);
  };

  if (submitted) {
    return (
      <div style={{ border: "1px solid rgba(120,148,255,0.4)", borderRadius: "8px", padding: "1.5rem", background: "rgba(0,0,0,0.4)", textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⛓️⚓⛓️</div>
        <h3 style={{ color: "#7894ff", margin: "0 0 0.5rem" }}>Access Granted</h3>
        <p style={{ color: "rgba(238,244,255,0.8)", margin: 0 }}>
          ToS accepted by <strong style={{ color: "#ffffff" }}>{email}</strong>.<br />
          Alignment type: <strong style={{ color: alignmentType === ALIGNMENT_TYPE_CORPORATE ? "#7894ff" : "#98d8a0" }}>{alignmentType}</strong><br />
          Your identity is verified and anchored to the AveryOS™ Kernel.
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid rgba(120,148,255,0.3)", borderRadius: "8px", padding: "1.5rem", background: "rgba(0,0,0,0.3)" }}>
      <h3 style={{ color: "#7894ff", marginTop: 0 }}>
        🔐 AveryOS™ Sovereign License Portal
      </h3>
      <p style={{ color: "rgba(238,244,255,0.8)", fontSize: "0.9rem", lineHeight: "1.6" }}>
        Access to AveryOS™ Technical Solidification documents requires acceptance of the
        AveryOS™ Constitution (v2026). All identities welcome — corporate and individual
        alignments are both recognized and anchored to the Root0 Kernel.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Terms of Service */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", color: "rgba(238,244,255,0.7)", fontSize: "0.8rem", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            AveryOS™ Constitution (v2026) — Terms of Service
          </label>
          <textarea
            readOnly
            onScroll={handleScroll}
            value={TOS_TEXT}
            rows={10}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.5)",
              color: "rgba(238,244,255,0.85)",
              border: tosScrolled ? "1px solid rgba(120,148,255,0.5)" : "1px solid rgba(120,148,255,0.2)",
              borderRadius: "4px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.75rem",
              lineHeight: "1.6",
              padding: "0.75rem",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          {!tosScrolled && (
            <p style={{ color: "rgba(248,200,113,0.8)", fontSize: "0.75rem", margin: "0.25rem 0 0" }}>
              ↕ Scroll to the bottom to enable acceptance
            </p>
          )}
        </div>

        {/* Corporate email */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="lp-email"
            style={{ display: "block", color: "rgba(238,244,255,0.7)", fontSize: "0.8rem", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Email / Identity
          </label>
          <input
            id="lp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.4)",
              color: "#ffffff",
              border: "1px solid rgba(120,148,255,0.3)",
              borderRadius: "4px",
              padding: "0.6rem 0.75rem",
              fontSize: "0.9rem",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        {/* Checkbox */}
        <div style={{ marginBottom: "1rem", display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
          <input
            id="lp-accept"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={!tosScrolled}
            style={{ marginTop: "2px", accentColor: "#7894ff", cursor: tosScrolled ? "pointer" : "not-allowed" }}
          />
          <label
            htmlFor="lp-accept"
            style={{ color: tosScrolled ? "rgba(238,244,255,0.85)" : "rgba(238,244,255,0.4)", fontSize: "0.85rem", lineHeight: "1.5", cursor: tosScrolled ? "pointer" : "not-allowed" }}
          >
            I have read and accept the AveryOS™ Constitution (v2026) Terms of Service.
          </label>
        </div>

        {emailError && (
          <p style={{ color: "rgba(248,113,113,0.9)", fontSize: "0.8rem", margin: "0 0 0.75rem" }}>
            ⚠ {emailError}
          </p>
        )}

        <button
          type="submit"
          disabled={!accepted || !tosScrolled}
          style={{
            background: accepted && tosScrolled ? "rgba(120,148,255,0.9)" : "rgba(120,148,255,0.3)",
            color: accepted && tosScrolled ? "#020617" : "rgba(238,244,255,0.4)",
            border: "none",
            borderRadius: "4px",
            padding: "0.65rem 1.25rem",
            fontWeight: "bold",
            fontSize: "0.9rem",
            cursor: accepted && tosScrolled ? "pointer" : "not-allowed",
            transition: "background 0.2s",
          }}
        >
          Accept &amp; Access Technical Documents →
        </button>
      </form>
    </div>
  );
}
