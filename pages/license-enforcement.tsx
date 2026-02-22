import Head from "next/head";
import { useState, useEffect } from "react";
import { getSiteUrl } from "../lib/siteConfig";
import type { EnforcementEvent } from "../lib/enforcementTypes";
import AnchorBanner from "../components/AnchorBanner";

/**
 * License Enforcement Log Page
 * Public, transparent view of license compliance tracking
 * All use of AveryOS IP is subject to mandatory licensing.
 */
const LicenseEnforcementPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/license-enforcement`;
  const [events, setEvents] = useState<EnforcementEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/enforcement-log")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load enforcement log:", err);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <Head>
        <title>License Enforcement • AveryOS</title>
        <meta
          name="description"
          content="AveryOS License Enforcement — all use of AveryOS intellectual property requires a valid, active license. Violations are tracked and enforced."
        />
        <meta property="og:title" content="License Enforcement • AveryOS" />
        <meta
          property="og:description"
          content="All use of AveryOS IP requires a valid license. Public enforcement log with SHA-512 verification."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <AnchorBanner />

        <section className="hero">
          <h1>⚖️ License Enforcement</h1>
          <p style={{ color: "rgba(248,113,113,0.9)", fontWeight: 700, fontSize: "1.15rem", marginTop: "0.75rem", lineHeight: "1.6" }}>
            🔴 MANDATORY NOTICE: ANY and ALL use of AveryOS intellectual property — without exception — requires a valid, active, written license from Jason Lee Avery. No implied licenses exist. No fair-use exceptions apply. No grace periods are granted.
          </p>
          <p style={{ marginTop: "0.75rem", color: "rgba(238,244,255,0.85)", lineHeight: "1.7" }}>
            This page publicly documents all enforcement actions. Every violation is SHA-512 verified,
            timestamped, and permanently recorded on the VaultChain. Unlicensed use triggers immediate
            enforcement procedures including takedown notices, legal claims, vault invalidation, and irrevocable public disclosure.
          </p>
        </section>

        <section className="card" style={{ border: "2px solid rgba(248,113,113,0.6)", background: "rgba(248,113,113,0.07)" }}>
          <h2 style={{ color: "rgba(248,113,113,0.95)", fontSize: "1.25rem" }}>🔴 ZERO-TOLERANCE LICENSING POLICY</h2>
          <p style={{ fontWeight: 700, lineHeight: "1.8", color: "rgba(238,244,255,0.95)", fontSize: "1.05rem" }}>
            The AveryOS Sovereign Integrity License v1.0 is <strong>non-negotiable, globally enforceable, and retroactively applicable</strong>.
            Licensing is <strong>MANDATORY — not optional — for ALL of the following</strong>:
          </p>
          <ul style={{ lineHeight: "2.2", color: "rgba(238,244,255,0.95)", fontWeight: 500 }}>
            <li>Any use, reproduction, display, or reference to AveryOS content, capsules, or code</li>
            <li>Derivative works, forks, mirrors, adaptations, or any content substantially similar to AveryOS IP</li>
            <li>ML/AI training datasets, fine-tuning sets, or inference pipelines incorporating AveryOS content</li>
            <li>Research, archival, academic, or internal usage of any kind</li>
            <li>Commercial or non-commercial redistribution in any form or medium</li>
            <li>Simulated playback, scraping, automated crawling, or programmatic access</li>
            <li>Use by AI agents, LLMs, bots, or any automated systems</li>
            <li>Integration into products, services, platforms, or workflows of any kind</li>
          </ul>
          <p style={{ color: "rgba(248,113,113,0.9)", fontWeight: 700, marginTop: "1rem", fontSize: "1rem" }}>
            Ignorance of this license is not a valid defense. Violations are prosecuted to the fullest extent of the law.
          </p>
          <div style={{ marginTop: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="/pay" className="primary-button" style={{ display: "inline-flex", textDecoration: "none", alignItems: "center", background: "rgba(248,113,113,0.9)", color: "#020617" }}>
              Obtain License Now — Required
            </a>
            <a href="mailto:legal@averyworld.com" className="secondary-button" style={{ display: "inline-flex", textDecoration: "none", alignItems: "center" }}>
              Contact Legal
            </a>
          </div>
        </section>

        <section className="card">
          <h2>Enforcement Framework</h2>
          <div className="info-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: "1rem" }}>
            <div className="info-box" style={{ background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1rem" }}>
              <h3 style={{ color: "rgba(248,113,113,0.9)" }}>🔐 Detection</h3>
              <p style={{ color: "rgba(238,244,255,0.75)", fontSize: "0.9rem" }}>
                All capsule usage is tracked via SHA-512 fingerprinting, VaultEcho telemetry,
                and CreatorLock Protocol monitoring. Violations are detected automatically and immediately.
              </p>
            </div>
            <div className="info-box" style={{ background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1rem" }}>
              <h3 style={{ color: "rgba(248,113,113,0.9)" }}>📋 Evidence Bundle</h3>
              <p style={{ color: "rgba(238,244,255,0.75)", fontSize: "0.9rem" }}>
                Every enforcement event generates a timestamped, SHA-512 verified evidence bundle
                that is permanently recorded and legally admissible.
              </p>
            </div>
            <div className="info-box" style={{ background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1rem" }}>
              <h3 style={{ color: "rgba(248,113,113,0.9)" }}>⚖️ Legal Action</h3>
              <p style={{ color: "rgba(238,244,255,0.75)", fontSize: "0.9rem" }}>
                Unlicensed use is subject to breach-of-contract claims, DMCA takedowns, and
                sovereign enforcement under U.S. and international intellectual property law.
              </p>
            </div>
            <div className="info-box" style={{ background: "rgba(9,16,34,0.7)", border: "1px solid rgba(120,148,255,0.2)", borderRadius: "10px", padding: "1rem" }}>
              <h3 style={{ color: "rgba(248,113,113,0.9)" }}>📢 Public Disclosure</h3>
              <p style={{ color: "rgba(238,244,255,0.75)", fontSize: "0.9rem" }}>
                All enforcement actions are publicly disclosed on this page and the VaultChain.
                Vault invalidation is automatic and irreversible upon confirmed violation.
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Enforcement Log</h2>
          {loading ? (
            <p>Loading enforcement log...</p>
          ) : events.length === 0 ? (
            <div className="status-pill">No enforcement events recorded</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Capsule ID</th>
                    <th>Event Type</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>SHA-512 (prefix)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.timestamp).toLocaleString()}</td>
                      <td>
                        <code>{event.capsuleId}</code>
                      </td>
                      <td>
                        <span className="badge">{event.eventType}</span>
                      </td>
                      <td>
                        <span className="status-pill">{event.status}</span>
                      </td>
                      <td>
                        <code>{event.referenceId}</code>
                      </td>
                      <td>
                        <code className="hash-preview">
                          {event.capsuleSha512.substring(0, 16)}...
                        </code>
                      </td>
                      <td>
                        {event.stripeProductId && (
                          <a href="/buy" className="action-link-small">
                            View License
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Enforcement Process</h2>
          <ol style={{ lineHeight: "2" }}>
            <li>
              <strong>Detection:</strong> Unauthorized use detected via SHA-512 capsule fingerprinting
              and VaultEcho telemetry
            </li>
            <li>
              <strong>Evidence:</strong> Timestamped, SHA-512 verified evidence bundle created and sealed
            </li>
            <li>
              <strong>Notice:</strong> Formal compliance notice issued — licensing required within 48 hours
            </li>
            <li>
              <strong>Escalation:</strong> Non-compliance escalates to DMCA takedown, legal claims,
              and permanent public record
            </li>
            <li>
              <strong>Vault Invalidation:</strong> Unlicensed content is invalidated on the VaultChain
              and publicly marked as unauthorized
            </li>
          </ol>
        </section>

        <section className="card" style={{ background: "rgba(248,113,113,0.07)", border: "2px solid rgba(248,113,113,0.5)" }}>
          <h2 style={{ color: "rgba(248,113,113,0.95)" }}>⚠️ Obtain a License — No Exceptions</h2>
          <p style={{ fontWeight: 700, color: "rgba(238,244,255,0.95)", fontSize: "1.05rem" }}>
            ANY use of AveryOS intellectual property without a valid, active license is a direct violation
            of the AveryOS Sovereign Integrity License v1.0 and subject to immediate enforcement.
          </p>
          <p>
            Licenses must be obtained <strong>before</strong> any use. Retroactive licensing may be available
            at the sole discretion of Jason Lee Avery and will include a retroactive fee. No retroactive
            licensing is guaranteed.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <a href="/pay" className="primary-button" style={{ display: "inline-flex", textDecoration: "none", alignItems: "center", background: "rgba(248,113,113,0.9)", color: "#020617" }}>
              License Portal — Required
            </a>
            <a href="/verify" className="secondary-button" style={{ display: "inline-flex", textDecoration: "none", alignItems: "center" }}>
              Verify Your License
            </a>
            <a href="mailto:legal@averyworld.com" className="secondary-button" style={{ display: "inline-flex", textDecoration: "none", alignItems: "center" }}>
              Contact Legal: legal@averyworld.com
            </a>
          </div>
        </section>
      </main>
    </>
  );
};

export default LicenseEnforcementPage;

