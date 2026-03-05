import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA, KERNEL_VERSION } from '../../../../lib/sovereignConstants';
import { formatIso9 } from '../../../../lib/timePrecision';
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from '../../../../lib/sovereignError';

/**
 * GET /api/v1/generate-evidence?ip=<target-ip>
 *
 * Generates a sovereign evidence bundle (.aoscap) for the given IP address
 * and returns it as a downloadable JSON file.
 *
 * Auth: Bearer token matching VAULT_PASSPHRASE (same gate as /api/v1/audit-stream).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_PASSPHRASE?: string;
}

interface AuditLogRow {
  id: number;
  event_type: string;
  ip_address: string;
  user_agent: string | null;
  geo_location: string | null;
  target_path: string;
  timestamp_ns: string;
  threat_level: number | null;
}

const TARI_LIABILITY: Record<string, number> = {
  UNALIGNED_401: 1017.0,
  ALIGNMENT_DRIFT: 5000.0,
  PAYMENT_FAILED: 10000.0,
};

const TARI_LIABILITY_LABELS: Record<string, string> = {
  UNALIGNED_401: 'Forensic Alignment Entry Fee',
  ALIGNMENT_DRIFT: 'Correction Fee',
  PAYMENT_FAILED: 'Systemic Friction Fee',
};

/** Validates an IPv4 or IPv6 address string. Returns true if valid. */
function isValidIp(ip: string): boolean {
  // IPv4: four octets 0-255
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(ip)) {
    return ip.split('.').every((o) => parseInt(o, 10) <= 255);
  }
  // IPv6: full form (eight colon-separated groups of 1-4 hex digits)
  // or compressed form using "::" at most once, with up to 7 groups
  const ipv6Full = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  if (ipv6Full.test(ip)) return true;
  // Compressed IPv6 — must contain "::" exactly once and have ≤ 7 groups outside it
  const ipv6Compressed = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Compressed.test(ip) && (ip.match(/::/g) ?? []).length === 1;
}

/** SHA-512 via WebCrypto — available in Cloudflare Workers runtime. */
async function computePulseHash(ip: string, timestamp: string): Promise<string> {
  const input = `${ip}|${timestamp}|${KERNEL_SHA}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (authHeader.startsWith('Handshake ')) {
    token = authHeader.slice(10);
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const expected = cfEnv.VAULT_PASSPHRASE ?? '';
    if (!expected) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, 'VAULT_PASSPHRASE secret is not set.');
    }
    if (!token || token.trim() !== expected.trim()) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, 'Valid sovereign passphrase required. Authenticate at /vault-gate.');
    }

    // ── IP validation ─────────────────────────────────────────────────────
    const url = new URL(request.url);
    const ip = url.searchParams.get('ip') ?? '';
    if (!ip) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'Missing required query parameter: ip');
    }
    if (!isValidIp(ip)) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, `Invalid IP address format: "${ip}". Only valid IPv4 or IPv6 addresses are accepted.`);
    }

    // ── D1 query ──────────────────────────────────────────────────────────
    const { results: rows } = await cfEnv.DB.prepare(
      `SELECT id, event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level
       FROM sovereign_audit_logs
       WHERE ip_address = ?
       ORDER BY id DESC
       LIMIT 500`
    )
      .bind(ip)
      .all<AuditLogRow>();

    // ── TARI™ liability ───────────────────────────────────────────────────
    let tariTotal = 0;
    const tariBreakdown: Record<string, number> = {};
    for (const row of rows) {
      const eventType = String(row.event_type ?? 'UNALIGNED_401').toUpperCase();
      const amount = TARI_LIABILITY[eventType] ?? TARI_LIABILITY.UNALIGNED_401;
      tariTotal += amount;
      tariBreakdown[eventType] = (tariBreakdown[eventType] ?? 0) + amount;
    }
    // Minimum one entry fee even for empty result sets
    if (rows.length === 0) {
      tariTotal = TARI_LIABILITY.UNALIGNED_401;
      tariBreakdown['UNALIGNED_401'] = TARI_LIABILITY.UNALIGNED_401;
    }
    const tariFormatted = tariTotal.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });

    // ── Pulse hash & timestamp ─────────────────────────────────────────────
    const timestamp = formatIso9();
    const pulseHash = await computePulseHash(ip, timestamp);

    // ── Build .aoscap evidence bundle ─────────────────────────────────────
    const hasViolations = rows.length > 0;
    const bundle = {
      CapsuleID: `EVIDENCE_BUNDLE_${ip}_${timestamp}`,
      CapsuleType: 'SOVEREIGN_EVIDENCE_BUNDLE',
      Authority: 'Jason Lee Avery (ROOT0)',
      CreatorLock: '🤛🏻',
      HasViolations: hasViolations,
      KernelAnchor: {
        version: KERNEL_VERSION,
        sha512: KERNEL_SHA,
      },
      TargetIP: ip,
      AuditLogCount: rows.length,
      AuditLogs: rows,
      TariLiability: {
        totalUsd: tariTotal,
        formatted: tariFormatted,
        breakdown: tariBreakdown,
        labels: Object.fromEntries(
          Object.keys(tariBreakdown).map((k) => [k, TARI_LIABILITY_LABELS[k] ?? k])
        ),
      },
      PulseHash: {
        algorithm: 'SHA-512',
        value: pulseHash,
        input: `${ip}|${timestamp}|<KERNEL_SHA>`,
      },
      GeneratedAt: timestamp,
      License: 'AveryOS Sovereign Integrity License v1.0',
      SovereignAnchor: '⛓️⚓⛓️',
    };

    // ── Return as downloadable .aoscap JSON ────────────────────────────────
    const safeIp = ip.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeTs = timestamp
      .replace(/T/, '_')
      .replace(/[:Z]/g, '')
      .replace(/\.\d+$/, '')
      .slice(0, 18);
    const fileName = `EVIDENCE_BUNDLE_${safeIp}_${safeTs}.aoscap`;

    return new Response(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Sovereign-Pulse': pulseHash.slice(0, 32),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, 'sovereign_audit_logs');
  }
}
