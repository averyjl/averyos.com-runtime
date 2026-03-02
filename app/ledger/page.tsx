"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import { KERNEL_SHA } from "../../lib/sovereignConstants";

interface VaultChainTransaction {
  id: number;
  transaction_id: string;
  timestamp: string;
  event_type: string;
  private_capsule_sha512: string;
  target: string;
  details: string;
  created_at: string;
}

const MONO = "JetBrains Mono, monospace";

/** Truncate a hash for display while keeping full value in title tooltip */
function truncHash(hash: string, chars = 32) {
  if (hash.length <= chars) return hash;
  return `${hash.slice(0, chars)}…`;
}

function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <input
        type="text"
        placeholder="Filter by Transaction ID, Event Type, Target, or SHA-512…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(120,148,255,0.3)",
          borderRadius: "6px",
          color: "rgba(238,244,255,0.9)",
          fontFamily: MONO,
          fontSize: "0.85rem",
          padding: "0.65rem 1rem",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function LedgerRow({ tx }: { tx: VaultChainTransaction }) {
  return (
    <Link
      href={`/ledger/${encodeURIComponent(tx.transaction_id)}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 180px 1fr 200px",
          gap: "0.75rem",
          padding: "0.85rem 1rem",
          borderBottom: "1px solid rgba(120,148,255,0.12)",
          cursor: "pointer",
          transition: "background 0.15s",
          alignItems: "start",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background =
            "rgba(120,148,255,0.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        {/* Timestamp */}
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.72rem",
            color: "rgba(120,148,255,0.85)",
            wordBreak: "break-all",
          }}
        >
          {tx.timestamp}
        </div>

        {/* Event Type */}
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.78rem",
            color: "#4ade80",
            fontWeight: 600,
          }}
        >
          {tx.event_type}
        </div>

        {/* SHA-512 */}
        <div
          title={tx.private_capsule_sha512}
          style={{
            fontFamily: MONO,
            fontSize: "0.7rem",
            color: "rgba(238,244,255,0.55)",
            wordBreak: "break-all",
          }}
        >
          {truncHash(tx.private_capsule_sha512, 48)}
        </div>

        {/* Transaction ID */}
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.72rem",
            color: "rgba(120,148,255,0.7)",
          }}
        >
          {tx.transaction_id}
        </div>
      </div>
    </Link>
  );
}

function LedgerTable({
  transactions,
}: {
  transactions: VaultChainTransaction[];
}) {
  if (transactions.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem 1rem",
          color: "rgba(238,244,255,0.35)",
          fontFamily: MONO,
          fontSize: "0.85rem",
        }}
      >
        No transactions found.
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 180px 1fr 200px",
          gap: "0.75rem",
          padding: "0.5rem 1rem 0.5rem",
          borderBottom: "1px solid rgba(120,148,255,0.25)",
          fontSize: "0.65rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(120,148,255,0.5)",
          fontFamily: MONO,
        }}
      >
        <span>Timestamp (μs)</span>
        <span>Event Type</span>
        <span>SHA-512 (Private Capsule)</span>
        <span>Transaction ID</span>
      </div>

      {transactions.map((tx) => (
        <LedgerRow key={tx.id} tx={tx} />
      ))}
    </div>
  );
}

export default function LedgerPage() {
  const [transactions, setTransactions] = useState<VaultChainTransaction[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "error">(
    "connecting"
  );
  const latestIdRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInitial = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/ledger/transactions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        transactions: VaultChainTransaction[];
      };
      const txs = data.transactions ?? [];
      setTransactions(txs);
      if (txs.length > 0) {
        latestIdRef.current = Math.max(...txs.map((t) => t.id));
      }
      setLiveStatus("live");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLiveStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  const pollForNew = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/ledger/transactions?since=${latestIdRef.current}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        transactions: VaultChainTransaction[];
      };
      const newTxs = data.transactions ?? [];
      if (newTxs.length > 0) {
        latestIdRef.current = Math.max(...newTxs.map((t) => t.id));
        setTransactions((prev) => [...newTxs, ...prev]);
      }
      setLiveStatus("live");
    } catch {
      setLiveStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchInitial();
    pollRef.current = setInterval(pollForNew, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchInitial, pollForNew]);

  const filtered = transactions.filter((tx) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      tx.transaction_id.toLowerCase().includes(q) ||
      tx.event_type.toLowerCase().includes(q) ||
      tx.private_capsule_sha512.toLowerCase().includes(q) ||
      tx.target.toLowerCase().includes(q)
    );
  });

  const statusColor =
    liveStatus === "live"
      ? "#4ade80"
      : liveStatus === "error"
      ? "#f87171"
      : "#fbbf24";

  return (
    <main className="page">
      <AnchorBanner />

      {/* Header */}
      <section className="hero">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "2rem" }}>⛓️⚓⛓️</span>
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              background: "linear-gradient(135deg, #7894ff, #4a6fff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: MONO,
            }}
          >
            AveryOS VaultChain™ Public Witness Ledger
          </h1>
        </div>
        <p
          style={{
            color: "rgba(238,244,255,0.65)",
            fontFamily: MONO,
            fontSize: "0.85rem",
            margin: 0,
          }}
        >
          Live, cryptographically-anchored record of sealed communications and
          sovereign events. Read-only. Immutable.
        </p>
        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusColor,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.7rem",
              color: statusColor,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {liveStatus === "live"
              ? "Live Feed Active"
              : liveStatus === "error"
              ? "Feed Error — Retrying"
              : "Connecting…"}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.7rem",
              color: "rgba(238,244,255,0.3)",
              marginLeft: "0.5rem",
            }}
          >
            Polling every 5s
          </span>
        </div>
      </section>

      {/* Ledger card */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(120,148,255,0.25)",
          background: "rgba(9,16,34,0.85)",
          padding: "1.25rem",
        }}
      >
        <SearchBar value={filter} onChange={setFilter} />

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "rgba(238,244,255,0.4)",
              fontFamily: MONO,
              fontSize: "0.85rem",
            }}
          >
            ⏳ Loading VaultChain™ transactions…
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "#f87171",
              fontFamily: MONO,
              fontSize: "0.85rem",
            }}
          >
            ⚠️ {error}
          </div>
        ) : (
          <LedgerTable transactions={filtered} />
        )}
      </section>

      {/* Anchor proof strip */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(120,148,255,0.18)",
          background: "rgba(9,16,34,0.7)",
          padding: "1rem 1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(120,148,255,0.5)",
              fontFamily: MONO,
            }}
          >
            AveryOS™ Kernel Root Anchor (SHA-512)
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.72rem",
              color: "#7894ff",
              wordBreak: "break-all",
            }}
          >
            {KERNEL_SHA}
          </div>
        </div>
      </section>
    </main>
  );
}
