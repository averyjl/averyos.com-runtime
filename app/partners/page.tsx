"use client";

/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";

const MONO = "JetBrains Mono, monospace";

interface Partner {
  partner_id: string;
  partner_name: string | null;
  alignment_type: string;
  alignment_hash: string | null;
  badge_hash: string;
  tari_reference: string | null;
  aligned_at: string;
  valid_until: string | null;
  status: string;
}

/** Truncate a long hash for display, keeping the full value in a title tooltip. */
function truncHash(hash: string, chars = 24) {
  if (!hash || hash.length <= chars) return hash ?? "";
  return `${hash.slice(0, chars)}…`;
}

function StatusPill({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        background: isActive ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
        border: `1px solid ${isActive ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`,
        borderRadius: 4,
        padding: "0.15rem 0.5rem",
        fontFamily: MONO,
        fontSize: "0.65rem",
        fontWeight: 700,
        color: isActive ? "#4ade80" : "#f87171",
        letterSpacing: "0.05em",
      }}
    >
      {isActive ? "✓ VERIFIED" : "✗ " + status}
    </span>
  );
}

function PartnerCard({ partner }: { partner: Partner }) {
  const hash = partner.alignment_hash ?? partner.badge_hash;
  const displayName = partner.partner_name ?? partner.partner_id;
  const verifyPath = `/api/v1/verify/${hash}`;

  return (
    <div
      style={{
        background: "rgba(9,16,34,0.9)",
        border: "1px solid rgba(120,148,255,0.2)",
        borderRadius: 10,
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
      }}
    >
      {/* Name + status row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {displayName}
        </div>
        <StatusPill status={partner.status} />
      </div>

      {/* Alignment ID */}
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.6rem",
            color: "rgba(120,148,255,0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: "0.2rem",
          }}
        >
          Alignment ID (SHA-512)
        </div>
        <div
          title={hash}
          style={{
            fontFamily: MONO,
            fontSize: "0.65rem",
            color: "rgba(120,148,255,0.75)",
            wordBreak: "break-all",
          }}
        >
          {truncHash(hash, 48)}
        </div>
      </div>

      {/* Activation date */}
      <div
        style={{
          fontFamily: MONO,
          fontSize: "0.68rem",
          color: "rgba(238,244,255,0.45)",
        }}
      >
        Activated:{" "}
        <span style={{ color: "rgba(238,244,255,0.75)" }}>
          {partner.aligned_at.slice(0, 10)}
        </span>
        {partner.tari_reference && (
          <>
            &nbsp;·&nbsp;
            <span style={{ color: "rgba(120,148,255,0.6)" }}>
              {partner.tari_reference}
            </span>
          </>
        )}
      </div>

      {/* Verify button */}
      <div style={{ marginTop: "0.25rem" }}>
        <Link
          href={verifyPath}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "rgba(120,148,255,0.1)",
            border: "1px solid rgba(120,148,255,0.35)",
            borderRadius: 6,
            color: "rgba(120,148,255,0.85)",
            fontFamily: MONO,
            fontSize: "0.7rem",
            padding: "0.35rem 0.75rem",
            textDecoration: "none",
            transition: "background 0.15s",
          }}
        >
          🔗 Verify on VaultChain™
        </Link>
      </div>
    </div>
  );
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/partners");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { partners: Partner[] };
      setPartners(data.partners ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
    pollRef.current = setInterval(fetchPartners, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPartners]);

  const filtered = partners.filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (p.partner_name ?? "").toLowerCase().includes(q) ||
      p.partner_id.toLowerCase().includes(q) ||
      (p.alignment_hash ?? "").toLowerCase().includes(q) ||
      p.badge_hash.toLowerCase().includes(q) ||
      (p.tari_reference ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="page">
      <AnchorBanner />

      {/* Hero */}
      <section className="hero">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "2rem" }}>🏛️</span>
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
            Sovereign Partner Directory
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
          Public ledger of every entity holding an active AveryOS™ Sovereign
          Alignment Certificate, sealed and verifiable on the VaultChain™.
        </p>
      </section>

      {/* Directory */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(120,148,255,0.25)",
          background: "rgba(9,16,34,0.85)",
          padding: "1.25rem",
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search by partner name, alignment ID, or TARI reference…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(120,148,255,0.3)",
            borderRadius: 6,
            color: "rgba(238,244,255,0.9)",
            fontFamily: MONO,
            fontSize: "0.85rem",
            padding: "0.65rem 1rem",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "1.25rem",
          }}
        />

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              color: "rgba(238,244,255,0.4)",
              fontFamily: MONO,
              fontSize: "0.85rem",
            }}
          >
            ⏳ Loading Sovereign Partner Directory…
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              color: "#f87171",
              fontFamily: MONO,
              fontSize: "0.85rem",
            }}
          >
            ⚠️ {error}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              color: "rgba(238,244,255,0.3)",
              fontFamily: MONO,
              fontSize: "0.85rem",
            }}
          >
            {filter
              ? "No partners match your search."
              : "No aligned partners found. Become the first — obtain a TARI™ alignment certificate."}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "1rem",
            }}
          >
            {filtered.map((p) => (
              <PartnerCard key={p.partner_id} partner={p} />
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: "1rem",
            fontFamily: MONO,
            fontSize: "0.65rem",
            color: "rgba(120,148,255,0.35)",
            textAlign: "right",
          }}
        >
          {!loading && !error && `${filtered.length} of ${partners.length} aligned partner${partners.length !== 1 ? "s" : ""} · refreshes every 30s`}
        </div>
      </section>

      {/* CTA */}
      <section
        className="card"
        style={{
          border: "1px solid rgba(120,148,255,0.18)",
          background: "rgba(9,16,34,0.7)",
          padding: "1.25rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "rgba(238,244,255,0.6)",
            fontFamily: MONO,
            fontSize: "0.8rem",
            marginBottom: "1rem",
          }}
        >
          All entities using AveryOS™ IP must hold a valid Sovereign Alignment
          Certificate. Join the directory.
        </p>
        <Link href="/license" className="primary-link">
          🛡️ Obtain Alignment Certificate →
        </Link>
      </section>


    </main>
  );
}
