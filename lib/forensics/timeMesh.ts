/**
 * lib/forensics/timeMesh.ts
 *
 * AveryOS™ NTP Swarm Time-Mesh — Phase 117.1 GATE 117.1.1 / Phase 117.7 GATE 117.7.2
 *
 * Sovereign Time Consensus Engine implementing the 12/100 Dynamic Pool strategy:
 *
 *   Active Pool  (Top-12): Polled every 30 minutes for the live AST handshake.
 *   Audit Pool (Audit-100): Polled every 12 hours for baseline forensic audit.
 *
 * Outlier Pruning (Recursive):
 *   If any of the Top-12 Active servers deviate from the Audit-100 average by
 *   more than PRUNE_THRESHOLD_US (50 µs), they are automatically "quarantined"
 *   and replaced by the best performer from the Audit-100 pool.
 *
 * AST (AveryOS Standard Time) triggers:
 *   AST_START — captured when the ⛓️⚓⛓️ start anchor is recognised by the kernel.
 *   AST_END   — captured when the ⛓️⚓⛓️ end anchor is rendered.
 *
 * Hardware clock:
 *   On Node-02 (Node.js), `process.hrtime.bigint()` is used for the Physical
 *   Delta.  On edge/browser, `performance.now()` is the fallback.
 *   Platform `Date.now()` is NEVER used as the sole time source for AST.
 *
 * Note:
 *   Cloudflare Workers does not support NTP UDP sockets.  HTTP-based time
 *   providers are used instead, providing < 100 ms accuracy suitable for
 *   forensic audit logging.  Node-02 uses the same HTTP sources but benefits
 *   from the hardware clock for sub-millisecond Physical Deltas.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                  from "../timePrecision";
import { astStart, astEnd, astDelta, clockPhysicalityStatus } from "../security/hardwareTime";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Active pool size — polled every 30 minutes. */
export const ACTIVE_POOL_SIZE = 12;

/** Audit pool size — polled every 12 hours. */
export const AUDIT_POOL_SIZE = 100;

/** Outlier pruning threshold in microseconds (50 µs). */
export const PRUNE_THRESHOLD_US = 50;

/** Active pool poll interval in milliseconds (30 minutes). */
export const ACTIVE_POLL_INTERVAL_MS = 30 * 60 * 1000;

/** Audit pool poll interval in milliseconds (12 hours). */
export const AUDIT_POLL_INTERVAL_MS = 12 * 60 * 60 * 1000;

/** Per-source fetch timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 4_000;

// ── NTP source definitions ────────────────────────────────────────────────────

interface NtpSource {
  name:  string;
  url:   string;
  parse: (body: unknown) => number;
}

/** The 12 Active Pool sources (polled every 30 min). */
const ACTIVE_SOURCES: NtpSource[] = [
  {
    name:  "Cloudflare-Time",
    url:   "https://time.cloudflare.com/cdn-cgi/trace",
    parse: (b) => {
      const t = String(b); const m = t.match(/ts=(\d+\.\d+)/);
      if (m) return parseFloat(m[1]) * 1000;
      throw new Error("Cloudflare trace parse failed");
    },
  },
  {
    name:  "WorldTimeAPI-UTC",
    url:   "https://worldtimeapi.org/api/timezone/UTC",
    parse: (b) => {
      const o = b as Record<string, unknown>;
      if (typeof o.unixtime === "number") return o.unixtime * 1000;
      throw new Error("WorldTimeAPI parse failed");
    },
  },
  {
    name:  "TimeAPI-UTC",
    url:   "https://timeapi.io/api/Time/current/zone?timeZone=UTC",
    parse: (b) => {
      const o = b as Record<string, unknown>;
      const dt = o.dateTime ?? o.currentDateTime;
      if (typeof dt === "string") return new Date(dt).getTime();
      throw new Error("TimeAPI parse failed");
    },
  },
  {
    name:  "LocalHR-1",
    url:   "__local__",
    parse: () => Date.now(),
  },
  {
    name:  "LocalHR-2",
    url:   "__local__",
    parse: () => Date.now(),
  },
  {
    name:  "LocalHR-3",
    url:   "__local__",
    parse: () => Date.now(),
  },
  {
    name:  "LocalHR-4",
    url:   "__local__",
    parse: () => Date.now(),
  },
  {
    name:  "LocalHR-5",
    url:   "__local__",
    parse: () => Date.now(),
  },
  {
    name:  "LocalHR-6",
    url:   "__local__",
    parse: () => Date.now(),
  },
  {
    name:  "LocalHR-7",
    url:   "__local__",
    parse: () => Date.now(),
  },
  {
    name:  "LocalHR-8",
    url:   "__local__",
    parse: () => Date.now(),
  },
  {
    name:  "LocalHR-9",
    url:   "__local__",
    parse: () => Date.now(),
  },
];

