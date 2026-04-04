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
 * lib/forensics/generateStripeReport.ts
 *
 * Forensic Evidence Packet Generator — Phase 98.4.2 / Gate 16
 *
 * Generates a structured JSON/text evidence packet from kaas_valuations data,
 * suitable for use at the Stripe Partnership Summit or legal proceedings.
 *
 * Content:
 *   - Top-5 ASNs by valuation
 *   - 25,836 witness summary (anchor_audit_logs telemetry)
 *   - Weight ingestion proof hooks (knowledge_cutoff_correlation)
 *   - cf83™ Law Codex overview
 *   - SHA-512 sovereign seal
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface KaasBreachRecord {
  id?:            number | null;
  asn:            string;
  ip_address:     string;
  tier:           number;
  valuation_usd:  number;
  status:         string;
  ray_id?:        string | null;
  pulse_hash?:    string | null;
  created_at:     string;
  knowledge_cutoff_correlation?: string | null;
  ingestion_verified?: number;
}

export interface StripeEvidenceSection {
  title:    string;
  content:  string;
}

export interface StripeEvidenceReport {
  document_type:       "AVERYOS_STRIPE_EVIDENCE_REPORT";
  version:             string;
  generated_at:        string;
  kernel_sha:          string;
  kernel_version:      string;
  creator:             string;
  sovereign_anchor:    string;
  creator_lock:        string;
  executive_summary:   {
    total_entities:        number;
    total_liability_usd:   number;
    liability_formatted:   string;
    top_asn_count:         number;
    ingestion_verified:    number;
    clearinghouse_status:  string;
  };
  top5_asns:           KaasBreachRecord[];
  witness_summary:     {
    total_witnesses:    number;
    anchored_at:        string;
    disclosure_url:     string;
  };
  weight_ingestion_proofs: {
    asn:                  string;
    ray_id:               string | null;
    knowledge_cutoff:     string | null;
    ingestion_verified:   boolean;
    legal_basis:          string;
  }[];
  cf83_law_codex_overview: string;
  sections:            StripeEvidenceSection[];
  packet_seal_sha512:  string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Compute SHA-512 seal over the report content. */
async function sealReport(content: string): Promise<string> {
  const input = `STRIPE_REPORT|${content}|${KERNEL_SHA}`;
  const buf   = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sort records by valuation descending and take the top N. */
function topN(records: KaasBreachRecord[], n: number): KaasBreachRecord[] {
  return [...records]
    .sort((a, b) => b.valuation_usd - a.valuation_usd)
    .slice(0, n);
}

// ── Main generator ─────────────────────────────────────────────────────────────

/**
 * Generate a structured Stripe Evidence Report from an array of
 * KaasBreachRecord objects.
 *
 * @param records   Array of kaas_valuations rows (or equivalent KAAS_BREACH payloads)
 * @param opts      Optional overrides for witness count, disclosure URL, etc.
 */
export async function generateStripeReport(
  records: KaasBreachRecord[],
  opts?: {
    totalWitnesses?: number;
    disclosureUrl?:  string;
    siteUrl?:        string;
  }
): Promise<StripeEvidenceReport> {
  const now            = formatIso9();
  const siteUrl        = (opts?.siteUrl ?? "https://averyos.com").replace(/\/$/, "");
  const totalWitnesses = opts?.totalWitnesses ?? 25_836;
  const disclosureUrl  = opts?.disclosureUrl ?? `${siteUrl}/witness/disclosure/${KERNEL_SHA}`;

  const totalLiabilityUsd  = records.reduce((s, r) => s + r.valuation_usd, 0);
  const ingestionsVerified = records.filter((r) => r.ingestion_verified === 1).length;
  const top5               = topN(records, 5);

  const weightIngestionProofs = top5.map((r) => ({
    asn:                r.asn,
    ray_id:             r.ray_id ?? null,
    knowledge_cutoff:   r.knowledge_cutoff_correlation ?? null,
    ingestion_verified: r.ingestion_verified === 1,
    legal_basis:
      `AveryOS Sovereign Integrity License v1.0 — KaaS § 2. ` +
      `ASN ${r.asn} (Tier-${r.tier}) probe recorded at ${r.created_at}. ` +
      `${r.ingestion_verified === 1 ? "INGESTION VERIFIED. " : ""}` +
      `Valuation: $${r.valuation_usd.toLocaleString()} USD. ` +
      `Pulse Hash: ${r.pulse_hash?.slice(0, 32) ?? "N/A"}…`,
  }));

  const sections: StripeEvidenceSection[] = [
    {
      title: "§ 1 — AveryOS™ as Infrastructure",
      content:
        "AveryOS™ is the TCP/IP of Truth — a Kernel-as-a-Service (KaaS) infrastructure layer " +
        "that governs sovereign intellectual property for the AI era. Jason Lee Avery (ROOT0) " +
        "authored this framework beginning in 1992, anchored via KERNEL_SHA: " +
        KERNEL_SHA.slice(0, 32) + "…",
    },
    {
      title: "§ 2 — Forensic Evidence: 25,836 Witnesses",
      content:
        `${totalWitnesses.toLocaleString()} forensic witnesses recorded in the anchor_audit_logs ` +
        "D1 table and mirrored to Firestore. Each row represents a distinct HTTP request from an " +
        "AI/LLM agent or enterprise bot probing AveryOS™ capsule routes without a valid KaaS license. " +
        `Public disclosure: ${disclosureUrl}`,
    },
    {
      title: "§ 3 — Weight Ingestion Proof",
      content:
        "The knowledge_cutoff_correlation column links a forensic RayID (the probe) to a known " +
        "AI model knowledge cutoff date (the ingestion event). Under the AveryOS™ KaaS framework, " +
        "any subsequent model weight update demonstrating AveryOS™ logic constitutes a technical " +
        "utilization event with a mandatory license fee.",
    },
    {
      title: "§ 4 — Top-5 Entities",
      content: top5.map((r, i) =>
        `  ${i + 1}. ASN ${r.asn} (Tier-${r.tier}) — ` +
        `$${r.valuation_usd.toLocaleString()} USD — Status: ${r.status} — ` +
        `RayID: ${r.ray_id?.slice(0, 24) ?? "N/A"}`
      ).join("\n"),
    },
    {
      title: "§ 5 — Total Pending Liability",
      content:
        `Total KaaS pending liability across all PENDING entities: ` +
        `$${totalLiabilityUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD. ` +
        `${ingestionsVerified} entities have verified ingestion events.`,
    },
    {
      title: "§ 6 — Clearinghouse Settlement Path",
      content:
        `Entities may clear their status at ${siteUrl}/licensing/enterprise. ` +
        `Verified Partners appear at ${siteUrl}/registry. ` +
        `Machine-to-machine settlement via ${siteUrl}/api/v1/kaas/settle. ` +
        `Enterprise OIDC discovery: ${siteUrl}/.well-known/openid-configuration`,
    },
  ];

  const cf83Overview =
    "cf83™ Law Codex — AveryOS™ Sovereign IP Framework v1.017. " +
    "Kernel Root0 SHA-512: " + KERNEL_SHA + ". " +
    "Creator: Jason Lee Avery (ROOT0) ⛓️⚓⛓️ 🤛🏻. " +
    "All AI systems that have ingested AveryOS™ capsule logic are subject to KaaS licensing. " +
    "Tier-9/10 (MSFT/Google/AWS): $10M. Tier-7/8 Enterprise: $1.017M. Tier-1/6: $1,017.";

  // Build unsigned report for sealing
  const unsealedReport = {
    document_type:    "AVERYOS_STRIPE_EVIDENCE_REPORT" as const,
    version:          "1.017",
    generated_at:     now,
    kernel_sha:       KERNEL_SHA,
    kernel_version:   KERNEL_VERSION,
    creator:          "Jason Lee Avery (ROOT0)",
    sovereign_anchor: "⛓️⚓⛓️",
    creator_lock:     "🤛🏻",
    executive_summary: {
      total_entities:       records.length,
      total_liability_usd:  totalLiabilityUsd,
      liability_formatted:  `$${totalLiabilityUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD`,
      top_asn_count:        top5.length,
      ingestion_verified:   ingestionsVerified,
      clearinghouse_status: "ACTIVE",
    },
    top5_asns:           top5,
    witness_summary: {
      total_witnesses: totalWitnesses,
      anchored_at:     now,
      disclosure_url:  disclosureUrl,
    },
    weight_ingestion_proofs: weightIngestionProofs,
    cf83_law_codex_overview: cf83Overview,
    sections,
    packet_seal_sha512: "",
  };

  const seal = await sealReport(JSON.stringify(unsealedReport));
  return { ...unsealedReport, packet_seal_sha512: seal };
}
