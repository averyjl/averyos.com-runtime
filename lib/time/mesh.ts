/**
 * lib/time/mesh.ts
 *
 * AveryOS™ Stratum-Zero Time Mesh — Phase 108.1
 *
 * Implements a consensus-based time anchor by polling 10 authoritative NTP
 * sources in parallel, discarding outliers beyond ±17 ms of the median, and
 * returning a SHA-512 anchored average timestamp.
 *
 * Architecture:
 *   1. Poll 10 sources (NIST, Google, Cloudflare, etc.) via HTTP HEAD/GET.
 *   2. Extract server-side timestamps from Date response headers.
 *   3. Compute median of all successful responses.
 *   4. Discard any source whose timestamp differs from the median by > 17 ms.
 *   5. Average the remaining (consensus) timestamps.
 *   6. SHA-512 anchor the result.
 *   7. Optionally persist to D1 sovereign_time_log and VaultChain.
 *
 * The 17-microsecond outlier threshold is intentionally conservative:
 * any source drifting more than 17 ms from consensus is classified as
 * "Outlier/Malicious" and excluded from the average.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Outlier rejection threshold in milliseconds. Sources beyond ±17 ms of the
 *  consensus median are discarded as malicious or drifted. */
export const OUTLIER_THRESHOLD_MS = 17;

/** Number of authoritative NTP-over-HTTP sources polled per consensus round. */
export const NTP_SOURCE_COUNT = 10;

/** Timeout per individual source request in milliseconds. */
const FETCH_TIMEOUT_MS = 4_000;

// ── NTP Source Definitions ────────────────────────────────────────────────────

export interface NtpSource {
  name: string;
  url: string;
}

/**
 * 10 authoritative time sources.
 * Timestamps are extracted from the HTTP `Date` response header.
 */
