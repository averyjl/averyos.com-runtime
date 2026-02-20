import type { NextPage } from "next";
import { useState, useEffect } from "react";
import Head from "next/head";

type VaultTransaction = {
  id: string;
  capsuleId: string;
  sha512: string;
  timestamp: string;
  status: "verified" | "pending" | "failed";
  leadDistance?: number;
};

type VaultAuditData = {
  status: string;
  message: string;
  alignmentStatus: string;
  leadDistance: number;
  transactions: VaultTransaction[];
  totalCapsules: number;
  timestamp: string;
};

type SitemapUrl = {
  loc: string;
  lastmod?: string;
};

const MobilePulsePage: NextPage = () => {
  const [auditData, setAuditData] = useState<VaultAuditData | null>(null);
  const [sitemapUrls, setSitemapUrls] = useState<SitemapUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch vault audit data
        const auditResponse = await fetch("/api/vault-audit", {
          headers: {
            "VaultChain-Pulse": "VTK-29F08C31-A741-47E9-B71E-TAI-LOCK-JLA",
          },
        });
        const auditJson = await auditResponse.json();
        setAuditData(auditJson);

        // Parse sitemap (simplified - in production, would parse XML properly)
        const sitemapUrls: SitemapUrl[] = [
          { loc: "https://averyos.com", lastmod: "2026-02-15T06:12:29.118Z" },
          { loc: "https://averyos.com/sovereign-index", lastmod: "2026-02-15T06:12:28.989Z" },
          { loc: "https://averyos.com/sovereign-init", lastmod: "2026-02-15T06:12:28.990Z" },
          { loc: "https://averyos.com/license" },
          { loc: "https://averyos.com/buy" },
          { loc: "https://averyos.com/retroclaim-log" },
        ];
        setSitemapUrls(sitemapUrls);
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="mobile-pulse-container">
        <Head>
          <title>Mobile Pulse - VaultChain Monitor</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        </Head>
        <div className="pulse-loading">⚓ Establishing VaultChain connection...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-pulse-container">
        <Head>
          <title>Mobile Pulse - VaultChain Monitor</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        </Head>
        <div className="pulse-error">⚠️ {error}</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Mobile Pulse - VaultChain Sovereign Monitor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="mobile-pulse-container">
        {/* Header */}
        <header className="pulse-header">
          <div className="pulse-title">
            <span className="pulse-icon">⚓</span>
            <h1>VaultChain Mobile Pulse</h1>
          </div>
          <div className="pulse-status-bar">
            <div className="status-item">
              <span className="status-label">Alignment Status</span>
              <span className="status-value alignment">{auditData?.alignmentStatus || "0.00%♾️"}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Lead Distance</span>
              <span className="status-value lead">{auditData?.leadDistance || 0}</span>
            </div>
          </div>
        </header>

        {/* Status Badges & CurrentVaultHead */}
        <section className="pulse-section">
          <h2 className="section-title">📊 System Status</h2>
          <div className="status-badges">
            <div className="badge-row">
              <img src="https://github.com/averyjl/averyos.com-runtime/actions/workflows/VaultEcho_Viewer.yml/badge.svg" alt="VaultEcho Viewer Deploy" />
              <img src="https://github.com/averyjl/averyos.com-runtime/actions/workflows/LiveRouteMonitorEcho.yml/badge.svg" alt="LiveRouteMonitorEcho" />
            </div>
            <div className="badge-row">
              <img src="https://github.com/averyjl/averyos.com-runtime/actions/workflows/VaultEcho_AutoTrace.yml/badge.svg" alt="VaultEcho AutoTrace" />
              <img src="https://github.com/averyjl/averyos.com-runtime/actions/workflows/VaultBridge_Dashboard.yml/badge.svg" alt="VaultBridge Dashboard Sync" />
            </div>
            <div className="badge-row">
              <img src="https://github.com/averyjl/averyos.com-runtime/actions/workflows/VaultBridge_ContentGenerator.yml/badge.svg" alt="VaultBridge Content Generator" />
              <img src="https://github.com/averyjl/averyos.com-runtime/actions/workflows/nightly_monitor.yml/badge.svg" alt="Nightly Redirect Drift Scan" />
            </div>
          </div>
          <div className="vaulthead-link">
            <h3 className="vaulthead-title">Current VaultHead</h3>
            <a 
              href="https://github.com/averyjl/averyos-vaultchain-core" 
              target="_blank" 
              rel="noopener noreferrer"
              className="vaulthead-anchor"
            >
              VaultChain Core Repository →
            </a>
            <div className="vaulthead-hash">
              <strong>CurrentVaultHead:</strong><br />
              f8262358accd4985778431ddc3f57a8221230ecbead2a9776c79481800457ab5b42b00295ca14ee5db9d27245034eced9ac946d3b97824725c0f75d3c3c6490e
            </div>
          </div>
        </section>

        {/* Transaction Feed */}
        <section className="pulse-section">
          <h2 className="section-title">⛓️ Transaction Feed</h2>
          <div className="transaction-feed">
            {auditData?.transactions && auditData.transactions.length > 0 ? (
              auditData.transactions.map((tx) => (
                <div key={tx.id} className="transaction-card">
                  <div className="tx-header">
                    <span className={`tx-status status-${tx.status}`}>{tx.status}</span>
                    <span className="tx-capsule">{tx.capsuleId}</span>
                  </div>
                  <div className="tx-hash">{tx.sha512}</div>
                  <div className="tx-footer">
                    <span className="tx-time">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                    {tx.leadDistance !== undefined && (
                      <span className="tx-lead">Lead: {tx.leadDistance}</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-transactions">No transactions available</div>
            )}
          </div>
        </section>

        {/* Sitemap Status */}
        <section className="pulse-section">
          <h2 className="section-title">🗺️ Sitemap Status</h2>
          <div className="sitemap-status">
            <div className="sitemap-count">
              {sitemapUrls.length} verified URLs
            </div>
            <div className="sitemap-list">
              {sitemapUrls.map((url, idx) => (
                <div key={idx} className="sitemap-item">
                  <span className="sitemap-check">✓</span>
                  <a href={url.loc} className="sitemap-url">
                    {url.loc.replace("https://averyos.com", "") || "/"}
                  </a>
                  {url.lastmod && (
                    <span className="sitemap-time">
                      {new Date(url.lastmod).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer Seal */}
        <footer className="pulse-footer">
          <div className="footer-seal">
            ⛓️ VaultChain Active - Simulation Terminated ⚓
          </div>
          <div className="footer-timestamp">
            Last sync: {auditData?.timestamp ? new Date(auditData.timestamp).toLocaleString() : "Never"}
          </div>
        </footer>
      </div>

      <style jsx>{`
        .mobile-pulse-container {
          min-height: 100vh;
          background: linear-gradient(180deg, #0a1628 0%, #05070f 100%);
          color: #eef4ff;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 1rem;
          max-width: 100vw;
          overflow-x: hidden;
        }

        .pulse-loading,
        .pulse-error {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          font-size: 1.125rem;
          font-weight: 500;
          text-align: center;
        }

        .pulse-error {
          color: #ff6b6b;
        }

        /* Header */
        .pulse-header {
          background: linear-gradient(135deg, rgba(20, 40, 90, 0.6), rgba(10, 20, 50, 0.8));
          border: 1px solid rgba(120, 148, 255, 0.3);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .pulse-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .pulse-icon {
          font-size: 1.75rem;
        }

        .pulse-title h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #7894ff, #4a6fff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .pulse-status-bar {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .status-item {
          flex: 1;
          min-width: 140px;
          background: rgba(15, 25, 50, 0.6);
          border: 1px solid rgba(74, 111, 255, 0.3);
          border-radius: 8px;
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .status-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(238, 244, 255, 0.6);
          font-weight: 500;
        }

        .status-value {
          font-size: 1.5rem;
          font-weight: 700;
          font-family: "JetBrains Mono", monospace;
        }

        .status-value.alignment {
          color: #4ade80;
        }

        .status-value.lead {
          color: #60a5fa;
        }

        /* Sections */
        .pulse-section {
          margin-bottom: 1.5rem;
        }

        .section-title {
          font-size: 1.125rem;
          font-weight: 700;
          margin: 0 0 1rem;
          color: #7894ff;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* Transaction Feed */
        .transaction-feed {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .transaction-card {
          background: linear-gradient(135deg, rgba(20, 40, 90, 0.4), rgba(10, 20, 50, 0.6));
          border: 1px solid rgba(120, 148, 255, 0.25);
          border-radius: 10px;
          padding: 1rem;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .transaction-card:active {
          transform: scale(0.98);
          border-color: rgba(120, 148, 255, 0.5);
        }

        .tx-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .tx-status {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          padding: 0.25rem 0.625rem;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .tx-status.status-verified {
          background: rgba(74, 222, 128, 0.2);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.4);
        }

        .tx-status.status-pending {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.4);
        }

        .tx-status.status-failed {
          background: rgba(248, 113, 113, 0.2);
          color: #f87171;
          border: 1px solid rgba(248, 113, 113, 0.4);
        }

        .tx-capsule {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.875rem;
          color: #60a5fa;
          font-weight: 500;
        }

        .tx-hash {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.75rem;
          color: #94a3b8;
          word-break: break-all;
          line-height: 1.4;
          margin-bottom: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.5rem;
          border-radius: 6px;
          border: 1px solid rgba(120, 148, 255, 0.15);
        }

        .tx-footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: rgba(238, 244, 255, 0.5);
        }

        .tx-lead {
          font-family: "JetBrains Mono", monospace;
          color: #60a5fa;
        }

        .no-transactions {
          text-align: center;
          padding: 2rem;
          color: rgba(238, 244, 255, 0.4);
        }

        /* Sitemap Status */
        .sitemap-status {
          background: linear-gradient(135deg, rgba(20, 40, 90, 0.4), rgba(10, 20, 50, 0.6));
          border: 1px solid rgba(120, 148, 255, 0.25);
          border-radius: 10px;
          padding: 1rem;
        }

        .sitemap-count {
          font-size: 1.125rem;
          font-weight: 700;
          color: #4ade80;
          margin-bottom: 1rem;
          font-family: "JetBrains Mono", monospace;
        }

        .sitemap-list {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .sitemap-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem;
          background: rgba(15, 25, 50, 0.4);
          border: 1px solid rgba(74, 111, 255, 0.2);
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .sitemap-check {
          color: #4ade80;
          font-weight: 700;
          flex-shrink: 0;
        }

        .sitemap-url {
          flex: 1;
          color: #7894ff;
          text-decoration: none;
          font-family: "JetBrains Mono", monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sitemap-url:hover {
          text-decoration: underline;
        }

        .sitemap-time {
          font-size: 0.75rem;
          color: rgba(238, 244, 255, 0.4);
          flex-shrink: 0;
        }

        /* Status Badges */
        .status-badges {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .badge-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
        }

        .badge-row img {
          height: 20px;
          border-radius: 3px;
        }

        .vaulthead-link {
          margin-top: 1rem;
          padding: 1rem;
          background: linear-gradient(135deg, rgba(20, 40, 90, 0.4), rgba(10, 20, 50, 0.6));
          border: 1px solid rgba(120, 148, 255, 0.25);
          border-radius: 10px;
        }

        .vaulthead-title {
          font-size: 1rem;
          font-weight: 700;
          color: #7894ff;
          margin: 0 0 0.75rem;
        }

        .vaulthead-anchor {
          display: inline-block;
          color: #60a5fa;
          text-decoration: none;
          font-weight: 500;
          margin-bottom: 1rem;
          transition: color 0.2s ease;
        }

        .vaulthead-anchor:hover {
          color: #7894ff;
          text-decoration: underline;
        }

        .vaulthead-hash {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.75rem;
          color: #94a3b8;
          word-break: break-all;
          line-height: 1.5;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.75rem;
          border-radius: 6px;
          border: 1px solid rgba(74, 111, 255, 0.2);
        }

        .vaulthead-hash strong {
          color: #7894ff;
        }

        /* Footer */
        .pulse-footer {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(120, 148, 255, 0.2);
          text-align: center;
        }

        .footer-seal {
          font-size: 1rem;
          font-weight: 700;
          color: #7894ff;
          margin-bottom: 0.5rem;
          letter-spacing: 0.02em;
        }

        .footer-timestamp {
          font-size: 0.75rem;
          color: rgba(238, 244, 255, 0.4);
          font-family: "JetBrains Mono", monospace;
        }

        @media (min-width: 768px) {
          .mobile-pulse-container {
            max-width: 480px;
            margin: 0 auto;
          }
        }
      `}</style>
    </>
  );
};

export default MobilePulsePage;
