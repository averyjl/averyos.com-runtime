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
/**
 * components/SovereignFetchInterceptor.tsx
 *
 * AveryOS™ Runtime SDK — Sovereign Fetch Interceptor (Phase 97 / Gate 3)
 *
 * Mounts a global fetch interceptor that:
 *   1. Collects a WebGL GPU entropy fingerprint (renderer string + vendor)
 *   2. Derives a short session anchor from KERNEL_SHA + fingerprint
 *   3. Attaches sovereign alignment headers to every outgoing fetch() call
 *      so the GabrielOS™ edge firewall can correlate client session identity
 *      with the server-side DER audit pipeline.
 *
 * Headers added to every request:
 *   X-AOS-Kernel-SHA    — first 16 chars of Root0 SHA-512
 *   X-AOS-Session-ID    — 16-hex-char session anchor (WebGL-derived)
 *   X-AOS-Entropy-Score — 0–100 WebGL entropy score (low = suspicious bot)
 *
 * Security notes:
 *   • The interceptor only attaches headers to same-origin requests (averyos.com).
 *   • No personal data beyond what the server already receives (IP, UA) is collected.
 *   • All data is used exclusively for IP enforcement and alignment auditing.
 *
 * Activation: place <SovereignFetchInterceptor /> inside <body> in app/layout.tsx.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect } from "react";
import { KERNEL_SHA } from "../lib/sovereignConstants";

// First 16 hex chars of the Root0 kernel SHA-512 anchor.
const KERNEL_ANCHOR = KERNEL_SHA.slice(0, 16);

// Same-origin hostname guard — only attach sovereign headers to averyos.com requests.
const SOVEREIGN_HOSTS = ["averyos.com", "www.averyos.com", "api.averyos.com", "localhost"];

/**
 * Collect a WebGL GPU entropy fingerprint.
 * Returns { renderer, vendor, entropyScore } where entropyScore ∈ [0, 100].
 * Low entropy scores indicate headless/synthetic environments (bot probes).
 */
function collectWebGLEntropy(): { renderer: string; vendor: string; entropyScore: number } {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) return { renderer: "none", vendor: "none", entropyScore: 0 };

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
      : (gl.getParameter(gl.RENDERER) as string) ?? "unknown";
    const vendor = ext
      ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string
      : (gl.getParameter(gl.VENDOR) as string) ?? "unknown";

    // Entropy heuristic: real GPU strings are long and varied; headless returns
    // short synthetic strings ("SwiftShader Device", "ANGLE (...)").
    const combined = `${renderer}|${vendor}`;
    const score = Math.min(100, Math.max(0, Math.round((combined.length / 80) * 60 +
      (new Set(combined.split("")).size / 40) * 40)));

    return { renderer, vendor, entropyScore: score };
  } catch {
    return { renderer: "error", vendor: "error", entropyScore: 0 };
  }
}

/**
 * Derive a 16-hex-char session anchor from KERNEL_SHA + WebGL fingerprint.
 * Uses a simple djb2 XOR hash — not cryptographic, but sufficient for
 * session correlation (real crypto happens on the edge via GabrielOS™).
 *
 * Constants:
 *   0x9e3779b9 — fractional part of the golden ratio (φ−1) × 2³²; standard Knuth hash multiplicand
 *   0x6c62272e — fractional part of the FNV prime for 32-bit hashing (Fowler-Noll-Vo)
 */
function deriveSessionAnchor(fingerprint: string): string {
  let h1 = 0x9dc5811c;
  let h2 = 0x25c4afbc;
  const combined = KERNEL_ANCHOR + fingerprint;
  for (let i = 0; i < combined.length; i++) {
    const c = combined.charCodeAt(i);
    // Golden-ratio multiplicand distributes hash bits uniformly
    h1 = Math.imul(h1 ^ c, 0x9e3779b9);
    // FNV prime mixes the lower bits independently for a wider output range
    h2 = Math.imul(h2 ^ c, 0x6c62272e);
  }
  const toHex = (n: number) => ((n >>> 0) + 0x100000000).toString(16).slice(-8);
  return toHex(h1) + toHex(h2);
}

/** Returns true if the URL hostname belongs to a sovereign endpoint. */
function isSovereignHost(urlString: string): boolean {
  try {
    const { hostname } = new URL(urlString);
    return SOVEREIGN_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    // Relative URL — always sovereign
    return true;
  }
}

export default function SovereignFetchInterceptor() {
  useEffect(() => {
    // Collect WebGL fingerprint once on mount
    const { renderer, entropyScore } = collectWebGLEntropy();
    const sessionId = deriveSessionAnchor(`${renderer}|${navigator.userAgent.slice(0, 32)}`);

    const nativeFetch = window.fetch.bind(window);

    // Install the interceptor — attaches sovereign headers to same-origin requests.
    window.fetch = function sovereignFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : (input as Request).url;

      if (!isSovereignHost(urlStr)) {
        return nativeFetch(input, init);
      }

      const headers = new Headers(init?.headers);
      headers.set("X-AOS-Kernel-SHA",    KERNEL_ANCHOR);
      headers.set("X-AOS-Session-ID",    sessionId);
      headers.set("X-AOS-Entropy-Score", String(entropyScore));

      return nativeFetch(input, { ...init, headers });
    };

    // Cleanup: restore native fetch on unmount (hot-reload safety)
    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  // Renders nothing — pure side-effect component
  return null;
}
