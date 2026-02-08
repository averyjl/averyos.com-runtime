import Head from "next/head";
import { useState, useEffect } from "react";
import { getSiteUrl } from "../lib/siteConfig";
import type { EnforcementEvent } from "../lib/enforcementTypes";

/**
 * License Enforcement Log Page
 * Public, transparent view of license compliance tracking
 * Focus: Voluntary compliance and licensing offers
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
        <title>License Enforcement Log • AveryOS</title>
        <meta
          name="description"
          content="Public, transparent log of AveryOS license compliance tracking. Voluntary licensing offers with SHA-512 verification."
        />
        <meta property="og:title" content="License Enforcement Log • AveryOS" />
        <meta
          property="og:description"
          content="Public, transparent log of AveryOS license compliance tracking."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <section className="hero">
          <h1>License Enforcement Log</h1>
          <p>
            Public, transparent tracking of AveryOS capsule licensing. All events are
            SHA-512 verified and focused on voluntary compliance.
          </p>
        </section>

        <section className="card">
          <h2>About This System</h2>
          <div className="info-grid">
            <div className="info-box">
              <h3>🔐 Purpose</h3>
              <p>
                Track capsule usage and offer voluntary licensing options. Similar to software
                license tracking and DRM compliance systems.
              </p>
            </div>
            <div className="info-box">
              <h3>✅ Transparency</h3>
              <p>
                All enforcement events are publicly viewable with SHA-512 verification.
                No hidden actions or automated legal threats.
              </p>
            </div>
            <div className="info-box">
              <h3>💳 Voluntary Compliance</h3>
              <p>
                Events focus on offering licensing via Stripe. No forced actions, lawsuits,
                or takedown notices.
              </p>
            </div>
            <div className="info-box">
              <h3>⚖️ Creator Rights</h3>
              <p>
                Helps creators protect their work under the AveryOS Sovereign Integrity
                License v1.0.
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Enforcement Events</h2>
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
          <h2>Evidence & Notices</h2>
          <p>
            All enforcement events include SHA-verified evidence bundles and compliance
            notices stored in:
          </p>
          <ul>
            <li>
              <strong>Evidence Bundles:</strong>{" "}
              <code>/license-enforcement/evidence/</code>
            </li>
            <li>
              <strong>Compliance Notices:</strong>{" "}
              <code>/license-enforcement/notices/</code>
            </li>
            <li>
              <strong>Event Logs:</strong> <code>/license-enforcement/logs/</code>
            </li>
          </ul>
          <p className="capsule-meta">
            All records are publicly accessible and cryptographically verifiable.
          </p>
        </section>

        <section className="card">
          <h2>How It Works</h2>
          <ol>
            <li>
              <strong>Detection:</strong> System detects potential capsule usage through
              SHA-512 verification
            </li>
            <li>
              <strong>Evidence:</strong> Creates timestamped, SHA-verified evidence bundle
            </li>
            <li>
              <strong>Notice:</strong> Publishes public compliance notice (informational only)
            </li>
            <li>
              <strong>Offer:</strong> Provides Stripe link for voluntary license purchase
            </li>
            <li>
              <strong>Log:</strong> Records event in public, transparent log
            </li>
          </ol>
          <div className="status-pill">
            This system does NOT automate lawsuits, takedowns, or legal threats
          </div>
        </section>

        <section className="card call-to-action-section">
          <h2>Need a License?</h2>
          <p>
            If you're using AveryOS capsule content, you can purchase a license voluntarily
            through Stripe.
          </p>
          <a href="/buy" className="primary-button">
            View License Options
          </a>
          <a href="/verify" className="secondary-button">
            Verify Your License
          </a>
        </section>

        <section className="card">
          <h2>Questions?</h2>
          <p>
            This system is designed for transparent license tracking, not legal enforcement.
            For questions about licensing, contact:{" "}
            <a href="mailto:truth@averyworld.com">truth@averyworld.com</a>
          </p>
        </section>
      </main>
    </>
  );
};

export default LicenseEnforcementPage;
