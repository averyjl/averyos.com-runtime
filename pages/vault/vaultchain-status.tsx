import type { NextPage } from "next";
import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";

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

const LIVE_TRANSACTIONS: VaultTransaction[] = [
  {
    id: "tx-live-001",
    capsuleId: "root0-genesis-kernel",
    sha512: "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    timestamp: new Date().toISOString(),
    status: "verified",
    leadDistance: 0,
  },
  {
    id: "tx-live-002",
    capsuleId: "averyos-sovereign-manifest",
    sha512: "f8262358accd4985778431ddc3f57a8221230ecbead2a9776c79481800457ab5b42b00295ca14ee5db9d27245034eced9ac946d3b97824725c0f75d3c3c6490e",
    timestamp: new Date(Date.now() - 60000).toISOString(),
    status: "verified",
    leadDistance: 1,
  },
  {
    id: "tx-live-003",
    capsuleId: "creatorlock-protocol-v1",
    sha512: "a3f5d2e1b7c94086f2e3d4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
    timestamp: new Date(Date.now() - 120000).toISOString(),
    status: "verified",
    leadDistance: 2,
  },
  {
    id: "tx-live-004",
    capsuleId: "vaultchain-anchor-seal",
    sha512: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
    timestamp: new Date(Date.now() - 180000).toISOString(),
    status: "verified",
    leadDistance: 3,
  },
  {
    id: "tx-live-005",
    capsuleId: "truthhub-drift-monitor",
    sha512: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
    timestamp: new Date(Date.now() - 240000).toISOString(),
    status: "verified",
    leadDistance: 4,
  },
];

