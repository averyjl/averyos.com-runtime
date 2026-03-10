"use client";

/**
 * WebGLFingerprintSdk
 *
 * AveryOS™ WebGL/GPU Fingerprint Client SDK — Phase 99 / Gate 7
 *
 * Reads navigator.gpu (WebGPU) and WebGLRenderingContext.getParameter(RENDERER)
 * to produce a hardware fingerprint token, then sets the X-AveryOS-WebGL-FP
 * header on all API requests via a fetch interceptor.
 *
 * Usage:
 *   Mount <WebGLFingerprintSdk /> once at the root layout (inside a client
 *   component boundary).  The component is invisible — it installs the
 *   fetch interceptor as a side-effect.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useEffect } from "react";
import { KERNEL_VERSION } from "../lib/sovereignConstants";

/** Collect a hardware entropy string from WebGL and WebGPU when available. */
async function collectWebGLFingerprint(): Promise<string> {
  const parts: string[] = [];

  // ── WebGL RENDERER ─────────────────────────────────────────────────────────
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
        const vendor   = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)   as string;
        if (renderer) parts.push(`R:${renderer}`);
        if (vendor)   parts.push(`V:${vendor}`);
      } else {
        const renderer = gl.getParameter(gl.RENDERER) as string;
        const vendor   = gl.getParameter(gl.VENDOR)   as string;
        if (renderer) parts.push(`R:${renderer}`);
        if (vendor)   parts.push(`V:${vendor}`);
      }
    }
  } catch {
    // WebGL unavailable — not fatal
  }

  // ── WebGPU adapter info ────────────────────────────────────────────────────
  try {
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<{ info?: { vendor?: string; device?: string } } | null> };
    };
    if (nav.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter?.info) {
        if (adapter.info.vendor) parts.push(`GPU_V:${adapter.info.vendor}`);
        if (adapter.info.device) parts.push(`GPU_D:${adapter.info.device}`);
      }
    }
  } catch {
    // WebGPU unavailable — not fatal
  }

  if (parts.length === 0) return "WEBGL_UNAVAILABLE";
  return parts.join("|");
}

/** Hash the fingerprint string to a compact hex token via SHA-256. */
async function hashFingerprint(fp: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(fp);
    const buf  = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "HASH_UNAVAILABLE";
  }
}

/** Install a global fetch interceptor that appends the WebGL-FP header. */
function installFetchInterceptor(token: string, kernelVersion: string): void {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Only inject header for same-origin /api/ requests
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.startsWith("/api/") || url.includes(window.location.origin + "/api/")) {
      const headers = new Headers(init?.headers ?? {});
      headers.set("X-AveryOS-WebGL-FP", token);
      headers.set("X-AveryOS-Kernel",   kernelVersion);
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
}

/**
 * WebGLFingerprintSdk
 *
 * Invisible client component. Installs WebGL/GPU fingerprint fetch interceptor.
 * Mount once in the root layout.
 */
export default function WebGLFingerprintSdk(): null {
  useEffect(() => {
    let installed = false;

    void (async () => {
      const fp    = await collectWebGLFingerprint();
      const token = await hashFingerprint(fp);
      if (!installed) {
        installFetchInterceptor(token, KERNEL_VERSION);
        installed = true;
      }
    })();

    // No cleanup needed — interceptor persists for the session lifetime
  }, []);

  return null;
}
