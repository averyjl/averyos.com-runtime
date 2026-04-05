/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * lib/cloudflareTypes.ts
 *
 * AveryOS™ Shared Cloudflare Binding Types — PERMANENT UPGRADE (0% Duplication)
 *
 * Canonical minimal type interfaces for Cloudflare Workers bindings used across
 * all App Router route handlers. Import from here instead of re-declaring these
 * interfaces per-file.
 *
 * Root cause of the code duplication: every route file was independently
 * defining `D1Database`, `D1PreparedStatement`, `KVNamespace`, and
 * `CloudflareEnv`. With 124 route handlers, that produced 268+ duplicated
 * interface blocks — the primary trigger of the SonarCloud CPD gate failures.
 *
 * Design:
 *   - `D1PreparedStatement` / `D1Database` / `KVNamespace` cover the full
 *     Cloudflare binding surface used by this project.
 *   - `BaseCfEnv` declares every binding present in wrangler.toml so routes can
 *     compose their own minimal env shape via Pick<BaseCfEnv, 'DB' | 'AVERY_KV'>
 *     (or just use BaseCfEnv directly).
 *   - Do NOT import `@cloudflare/workers-types` — use these minimal interfaces
 *     as documented in CLAUDE.md and lib/storageUtils.ts.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── D1 binding types ───────────────────────────────────────────────────────────

/** Bound result of a `.prepare().bind(...)` call. */
export interface D1BoundStatement {
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
  first<T = unknown>(): Promise<T | null>;
}

/**
 * Result of `.prepare(sql)`.
 *
 * D1 supports two usage patterns:
 *   1. With binding:  db.prepare(sql).bind(arg).run()
 *   2. Direct:        db.prepare(sql).all()  or  db.prepare(sql).first()
 *
 * Both are valid; this interface covers both.
 */
export interface D1PreparedStatement {
  /** Bind arguments and return a statement ready to execute. */
  bind(...args: unknown[]): D1BoundStatement;
  /** Execute directly (no parameters). */
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
  first<T = unknown>(): Promise<T | null>;
}

/** Minimal D1Database interface (sufficient for all AveryOS™ route handlers). */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  /** Execute raw SQL without parameters — use only for schema/migration calls. */
  exec(query: string): Promise<{ count: number; duration: number }>;
}

// ── KV binding types ───────────────────────────────────────────────────────────

/** Minimal Cloudflare KV Namespace interface. */
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  get(key: string, options: { type: "arrayBuffer" }): Promise<ArrayBuffer | null>;
  get(key: string, options: { type: "text" }): Promise<string | null>;
  put(key: string, value: string | ArrayBuffer): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

// ── Base Cloudflare environment shape ──────────────────────────────────────────

/**
 * All Cloudflare bindings declared in wrangler.toml for this project.
 *
 * Routes should use `Pick<BaseCfEnv, 'DB'>` (or similar) to document exactly
 * which bindings they depend on, rather than importing the entire env.
 * Using BaseCfEnv directly is acceptable when a route uses several bindings.
 */
export interface BaseCfEnv {
  /** D1 database — primary sovereign data store. */
  DB?: D1Database;
  /** Cloudflare KV — AveryOS™ general KV store. */
  AVERY_KV?: KVNamespace;
  /** Cloudflare KV — log storage. */
  KV_LOGS?: KVNamespace;
  /** Cloudflare R2 — Capsule vault storage. Typed via lib/storageUtils.ts. */
  VAULT?: unknown;
  /** Stripe secret key. */
  STRIPE_SECRET_KEY?: string;
  /** Stripe webhook secret. */
  STRIPE_WEBHOOK_SECRET?: string;
  /** GitHub PAT for version-control operations. */
  GITHUB_PAT?: string;
  /** GitHub repository owner. */
  GITHUB_REPO_OWNER?: string;
  /** GitHub repository name. */
  GITHUB_REPO_NAME?: string;
  /** GitHub registry path. */
  GITHUB_REGISTRY_PATH?: string;
  /** Admin passphrase for Creator-approval workflows. */
  VAULT_PASSPHRASE?: string;
  /** Blockchain API key. */
  BLOCKCHAIN_API_KEY?: string;
  /** External API key for AI/ML services. */
  AI_API_KEY?: string;
}
