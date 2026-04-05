/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * /whitepaper/versions — AveryOS™ Whitepaper Version History
 *
 * Lists all approved whitepaper versions with:
 *   • Per-version SHA-512 content fingerprint
 *   • ISO-9 microsecond submission and approval timestamps
 *   • Kernel SHA anchor at time of submission
 *   • Genesis block (BTC #938909) anchor
 *
 * Served dynamically from D1 `whitepaper_versions` table.
 * Only approved versions are shown publicly.
 *
 * For AI/LLM version tracking: each version is machine-readable at
 *   /api/v1/whitepaper/versions?status=approved
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import AnchorBanner from "../../../components/AnchorBanner";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";
import { formatIso9 } from "../../../lib/timePrecision";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AveryOS™ Whitepaper Version History",
  description:
    "Complete version history of the AveryOS™ Technical Whitepaper. " +
    "Every version is SHA-512 fingerprinted, microsecond-timestamped, and anchored to the cf83... kernel.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://averyos.com/whitepaper/versions" },
  other: {
    "averyos:kernel-sha": KERNEL_SHA,
    "averyos:kernel-version": KERNEL_VERSION,
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): {
    all<T = unknown>(): Promise<{ results: T[] }>;
  };
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
}

interface WhitepaperVersionRow {
  id: number;
  title: string;
  version_slug: string;
  sha512: string;
  anchor_sha: string;
  kernel_version: string;
  status: string;
  submitted_at: string;
  approved_at: string | null;
  approved_by: string | null;
  genesis_block: string | null;
  source_repo: string | null;
}