export const NTP_SOURCES: NtpSource[] = [
  { name: "NIST",        url: "https://time.nist.gov/" },
  { name: "Google",      url: "https://www.google.com" },
  { name: "Cloudflare",  url: "https://www.cloudflare.com" },
  { name: "Amazon",      url: "https://aws.amazon.com" },
  { name: "Microsoft",   url: "https://www.microsoft.com" },
  { name: "Apple",       url: "https://www.apple.com" },
  { name: "Akamai",      url: "https://www.akamai.com" },
  { name: "Fastly",      url: "https://www.fastly.com" },
  { name: "GitHub",      url: "https://github.com" },
  { name: "npm",         url: "https://registry.npmjs.org" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeProbe {
  source: string;
  url: string;
  timestampMs: number;
  iso: string;
  status: "ok" | "error" | "outlier";
  errorMessage?: string;
}

export interface SovereignTimeResult {
  /** ISO-9 consensus timestamp (9 fractional-second digits). */
  consensusIso9: string;
  /** Consensus timestamp as Unix milliseconds. */
  consensusMs: number;
  /** SHA-512 of the consensus ISO string + KERNEL_SHA. */
  sha512: string;
  /** Number of sources that contributed to the consensus. */
  consensusSourceCount: number;
  /** All probes including outliers and errors. */
  probes: TimeProbe[];
  /** Probes that were rejected as outliers. */
  outliers: TimeProbe[];
  /** AveryOS™ kernel anchor. */
  kernelSha: string;
  kernelVersion: string;
}

// ── D1 / VaultChain persist interfaces ────────────────────────────────────────

export interface SovereignTimeD1Row {
  consensus_iso9: string;
  consensus_ms: number;
  sha512: string;
  source_count: number;
  outlier_count: number;
  kernel_sha: string;
  kernel_version: string;
  created_at: string;
}

export interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
}

export interface D1DatabaseMinimal {
  prepare(sql: string): D1PreparedStatement;
}

export interface VaultChainMinimal {
  put(key: string, value: string): Promise<void>;
}

// ── Utility: SHA-512 via Web Crypto ──────────────────────────────────────────

async function sha512Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-512", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Core: Poll a single NTP source ────────────────────────────────────────────

async function probeSource(source: NtpSource): Promise<TimeProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(source.url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);

    const dateHeader = resp.headers.get("date");
    if (!dateHeader) {
      return {
        source: source.name,
        url: source.url,
        timestampMs: 0,
        iso: "",
        status: "error",
        errorMessage: "No Date header in response",
      };
    }

    const timestampMs = new Date(dateHeader).getTime();
    if (Number.isNaN(timestampMs)) {
      return {
        source: source.name,
        url: source.url,
        timestampMs: 0,
        iso: "",
        status: "error",
        errorMessage: `Unparseable Date header: ${dateHeader}`,
      };
    }

    return {
      source: source.name,
      url: source.url,
      timestampMs,
      iso: new Date(timestampMs).toISOString(),
      status: "ok",
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    return {
      source: source.name,
      url: source.url,
      timestampMs: 0,
      iso: "",
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Core: Median of an array of numbers ──────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Main: getSovereignTime ────────────────────────────────────────────────────

/**
 * Poll all 10 NTP sources in parallel, reject outliers beyond ±17 ms of the
 * median, and return a SHA-512 anchored consensus timestamp.
 *
 * @param db           Optional D1 database — when provided, the result is
 *                     persisted to `sovereign_time_log`.
 * @param vaultChain   Optional R2/KV VaultChain binding — when provided, the
 *                     anchored result is written under
 *                     `vaultchain/sovereign-time/<consensusMs>.json`.
 */
export async function getSovereignTime(
  db?: D1DatabaseMinimal | null,
  vaultChain?: VaultChainMinimal | null,
): Promise<SovereignTimeResult> {
  // 1. Poll all sources in parallel
  const allProbes = await Promise.all(NTP_SOURCES.map(probeSource));

  // 2. Filter successful probes
  const successfulProbes = allProbes.filter((p) => p.status === "ok");

  // 3. Fallback: if all sources failed, use local system time
  if (successfulProbes.length === 0) {
    const nowMs = Date.now();
    const nowIso = formatIso9(new Date(nowMs));
    const sha512 = await sha512Hex(`${nowIso}|${KERNEL_SHA}`);

    const result: SovereignTimeResult = {
      consensusIso9: nowIso,
      consensusMs: nowMs,
      sha512,
      consensusSourceCount: 0,
      probes: allProbes,
      outliers: [],
      kernelSha: KERNEL_SHA,
      kernelVersion: KERNEL_VERSION,
    };

    await persistResult(result, db, vaultChain);
    return result;
  }

  // 4. Compute median of successful probe timestamps
  const successfulMs = successfulProbes.map((p) => p.timestampMs);
  const medianMs = median(successfulMs);

  // 5. Reject outliers beyond ±17 ms of the median
  const consensusProbes: TimeProbe[] = [];
  const outliers: TimeProbe[] = [];

  for (const probe of successfulProbes) {
    const delta = Math.abs(probe.timestampMs - medianMs);
    if (delta <= OUTLIER_THRESHOLD_MS) {
      consensusProbes.push(probe);
    } else {
      outliers.push({ ...probe, status: "outlier" });
    }
  }

  // 6. Average consensus timestamps (fallback to median if all rejected)
  const pool = consensusProbes.length > 0 ? consensusProbes : successfulProbes;
  const avgMs = Math.round(
    pool.reduce((sum, p) => sum + p.timestampMs, 0) / pool.length,
  );

  const consensusIso9 = formatIso9(new Date(avgMs));

  // 7. SHA-512 anchor
  const sha512 = await sha512Hex(`${consensusIso9}|${KERNEL_SHA}`);

  // 8. Merge outlier status back into full probe list
  const outlierNames = new Set(outliers.map((o) => o.source));
  const annotatedProbes: TimeProbe[] = allProbes.map((p) =>
    outlierNames.has(p.source) ? { ...p, status: "outlier" as const } : p,
  );

  const result: SovereignTimeResult = {
    consensusIso9,
    consensusMs: avgMs,
    sha512,
    consensusSourceCount: pool.length,
    probes: annotatedProbes,
    outliers,
    kernelSha: KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };

  // 9. Persist
  await persistResult(result, db, vaultChain);

  return result;
}

// ── Persist helpers ───────────────────────────────────────────────────────────

async function persistResult(
  result: SovereignTimeResult,
  db?: D1DatabaseMinimal | null,
  vaultChain?: VaultChainMinimal | null,
): Promise<void> {
  const createdAt = formatIso9();

  // D1 persist
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO sovereign_time_log
             (consensus_iso9, consensus_ms, sha512, source_count,
              outlier_count, kernel_sha, kernel_version, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          result.consensusIso9,
          result.consensusMs,
          result.sha512,
          result.consensusSourceCount,
          result.outliers.length,
          KERNEL_SHA,
          KERNEL_VERSION,
          createdAt,
        )
        .run();
    } catch (err: unknown) {
      // Non-blocking — log and continue
      console.warn(
        `[time-mesh] D1 persist failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // VaultChain persist
  if (vaultChain) {
    try {
      const key = `vaultchain/sovereign-time/${result.consensusMs}.json`;
      const payload = JSON.stringify({
        ...result,
        // Strip full probe list from VaultChain to keep payload lean
        probes: undefined,
        stored_at: createdAt,
      });
      await vaultChain.put(key, payload);
    } catch (err: unknown) {
      console.warn(
        `[time-mesh] VaultChain persist failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
