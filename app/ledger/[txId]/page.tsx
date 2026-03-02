import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import AnchorBanner from "../../../components/AnchorBanner";
import { KERNEL_SHA } from "../../../lib/sovereignConstants";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ txId: string }>;
}): Promise<Metadata> {
  const { txId } = await params;
  return {
    title: `${txId} — VaultChain™ Witness Ledger • AveryOS™`,
    description: `Public Witness Ledger entry for VaultChain™ transaction ${txId}. Anchored to the AveryOS™ sovereign runtime.`,
  };
}

function Row({
  label,
  value,
  mono = false,
  breakAll = false,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem",
        paddingBottom: "0.9rem",
        borderBottom: "1px solid rgba(120,148,255,0.1)",
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(120,148,255,0.55)",
          fontFamily: MONO,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? MONO : "inherit",
          fontSize: mono ? "0.78rem" : "0.92rem",
          color: color ?? (mono ? "#7894ff" : "rgba(238,244,255,0.9)"),
          wordBreak: breakAll ? "break-all" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ txId: string }>;
}) {
  const { txId } = await params;

  let tx: VaultChainTransaction | null = null;
  let dbError: string | null = null;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    tx = await cfEnv.DB.prepare(
      `SELECT id, transaction_id, timestamp, event_type, private_capsule_sha512, target, details, created_at
       FROM vaultchain_transactions
       WHERE transaction_id = ?
       LIMIT 1`
    )
      .bind(txId)
      .first<VaultChainTransaction>();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="page">
      <AnchorBanner />

      {/* Breadcrumb */}
      <div
        style={{
          fontFamily: MONO,
          fontSize: "0.75rem",
          color: "rgba(120,148,255,0.6)",
          marginBottom: "1rem",
        }}
      >
        <Link
          href="/ledger"
          style={{ color: "rgba(120,148,255,0.75)", textDecoration: "none" }}
        >
          ⛓️ VaultChain™ Ledger
        </Link>
        {" / "}
        <span style={{ color: "rgba(238,244,255,0.5)" }}>{txId}</span>
      </div>

      {/* Header */}
      <section className="hero">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.75rem" }}>⚓</span>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              background: "linear-gradient(135deg, #7894ff, #4a6fff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: MONO,
            }}
          >
            Transaction Detail
          </h1>
        </div>
        <p
          style={{
            fontFamily: MONO,
            fontSize: "0.8rem",
            color: "rgba(238,244,255,0.5)",
            margin: 0,
          }}
        >
          AveryOS VaultChain™ Public Witness Ledger — Immutable Record
        </p>
      </section>

      {dbError && (
        <section
          className="card"
          style={{ border: "1px solid rgba(248,113,113,0.4)" }}
        >
          <p
            style={{
              color: "#f87171",
              fontFamily: MONO,
              fontSize: "0.8rem",
              margin: 0,
            }}
          >
            ⚠️ Database error: {dbError}
          </p>
        </section>
      )}

      {!tx && !dbError && (
        <section
          className="card"
          style={{ border: "1px solid rgba(248,113,113,0.4)" }}
        >
          <p
            style={{
              color: "#f87171",
              fontFamily: MONO,
              fontSize: "0.8rem",
              margin: 0,
            }}
          >
            🚫 Transaction &ldquo;{txId}&rdquo; not found in the VaultChain™
            ledger.
          </p>
          <Link
            href="/ledger"
            style={{
              display: "inline-block",
              marginTop: "0.75rem",
              color: "#7894ff",
              fontFamily: MONO,
              fontSize: "0.8rem",
              textDecoration: "none",
            }}
          >
            ← Return to Ledger
          </Link>
        </section>
      )}

      {tx && (
        <section
          className="card"
          style={{
            border: "1px solid rgba(74,222,128,0.3)",
            background: "rgba(9,16,34,0.85)",
          }}
        >
          {/* Trust seal */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: "rgba(74,222,128,0.07)",
              border: "1px solid rgba(74,222,128,0.3)",
              borderRadius: "8px",
              marginBottom: "1.5rem",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>🤛🏻</span>
            <div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#4ade80",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                ANCHORED — VaultChain™ Record Verified
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: "0.72rem",
                  color: "rgba(238,244,255,0.55)",
                  marginTop: "0.2rem",
                }}
              >
                Sovereign Integrity License v1.0 · AveryOS™ · Read-Only
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Row label="Transaction ID" value={tx.transaction_id} mono />
            <Row label="Timestamp (9-digit microsecond precision)" value={tx.timestamp} mono />
            <Row label="Event Type" value={tx.event_type} color="#4ade80" />
            <Row label="Target" value={tx.target} />
            <Row
              label="Private Capsule SHA-512"
              value={tx.private_capsule_sha512}
              mono
              breakAll
            />
            <Row label="Details" value={tx.details} />
            <Row label="Ledger Record ID" value={String(tx.id)} mono />
            <Row label="Anchored At (UTC)" value={tx.created_at} mono />
            <Row
              label="AveryOS™ Kernel Root (SHA-512)"
              value={KERNEL_SHA}
              mono
              breakAll
              color="rgba(120,148,255,0.75)"
            />
          </div>
        </section>
      )}

      <div style={{ marginTop: "1rem" }}>
        <Link
          href="/ledger"
          style={{
            fontFamily: MONO,
            fontSize: "0.8rem",
            color: "rgba(120,148,255,0.75)",
            textDecoration: "none",
          }}
        >
          ← Back to VaultChain™ Public Witness Ledger
        </Link>
      </div>
    </main>
  );
}
