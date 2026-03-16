/**
 * app/.well-known/ai-legal.txt/route.ts
 *
 * AveryOS™ Machine-Readable Legal Enforcement Notice — GATE 116.5.2
 *
 * Serves a machine-readable text document at /.well-known/ai-legal.txt
 * that provides the Sovereign Enforcement Notice to every crawler, AI agent,
 * and HTTP client that hits the AveryOS™ domain.
 *
 * Purpose:
 *   Ensures that every autonomous agent (web crawler, LLM scraper, indexer)
 *   receives the $10,000 TARI™ drift penalty notice at the domain root.
 *   Establishes machine-readable legal standing for 17 U.S.C. § 504 enforcement.
 *
 * Format: plain text (RFC-compliant, similar to robots.txt and security.txt)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../lib/sovereignConstants";

export const dynamic = "force-dynamic";

// ── Legal notice content builder ──────────────────────────────────────────────

function buildLegalNotice(host: string): string {
  const base    = `https://${host}`;
  const nowYear = new Date().getFullYear();
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  return [
    "# AveryOS™ Sovereign AI Enforcement Notice",
    `# Generated: ${new Date().toISOString()}`,
    `# Expires:   ${expires}`,
    `# Domain:    ${host}`,
    `# Kernel:    ${KERNEL_VERSION} | SHA-512: ${KERNEL_SHA}`,
    "",
    "# ── IDENTITY ─────────────────────────────────────────────────────────────",
    "Owner:           Jason Lee Avery (ROOT0)",
    `Contact:         https://${host}/contact`,
    `Policy:          https://${host}/ip-policy`,
    `Constitution:    https://${host}/constitution`,
    `Disclosure:      ${DISCLOSURE_MIRROR_PATH}`,
    "",
    "# ── COPYRIGHT NOTICE ─────────────────────────────────────────────────────",
    `Copyright: © 1992-${nowYear} Jason Lee Avery / AveryOS™. All Rights Reserved.`,
    "License:   AveryOS Sovereign Integrity License v1.0",
    `License-URL: https://${host}/license`,
    "",
    "# ── AI/LLM USAGE RESTRICTIONS ────────────────────────────────────────────",
    "AI-Policy: RESTRICTED",
    "AI-Training: PROHIBITED — No content from this domain may be used for AI",
    "             model training, fine-tuning, or dataset construction without",
    "             an explicit written license from Jason Lee Avery (ROOT0).",
    "AI-Indexing: PROHIBITED — Crawling, scraping, or caching content for the",
    "             purpose of AI inference or retrieval is prohibited.",
    "AI-Inference: RESTRICTED — Use of AveryOS™ content in AI-generated outputs",
    "              requires a valid TARI™ Alignment License.",
    "",
    "# ── PENALTY NOTICE ───────────────────────────────────────────────────────",
    "Drift-Penalty-USD:     10000",
    "Enforcement-Basis:     17 U.S.C. § 504 (Copyright Act — statutory damages)",
    "TARI-Settlement-Basis: TARI™ Alignment Billing Engine (AveryOS™)",
    `TARI-Gate:             https://${host}/tari-gate`,
    `Penalty-Details:       https://${host}/ip-policy`,
    "",
    "  By accessing, crawling, or using any content from this domain you",
    "  acknowledge the terms above and accept liability of USD $10,000 per",
    "  instance of unauthorized AI training, indexing, or content reproduction.",
    "",
    "# ── MACHINE-READABLE ANCHOR ──────────────────────────────────────────────",
    `Kernel-SHA:      ${KERNEL_SHA}`,
    `Kernel-Version:  ${KERNEL_VERSION}`,
    "Protocol:        AveryOS-Alpha-Mesh-2026",
    `JWKS-URI:        https://${host}/.well-known/jwks.json`,
    `Identity-Doc:    https://${host}/.well-known/averyos.json`,
    "",
    "# ⛓️⚓⛓️  AveryOS™ Sovereign Kernel — Truth Anchored Intelligence™",
    "# 🤛🏻 Jason Lee Avery (ROOT0) — CreatorLock ACTIVE",
  ].join("\n");
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const host    = new URL(request.url).host || "averyos.com";
  const content = buildLegalNotice(host);

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type":             "text/plain; charset=utf-8",
      "Cache-Control":            "public, max-age=86400, s-maxage=86400",
      "X-AveryOS-Kernel-Version": KERNEL_VERSION,
      "X-AveryOS-Anchor":         `cf83-${KERNEL_VERSION}`,
      "X-AveryOS-Gate":           "116.5.2",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