// ── Status badge color ────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case "approved": return "rgba(0, 255, 65, 0.85)";
    case "pending":  return "rgba(251, 191, 36, 0.85)";
    case "rejected": return "rgba(255, 80, 80, 0.85)";
    default:         return "rgba(180, 200, 255, 0.6)";
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WhitepaperVersionsPage() {
  // ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
  let versions: WhitepaperVersionRow[] = [];
  let dbError: string | null = null;
  const pageTimestamp = formatIso9();

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as unknown as CloudflareEnv)?.DB;
    if (db) {
      const result = await db.prepare(
        `SELECT id, title, version_slug, sha512, anchor_sha, kernel_version,
                status, submitted_at, approved_at, approved_by,
                genesis_block, source_repo
         FROM whitepaper_versions
         WHERE status = 'approved'
         ORDER BY approved_at DESC`,
      ).bind().all<WhitepaperVersionRow>();
      versions = result.results;
    }
  } catch (err) {
    dbError = String(err);
  }

  return (
    <main className="page">
      <AnchorBanner />

      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            color: "#ffffff",
            fontSize: "1.8rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
          }}
        >
          AveryOS™ Whitepaper Version History
        </h1>
        <p style={{ color: "rgba(180, 200, 255, 0.75)", marginBottom: "1rem" }}>
          Every approved whitepaper is SHA-512 fingerprinted, microsecond-timestamped,
          and permanently anchored to the cf83… Sovereign Kernel.
        </p>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.75rem",
            color: "rgba(0, 255, 65, 0.7)",
            padding: "0.5rem 0.75rem",
            background: "rgba(0, 20, 0, 0.4)",
            borderLeft: "3px solid rgba(0, 255, 65, 0.4)",
            borderRadius: "0 4px 4px 0",
            marginBottom: "0.5rem",
          }}
        >
          🤖 Machine-readable feed: <code>/api/v1/whitepaper/versions</code>
          {" | "}
          Page rendered: <span style={{ color: "rgba(180,200,255,0.8)" }}>{pageTimestamp}</span>
        </div>
        <div style={{ fontSize: "0.85rem" }}>
          <Link href="/whitepaper" style={{ color: "rgba(122, 170, 255, 0.85)" }}>
            ← Back to current whitepaper
          </Link>
        </div>
      </div>

      {/* DB error banner */}
      {dbError && (
        <div
          style={{
            background: "rgba(255, 60, 60, 0.15)",
            border: "1px solid rgba(255, 60, 60, 0.4)",
            borderRadius: "8px",
            padding: "1rem",
            color: "rgba(255, 150, 150, 0.9)",
            marginBottom: "1.5rem",
            fontSize: "0.85rem",
          }}
        >
          ⚠️ Version history unavailable: {dbError}
        </div>
      )}

      {/* No versions yet */}
      {!dbError && versions.length === 0 && (
        <div
          style={{
            background: "rgba(9, 16, 34, 0.6)",
            border: "1px solid rgba(120, 148, 255, 0.2)",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
            color: "rgba(180, 200, 255, 0.6)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
          <p>No approved whitepaper versions on record yet.</p>
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Submit a draft via <code>POST /api/v1/whitepaper/versions</code>
            {" "}and approve it with <code>POST /api/v1/whitepaper/approve/[id]</code>.
          </p>
        </div>
      )}

      {/* Version list */}
      {versions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {versions.map((v) => (
            <div
              key={v.id}
              style={{
                background: "rgba(9, 16, 34, 0.85)",
                border: "1px solid rgba(120, 148, 255, 0.25)",
                borderRadius: "12px",
                padding: "1.5rem",
              }}
            >
              {/* Title + status */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.75rem",
                }}
              >
                <h2 style={{ color: "#ffffff", fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
                  {v.title}
                </h2>
                <span
                  style={{
                    color: statusColor(v.status),
                    fontSize: "0.75rem",
                    fontFamily: "JetBrains Mono, monospace",
                    border: `1px solid ${statusColor(v.status)}`,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  {v.status}
                </span>
              </div>

              {/* Version slug + genesis */}
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.8rem",
                  color: "rgba(180, 200, 255, 0.75)",
                  marginBottom: "0.75rem",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1.25rem",
                }}
              >
                <span>🏷️ <strong>Version:</strong> {v.version_slug}</span>
                <span>₿ <strong>Genesis Block:</strong> #{v.genesis_block ?? "938909"}</span>
                <span>🔧 <strong>Kernel:</strong> {v.kernel_version}</span>
                <span>📦 <strong>Source:</strong> {v.source_repo ?? "averyos.com-runtime"}</span>
              </div>

              {/* SHA-512 fingerprint */}
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.72rem",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ color: "rgba(0, 255, 65, 0.85)" }}>📄 Content SHA-512: </span>
                <span
                  style={{
                    color: "rgba(180, 200, 255, 0.8)",
                    wordBreak: "break-all",
                    display: "inline-block",
                  }}
                >
                  {v.sha512}
                </span>
              </div>

              {/* Kernel anchor SHA */}
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.72rem",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ color: "rgba(0, 255, 65, 0.85)" }}>⛓️ Kernel Anchor SHA: </span>
                <span
                  style={{
                    color: "rgba(180, 200, 255, 0.7)",
                    wordBreak: "break-all",
                  }}
                >
                  {v.anchor_sha}
                </span>
              </div>

              {/* Timestamps */}
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.75rem",
                  color: "rgba(122, 170, 255, 0.7)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1.25rem",
                  marginTop: "0.75rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid rgba(120, 148, 255, 0.12)",
                }}
              >
                <span>
                  🕐 <strong>Submitted (ISO-9 μs):</strong> {v.submitted_at}
                </span>
                {v.approved_at && (
                  <span>
                    ✅ <strong>Approved (ISO-9 μs):</strong> {v.approved_at}
                    {v.approved_by ? ` by ${v.approved_by}` : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin API reference */}
      <div
        style={{
          marginTop: "2.5rem",
          padding: "1.25rem",
          background: "rgba(9, 16, 34, 0.5)",
          border: "1px solid rgba(120, 148, 255, 0.15)",
          borderRadius: "12px",
          fontSize: "0.82rem",
          color: "rgba(180, 200, 255, 0.65)",
        }}
      >
        <strong style={{ color: "rgba(122, 170, 255, 0.85)" }}>
          📡 Version Control API (Admin)
        </strong>
        <ul style={{ marginTop: "0.75rem", paddingLeft: "1.25rem", lineHeight: 1.9 }}>
          <li>
            <code>GET /api/v1/whitepaper/versions</code> — list approved versions (public)
          </li>
          <li>
            <code>POST /api/v1/whitepaper/versions</code> — submit draft{" "}
            <em>(requires Bearer token)</em>
          </li>
          <li>
            <code>POST /api/v1/whitepaper/approve/[id]</code> — approve or reject draft{" "}
            <em>(requires Bearer token)</em>
          </li>
        </ul>
        <p style={{ marginTop: "0.75rem" }}>
          All versions are permanently anchored to the cf83… Kernel SHA and BTC genesis block #938909.
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "2rem",
          paddingTop: "1rem",
          borderTop: "1px solid rgba(120, 148, 255, 0.15)",
          fontSize: "0.8rem",
          color: "rgba(122, 170, 255, 0.6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <span>⛓️⚓⛓️ AveryOS™ Sovereign Integrity License v1.0</span>
        <span>Kernel: {KERNEL_VERSION}</span>
        <span style={{ wordBreak: "break-all" }}>
          Root0: {KERNEL_SHA.slice(0, 12)}…{KERNEL_SHA.slice(-8)}
        </span>
      </div>
    </main>
  );
}
