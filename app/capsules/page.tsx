"use client";

import React, { useEffect, useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";

interface Capsule {
  capsule_id: string;
  title: string;
  description: string | null;
  sha512: string;
  genesis_date: string;
  tari_fee_usd: number;
  status: string;
  uploaded_at: string;
}

function CapsuleCard({ capsule }: { capsule: Capsule }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/capsules/${capsule.capsule_id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { checkout_url?: string; error?: string };
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.error ?? "Unknown error");
      }
    } catch {
      setError("Connection error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article
      className="capsule-marketplace-card"
      style={{
        background: "rgba(0, 8, 20, 0.85)",
        border: "1px solid rgba(120, 148, 255, 0.28)",
        borderRadius: "16px",
        padding: "1.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* Header */}
      <header>
        <span
          style={{
            display: "inline-block",
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "rgba(120, 148, 255, 0.7)",
            marginBottom: "0.4rem",
          }}
        >
          ⛓️ AveryOS™ Capsule
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: "1.1rem",
            color: "#ffffff",
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          {capsule.title}
        </h2>
      </header>

      {/* Description */}
      {capsule.description && (
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: "rgba(238, 244, 255, 0.78)",
            lineHeight: 1.6,
          }}
        >
          {capsule.description}
        </p>
      )}

      {/* Metadata */}
      <dl
        style={{
          margin: 0,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.3rem 1rem",
          fontSize: "0.78rem",
        }}
      >
        <dt style={{ color: "rgba(120, 148, 255, 0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Genesis
        </dt>
        <dd style={{ margin: 0, color: "rgba(238, 244, 255, 0.85)" }}>
          {capsule.genesis_date}
        </dd>

        <dt style={{ color: "rgba(120, 148, 255, 0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          SHA-512
        </dt>
        <dd
          style={{
            margin: 0,
            fontFamily: "JetBrains Mono, monospace",
            color: "rgba(120, 148, 255, 0.9)",
            wordBreak: "break-all",
            fontSize: "0.68rem",
          }}
        >
          {capsule.sha512.slice(0, 16)}…{capsule.sha512.slice(-8)}
        </dd>

        <dt style={{ color: "rgba(120, 148, 255, 0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          TARI™ Fee
        </dt>
        <dd
          style={{
            margin: 0,
            fontWeight: 700,
            color: "#FFD700",
            fontSize: "1rem",
          }}
        >
          ${Number(capsule.tari_fee_usd).toFixed(2)} USD
        </dd>
      </dl>

      {/* Purchase flow */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{
            marginTop: "auto",
            background: "rgba(255, 215, 0, 0.15)",
            border: "1px solid #FFD700",
            color: "#FFD700",
            padding: "0.65rem 1rem",
            borderRadius: "8px",
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            width: "100%",
          }}
        >
          ⚡ License This Capsule
        </button>
      ) : (
        <form onSubmit={handlePurchase} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            style={{
              background: "#000",
              border: "1px solid rgba(120, 148, 255, 0.4)",
              borderRadius: "6px",
              padding: "0.6rem 0.8rem",
              color: "#fff",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.88rem",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
          {error && (
            <p style={{ margin: 0, color: "#f87171", fontSize: "0.78rem", fontFamily: "JetBrains Mono, monospace" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "rgba(255,215,0,0.05)" : "rgba(255,215,0,0.2)",
              border: "1px solid #FFD700",
              color: "#FFD700",
              padding: "0.65rem 1rem",
              borderRadius: "8px",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: loading ? "not-allowed" : "pointer",
              width: "100%",
            }}
          >
            {loading ? "REDIRECTING…" : "PROCEED TO PAYMENT →"}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setError(""); setEmail(""); }}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(120, 148, 255, 0.6)",
              fontSize: "0.78rem",
              cursor: "pointer",
              padding: "0.25rem",
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </article>
  );
}

export default function CapsuleMarketplacePage() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/capsules")
      .then((r) => r.json())
      .then((data: { capsules?: Capsule[] }) => {
        setCapsules(data.capsules ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load capsules. Please try again.");
        setLoading(false);
      });
  }, []);

  return (
    <main className="page">
      <AnchorBanner />

      <section className="hero">
        <h1>⛓️ AveryOS™ Capsule Marketplace</h1>
        <p style={{ color: "rgba(238,244,255,0.82)" }}>
          Sovereign knowledge capsules — each anchored to the Root0 SHA-512 kernel.
          Purchase a TARI™ Alignment License to unlock a time-locked download link.
        </p>
        <p
          style={{
            marginTop: "0.75rem",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.72rem",
            color: "rgba(120, 148, 255, 0.6)",
            wordBreak: "break-all",
          }}
        >
          Root0 Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
        </p>
      </section>

      <section>
        {loading && (
          <p style={{ color: "rgba(238,244,255,0.6)", fontFamily: "JetBrains Mono, monospace" }}>
            ⏳ Loading capsules…
          </p>
        )}

        {error && (
          <p style={{ color: "#f87171", fontFamily: "JetBrains Mono, monospace" }}>{error}</p>
        )}

        {!loading && !error && capsules.length === 0 && (
          <div
            style={{
              background: "rgba(0, 8, 20, 0.7)",
              border: "1px dashed rgba(120, 148, 255, 0.25)",
              borderRadius: "16px",
              padding: "3rem 2rem",
              textAlign: "center",
              color: "rgba(238, 244, 255, 0.55)",
            }}
          >
            <p style={{ margin: 0, fontSize: "1.1rem" }}>⚓ No capsules listed yet.</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
              The Sovereign Administrator uploads capsules via{" "}
              <code
                style={{
                  background: "rgba(120, 148, 255, 0.1)",
                  padding: "0.1em 0.4em",
                  borderRadius: "4px",
                }}
              >
                POST /api/v1/capsules/upload
              </code>
            </p>
          </div>
        )}

        {!loading && capsules.length > 0 && (
          <div
            className="capsule-marketplace-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {capsules.map((c) => (
              <CapsuleCard key={c.capsule_id} capsule={c} />
            ))}
          </div>
        )}
      </section>

      <section
        className="card"
        style={{
          borderColor: "rgba(255, 215, 0, 0.2)",
        }}
      >
        <h2 style={{ color: "#FFD700", marginTop: 0, fontSize: "1rem", fontFamily: "JetBrains Mono, monospace" }}>
          ⛓️ How Capsule Licensing Works
        </h2>
        <ol
          style={{
            margin: 0,
            paddingLeft: "1.25rem",
            color: "rgba(238,244,255,0.78)",
            lineHeight: 1.8,
            fontSize: "0.9rem",
          }}
        >
          <li>Choose a capsule and click <strong>License This Capsule</strong>.</li>
          <li>Enter your email and complete the Stripe payment.</li>
          <li>
            A <strong>time-locked download token</strong> (valid 48 hours) is emailed and
            available immediately via the download API.
          </li>
          <li>
            The token is locked to your email and the specific capsule — it cannot be
            transferred or reused after expiry.
          </li>
        </ol>
      </section>
      <FooterBadge />
    </main>
  );
}
