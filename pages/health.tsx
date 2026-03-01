import type { NextPage } from "next";
import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import AnchorBanner from "../components/AnchorBanner";
import AnchorBadge from "../components/AnchorBadge";
import { DISCLOSURE_MIRROR_PATH } from "../lib/sovereignConstants";

type HealthData = {
  status: string;
  kernel_version?: string;
  d1?: string;
  kv?: string;
  error?: string;
};

const HealthPage: NextPage = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/v1/health");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        setHealth(json);
        setLastChecked(new Date());
        setError(false);
      } catch (err) {
        console.error("[HealthPage] Failed to fetch /api/v1/health:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const isOk = !error && health?.status === "SOVEREIGN_SYSTEM_ONLINE";

  return (
    <>
      <Head>
        <title>API Health • AveryOS</title>
        <meta name="description" content="AveryOS API health check — live runtime status monitor." />
        <meta property="og:title" content="API Health • AveryOS" />
        <meta property="og:type" content="website" />
      </Head>

      <main className="page">
        <AnchorBanner />

        <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "rgba(0,6,16,0.72)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "8px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          <AnchorBadge />
        </div>

        <section className="hero">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "2rem" }}>💚</span>
            <h1 style={{ margin: 0, fontSize: "2rem", background: "linear-gradient(135deg, #7894ff, #4a6fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              API Health
            </h1>
          </div>
          <p style={{ color: "rgba(238,244,255,0.8)" }}>
            Live runtime health check for the AveryOS API. Auto-refreshes every 30 seconds.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <div style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Status</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: loading ? "#fbbf24" : isOk ? "#4ade80" : "#f87171" }}>
                {loading ? "CHECKING" : isOk ? "SOVEREIGN_SYSTEM_ONLINE" : "DRIFT_DETECTED"}
              </div>
            </div>
            <div style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>Kernel Version</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#60a5fa" }}>
                {health?.kernel_version ?? "—"}
              </div>
            </div>
            <div style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>D1</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: health?.d1 ? "#4ade80" : "#94a3b8" }}>
                {health?.d1 ?? "—"}
              </div>
            </div>
            <div style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(74,111,255,0.3)", borderRadius: "8px", padding: "0.75rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(238,244,255,0.6)" }}>KV</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: health?.kv ? "#4ade80" : "#94a3b8" }}>
                {health?.kv ?? "—"}
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>📡 Endpoint Response</h2>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(74,111,255,0.2)", color: "#94a3b8", wordBreak: "break-all" }}>
            {loading && <span style={{ color: "#fbbf24" }}>Fetching /api/v1/health…</span>}
            {!loading && error && <span style={{ color: "#f87171" }}>Failed to reach /api/v1/health</span>}
            {!loading && !error && health && (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(health, null, 2)}</pre>
            )}
          </div>
          <p style={{ color: "rgba(238,244,255,0.5)", fontSize: "0.8rem", marginTop: "0.75rem", fontFamily: "JetBrains Mono, monospace" }}>
            Last checked: <span style={{ color: "#60a5fa" }}>{lastChecked.toLocaleTimeString()}</span>
          </p>
        </section>

        <section className="card">
          <h2 style={{ color: "rgba(122,170,255,0.9)", marginTop: 0 }}>🔗 Related</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link href="/vault/vaultchain-status" className="secondary-link" style={{ fontSize: "0.85rem" }}>
              ⚓ VaultChain Status
            </Link>
            <a href="/api/v1/health" target="_blank" rel="noopener noreferrer" className="secondary-link" style={{ fontSize: "0.85rem" }}>
              📡 Raw JSON Endpoint
            </a>
            <a href={DISCLOSURE_MIRROR_PATH} target="_blank" rel="noopener noreferrer" className="secondary-link" style={{ fontSize: "0.85rem" }}>
              🤛🏻 The Proof
            </a>
          </div>
        </section>

        <footer style={{ textAlign: "center", paddingTop: "1rem", borderTop: "1px solid rgba(120,148,255,0.2)" }}>
          <p style={{ color: "#7894ff", fontWeight: 700 }}>⛓️ AveryOS Runtime — Sovereign Truth Terminal ⚓</p>
        </footer>
      </main>
    </>
  );
};

export default HealthPage;
