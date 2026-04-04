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
 * lib/hooks/useVaultAuth.ts
 *
 * AveryOS™ Sovereign Vault Authentication Hook — permanent reusable pattern.
 *
 * USAGE — drop-in for every admin page:
 *
 *   import { useVaultAuth } from "../../../lib/hooks/useVaultAuth";
 *
 *   const { authed, checking, password, setPassword, authError, handleAuth } =
 *     useVaultAuth();
 *
 *   if (checking || !authed) {
 *     return <AuthGate ... onSubmit={handleAuth} />;
 *   }
 *
 * SECURITY CONTRACT:
 *   • On mount, probes GET /api/v1/vault/auth-check — a dedicated, zero-data
 *     endpoint that only validates the HttpOnly cookie. This replaces the
 *     previous "probe a real API endpoint" anti-pattern that caused unnecessary
 *     data retrieval during auth verification (code-review recommendation,
 *     CodeQL alert #26 follow-up).
 *   • On login, POSTs the raw passphrase to POST /api/v1/vault/auth over HTTPS.
 *     The server validates and responds with Set-Cookie: aos-vault-auth=…;
 *     HttpOnly; Secure; SameSite=Strict.
 *   • The raw passphrase is NEVER stored in sessionStorage, localStorage, or
 *     any browser-accessible storage (CWE-312 / CWE-315 / CWE-359).
 *   • All subsequent API calls must use credentials: "same-origin" so the
 *     browser sends the cookie automatically.
 *
 * DYNAMIC PATTERN:
 *   Any new admin page imports this hook and gets the full auth lifecycle
 *   for free. No manual probe URL wiring. No sessionStorage. No duplication.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { useState, useEffect, useCallback } from "react";

// ── Public interface ──────────────────────────────────────────────────────────

export interface VaultAuthState {
  /** True once the cookie has been validated (user is authenticated). */
  authed:      boolean;
  /** True while the initial cookie-check request is in flight. */
  checking:    boolean;
  /** Controlled input value for the passphrase field. */
  password:    string;
  setPassword: (v: string) => void;
  /** Non-empty string when authentication fails; empty string otherwise. */
  authError:   string;
  /**
   * Submit the current `password` to POST /api/v1/vault/auth.
   * Accepts an optional FormEvent so it can be used directly as a
   * `<form onSubmit>` handler or called imperatively (no argument).
   */
  handleAuth: (e?: React.FormEvent) => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVaultAuth(): VaultAuthState {
  const [authed,    setAuthed]    = useState(false);
  const [checking,  setChecking]  = useState(true);
  const [password,  setPassword]  = useState("");
  const [authError, setAuthError] = useState("");

  // ── On mount: probe the dedicated auth-check endpoint ─────────────────────
  // Uses GET /api/v1/vault/auth-check — returns 200 if the HttpOnly cookie is
  // valid, 401 if absent or invalid. No data is fetched as a side-effect.
  useEffect(() => {
    fetch("/api/v1/vault/auth-check", { credentials: "same-origin" })
      .then(r => {
        if (r.ok) setAuthed(true);
        setChecking(false);
      })
      .catch((err: unknown) => {
        // In development, log the probe failure to aid debugging.
        if (process.env.NODE_ENV === "development") {
          console.warn("[useVaultAuth] auth-check probe failed:", err);
        }
        setChecking(false);
      });
  }, []);

  // ── Login: POST passphrase → server sets HttpOnly cookie ──────────────────
  const handleAuth = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) { setAuthError("Passphrase required."); return; }
    setAuthError("");
    try {
      const res = await fetch("/api/v1/vault/auth", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ token: trimmed }),
      });
      if (res.ok) {
        setAuthed(true);
        setPassword("");
      } else {
        setAuthError("⛔ Invalid passphrase. Access denied.");
      }
    } catch {
      setAuthError("⛔ Auth check failed. Please retry.");
    }
  }, [password]);

  return { authed, checking, password, setPassword, authError, handleAuth };
}