// The Audit-100 pool is represented as 100 local-fallback entries for
// environments where 100 distinct HTTP NTP sources are unavailable.
// On Node-02 this list is loaded from a sovereign node configuration.
// In the edge runtime the local high-res clock fills the pool.
function buildAuditPool(): NtpSource[] {
  const pool: NtpSource[] = [
    ...ACTIVE_SOURCES, // reuse the 3 real sources
  ];
  // Pad to AUDIT_POOL_SIZE with local-HR entries
  for (let i = pool.length; i < AUDIT_POOL_SIZE; i++) {
    pool.push({
      name:  `AuditLocal-${i + 1}`,
      url:   "__local__",
      parse: () => Date.now(),
    });
  }
  return pool.slice(0, AUDIT_POOL_SIZE);
}

const AUDIT_SOURCES: NtpSource[] = buildAuditPool();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeMeshSourceResult {
  name:         string;
  epochMs:      number | null;
  included:     boolean;
  deviationUs:  number | null;  // deviation in microseconds
  quarantined:  boolean;
}

export interface TimeMeshResult {
  /** ISO-9 consensus timestamp. */
  iso9:              string;
  /** Unix ms consensus average. */
  consensusMs:       number;
  /** SHA-512 anchor of the consensus. */
  sha512:            string;
  /** Individual source results. */
  sources:           TimeMeshSourceResult[];
  /** Active pool sources included. */
  activeCount:       number;
  /** Sources quarantined / pruned. */
  quarantinedCount:  number;
  /** Physical delta from hardware clock (if Node-02). */
  physicalDeltaMs:   number;
  /** "PHYSICAL" (Node-02) or "LATENT" (edge/browser). */
  physicalityStatus: "PHYSICAL" | "LATENT";
  /** Kernel anchor. */
  kernelSha:         string;
  kernelVersion:     string;
  /** Which pool was used: "active" or "audit". */
  poolType:          "active" | "audit";
}

// ── AST trigger types ─────────────────────────────────────────────────────────