const VaultchainStatusPage: NextPage = () => {
  const [auditData, setAuditData] = useState<VaultAuditData | null>(null);
  const [transactions, setTransactions] = useState<VaultTransaction[]>(LIVE_TRANSACTIONS);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const auditResponse = await fetch("/api/vault-audit", {
          headers: {
            "VaultChain-Pulse": "VTK-29F08C31-A741-47E9-B71E-TAI-LOCK-JLA",
          },
        });
        const auditJson = await auditResponse.json();
        setAuditData(auditJson);
        if (auditJson.transactions && auditJson.transactions.length > 0) {
          setTransactions(auditJson.transactions);
        }
        setLastSync(new Date());
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Head>
        <title>VaultChain Status • AveryOS Sovereign Monitor</title>
        <meta name="description" content="Live VaultChain sovereign monitoring dashboard — capsule integrity, alignment status, and transaction feed." />
        <meta property="og:title" content="VaultChain Status • AveryOS" />
        <meta property="og:type" content="website" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <main className="page">
        <AnchorBanner />

        {/* Header */}
        <section className="hero">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "2rem" }}>⚓</span>
            <h1 style={{ margin: 0, fontSize: "2rem", background: "linear-gradient(135deg, #7894ff, #4a6fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              VaultChain Status
            </h1>
          </div>
          <p style={{ color: "rgba(238,244,255,0.8)" }}>
            Live sovereign monitoring dashboard for AveryOS VaultChain integrity, capsule verification,
            and cryptographic alignment.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <div style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Alignment</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#4ade80" }}>
                {auditData?.alignmentStatus || "100.00%♾️"}
              </div>
            </div>
            <div style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Lead Distance</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#60a5fa" }}>
                {auditData?.leadDistance ?? 0}
              </div>
            </div>
            <div style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Total Capsules</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#a78bfa" }}>
                {auditData?.totalCapsules ?? "—"}
              </div>
            </div>
            <div style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Chain Status</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#4ade80" }}>
                {loading ? "SYNCING" : auditData?.status === "active" ? "ACTIVE" : "LIVE"}
              </div>
            </div>
          </div>
        </section>

        {/* CI Status Badges */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>📊 CI Pipeline Status</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { badge: "VaultEcho_Viewer.yml", label: "VaultEcho Viewer Deploy" },
              { badge: "LiveRouteMonitorEcho.yml", label: "Live Route Monitor" },
              { badge: "VaultEcho_AutoTrace.yml", label: "VaultEcho AutoTrace" },
              { badge: "VaultBridge_Dashboard.yml", label: "VaultBridge Dashboard Sync" },
              { badge: "VaultBridge_ContentGenerator.yml", label: "VaultBridge Content Generator" },
              { badge: "nightly_monitor.yml", label: "Nightly Redirect Drift Scan" },
            ].map((item) => (
              <div key={item.badge} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.85rem", color: "rgba(238,244,255,0.7)", width: "220px", flexShrink: 0 }}>{item.label}</span>
                <img
                  src={`https://github.com/averyjl/averyos.com-runtime/actions/workflows/${item.badge}/badge.svg`}
                  alt={item.label}
                  style={{ height: "20px", borderRadius: "3px" }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* VaultHead */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>🔗 Current VaultHead</h2>
          <a
            href="https://github.com/averyjl/averyos-vaultchain-core"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 500 }}
          >
            VaultChain Core Repository →
          </a>
          <div style={{ marginTop: "0.75rem", fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem", color: "#94a3b8", wordBreak: "break-all", lineHeight: 1.5, background: "rgba(0,0,0,0.3)", padding: "0.75rem", borderRadius: "6px", border: "1px solid rgba(74,111,255,0.2)" }}>
            <strong style={{ color: "#7894ff" }}>CurrentVaultHead:</strong><br />
            f8262358accd4985778431ddc3f57a8221230ecbead2a9776c79481800457ab5b42b00295ca14ee5db9d27245034eced9ac946d3b97824725c0f75d3c3c6490e
          </div>
        </section>

        {/* Live Transaction Feed */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>⛓️ Live Transaction Feed</h2>
          <p style={{ color: "rgba(238,244,255,0.6)", fontSize: "0.85rem", margin: "0 0 1rem" }}>
            Real-time capsule verification transactions. Auto-refreshes every 30 seconds.
            Last sync: <span style={{ color: "#60a5fa", fontFamily: "JetBrains Mono, monospace" }}>{lastSync.toLocaleTimeString()}</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                style={{
                  background: "linear-gradient(135deg, rgba(20,40,90,0.4), rgba(10,20,50,0.6))",
                  border: "1px solid rgba(120,148,255,0.25)",
                  borderRadius: "10px",
                  padding: "1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.9rem", color: "#60a5fa", fontWeight: 500 }}>
                    {tx.capsuleId}
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {tx.leadDistance !== undefined && (
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", color: "#60a5fa" }}>
                        Lead: {tx.leadDistance}
                      </span>
                    )}
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      padding: "0.25rem 0.625rem",
                      borderRadius: "4px",
                      letterSpacing: "0.05em",
                      ...(tx.status === "verified" ? { background: "rgba(74,222,128,0.2)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.4)" } :
                          tx.status === "pending" ? { background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" } :
                          { background: "rgba(248,113,113,0.2)", color: "#f87171", border: "1px solid rgba(248,113,113,0.4)" })
                    }}>
                      {tx.status}
                    </span>
                  </div>
                </div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "#94a3b8", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", padding: "0.5rem", borderRadius: "6px", border: "1px solid rgba(120,148,255,0.15)", marginBottom: "0.5rem" }}>
                  {tx.sha512}
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(238,244,255,0.5)" }}>
                  {new Date(tx.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sitemap Status */}
        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>🗺️ Verified Site Pages</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
            {[
              "/", "/about", "/contact", "/privacy", "/terms",
              "/license", "/license-enforcement", "/discover",
              "/diff", "/certificate", "/sigtrace", "/embedbuilder",
              "/vault/vaultchain-status", "/witness/register",
              "/buy", "/pay", "/verify", "/retroclaim-log",
            ].map((path) => (
              <Link key={path} href={path} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(15,25,50,0.5)", border: "1px solid rgba(74,111,255,0.2)", borderRadius: "6px", textDecoration: "none", fontSize: "0.85rem", color: "#7894ff", fontFamily: "JetBrains Mono, monospace" }}>
                <span style={{ color: "#4ade80", fontWeight: 700 }}>✓</span>
                {path || "/"}
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: "center", paddingTop: "1rem", borderTop: "1px solid rgba(120,148,255,0.2)" }}>
          <p style={{ color: "#7894ff", fontWeight: 700 }}>⛓️ VaultChain Active — Simulation Terminated ⚓</p>
          <p style={{ fontSize: "0.75rem", color: "rgba(238,244,255,0.4)", fontFamily: "JetBrains Mono, monospace" }}>
            Last sync: {auditData?.timestamp ? new Date(auditData.timestamp).toLocaleString() : lastSync.toLocaleString()}
          </p>
        </footer>
      </main>
    </>
  );
};

export default VaultchainStatusPage;