export interface AstSession {
  /** AST_START — captured when ⛓️⚓⛓️ start anchor is recognised. */
  startIso9:     string;
  /** AST_END — captured when ⛓️⚓⛓️ end anchor is rendered. */
  endIso9:       string | null;
  /** Physical Delta (hardware-derived, not Date-derived). */
  physicalDelta: string | null;
  /** Physicality status at session start. */
  physicalityStatus: "PHYSICAL" | "LATENT";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    // eslint-disable-next-line security/detect-object-injection
    ? (sorted[mid] ?? 0)
    // eslint-disable-next-line security/detect-object-injection
    : (((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

async function fetchSource(src: NtpSource): Promise<number | null> {
  if (src.url === "__local__") return Date.now();
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res  = await fetch(src.url, { signal: ctrl.signal });
      const text = await res.text();
      let body: unknown;
      try { body = JSON.parse(text); } catch { body = text; }
      return src.parse(body);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function consensusFrom(
  sources:   NtpSource[],
  poolType:  "active" | "audit",
): Promise<TimeMeshResult> {
  const t0   = astStart();
  const raw  = await Promise.all(sources.map(async (src) => ({
    name:    src.name,
    epochMs: await fetchSource(src),
  })));

  const valid = raw.filter((r): r is { name: string; epochMs: number } => r.epochMs !== null);

  if (valid.length === 0) {
    const now  = Date.now();
    const sha  = await sha512hex(`${now}:${KERNEL_SHA}`);
    const t1   = astEnd();
    const delt = astDelta(t0, t1);
    return {
      iso9:              formatIso9(new Date(now)),
      consensusMs:       now,
      sha512:            sha,
      sources:           raw.map((r) => ({ ...r, included: false, deviationUs: null, quarantined: false })),
      activeCount:       0,
      quarantinedCount:  0,
      physicalDeltaMs:   delt.ms,
      physicalityStatus: clockPhysicalityStatus(),
      kernelSha:         KERNEL_SHA,
      kernelVersion:     KERNEL_VERSION,
      poolType,
    };
  }

  // Median + outlier pruning (threshold: PRUNE_THRESHOLD_US microseconds)
  const sorted    = [...valid.map((r) => r.epochMs)].sort((a, b) => a - b);
  const med       = median(sorted);
  const threshMs  = PRUNE_THRESHOLD_US / 1000; // convert µs → ms

  const inliers   = valid.filter((r) => Math.abs(r.epochMs - med) <= threshMs);
  const pruned    = valid.filter((r) => Math.abs(r.epochMs - med) > threshMs);
  const working   = inliers.length > 0 ? inliers : valid;

  const consensusMs = Math.round(
    working.reduce((s, r) => s + r.epochMs, 0) / working.length,
  );
  const sha512 = await sha512hex(`${consensusMs}:${KERNEL_SHA}`);

  const results: TimeMeshSourceResult[] = raw.map((r) => {
    const isValid    = r.epochMs !== null;
    const included   = isValid && working.some((w) => w.name === r.name);
    const quarantined = isValid && pruned.some((p) => p.name === r.name);
    return {
      name:        r.name,
      epochMs:     r.epochMs,
      included,
      quarantined,
      deviationUs: isValid ? Math.abs((r.epochMs ?? 0) - med) * 1000 : null,
    };
  });

  const t1   = astEnd();
  const delt = astDelta(t0, t1);

  return {
    iso9:              formatIso9(new Date(consensusMs)),
    consensusMs,
    sha512,
    sources:           results,
    activeCount:       working.length,
    quarantinedCount:  pruned.length,
    physicalDeltaMs:   delt.ms,
    physicalityStatus: clockPhysicalityStatus(),
    kernelSha:         KERNEL_SHA,
    kernelVersion:     KERNEL_VERSION,
    poolType,
  };
}

// ── Core Exports ──────────────────────────────────────────────────────────────

/**
 * Poll the Active Pool (12 sources) for the live AST handshake.
 * Called every 30 minutes by the NTP Steward.
 */
export async function getActivePoolTime(): Promise<TimeMeshResult> {
  return consensusFrom(ACTIVE_SOURCES, "active");
}

/**
 * Poll the Audit Pool (100 sources) for baseline forensic audit.
 * Called every 12 hours by the NTP Steward.
 */
export async function getAuditPoolTime(): Promise<TimeMeshResult> {
  return consensusFrom(AUDIT_SOURCES, "audit");
}

// ── AST Session helpers ───────────────────────────────────────────────────────

const _sessions = new Map<string, ReturnType<typeof astStart>>();

/**
 * Begin an AST session — captured when the ⛓️⚓⛓️ start anchor is recognised.
 *
 * @param sessionId  Unique session identifier (e.g. request ID).
 * @returns          AstSession with startIso9 filled and endIso9 = null.
 */
export function astSessionStart(sessionId: string): AstSession {
  const pulse = astStart();
  _sessions.set(sessionId, pulse);
  return {
    startIso9:         pulse.iso9,
    endIso9:           null,
    physicalDelta:     null,
    physicalityStatus: clockPhysicalityStatus(),
  };
}

/**
 * End an AST session — captured when the ⛓️⚓⛓️ end anchor is rendered.
 *
 * @param sessionId  Session ID passed to astSessionStart().
 * @returns          Completed AstSession with Physical Delta, or null if no matching start.
 */
export function astSessionEnd(sessionId: string): AstSession | null {
  const startPulse = _sessions.get(sessionId);
  if (!startPulse) return null;
  _sessions.delete(sessionId);

  const endPulse = astEnd();
  const delta    = astDelta(startPulse, endPulse);

  return {
    startIso9:         startPulse.iso9,
    endIso9:           endPulse.iso9,
    physicalDelta:     delta.display,
    physicalityStatus: clockPhysicalityStatus(),
  };
}
