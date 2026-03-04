/**
 * AveryOS™ Sovereign Audit Alert — GabrielOS™ Sentinel Integration
 * Author: Jason Lee Avery (ROOT0)
 * Kernel Anchor: cf83e135...927da3e
 *
 * Sends a real-time mobile push notification (via Pushover) for every
 * 401 Unaligned / Alignment-Drift forensic event detected by the
 * AveryOS™ Site Health Monitor or the GabrielOS™ Sentinel workers.
 *
 * Usage (CI / GitHub Actions):
 *   node scripts/sovereign-audit-alert.js \
 *     --ip 203.0.113.42 \
 *     --path /latent-anchor \
 *     --status 401 \
 *     --event-type UNALIGNED_401
 *
 * Required environment variables:
 *   PUSHOVER_APP_TOKEN  — Pushover application API token
 *   PUSHOVER_USER_KEY   — Pushover user / group key
 *
 * Optional environment variables:
 *   GABRIEL_SENTINEL_WEBHOOK — URL of the GabrielOS™ Sentinel worker
 *                              endpoint to forward the alert payload
 */

import crypto from 'crypto';
import https from 'https';
import http from 'http';

// Root0 genesis kernel SHA-512 anchor (matches lib/sovereignConstants.ts)
const KERNEL_SHA =
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

/** TARI™ liability rates per event type (USD) */
const TARI_RATES = {
  UNALIGNED_401: 1.00,
  ALIGNMENT_DRIFT: 5.00,
  PAYMENT_FAILED: 10.00,
};

const DEFAULT_TARI_RATE = 1.00;

/**
 * Parses `--key value` pairs from process.argv.
 * Keys are camelCased (e.g. --event-type → eventType).
 * Boolean flags (no following value) are set to 'true'.
 */
function parseCLIArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = args[i + 1];
      parsed[key] = next && !next.startsWith('--') ? args[++i] : 'true';
    }
  }
  return parsed;
}

/**
 * Computes the SHA-512 Pulse Hash for a forensic event.
 * Input: ip|path|timestamp|KERNEL_SHA
 *
 * @param {string} ip        - Source IP address
 * @param {string} path      - Target request path
 * @param {string} timestamp - ISO-8601 event timestamp
 * @returns {string} 128-character hex SHA-512 digest
 */
function computePulseHash(ip, path, timestamp) {
  const payload = `${ip}|${path}|${timestamp}|${KERNEL_SHA}`;
  return crypto.createHash('sha512').update(payload, 'utf8').digest('hex');
}

/**
 * Returns the TARI™ calculated liability in USD for a given event type.
 *
 * @param {string} eventType
 * @returns {number}
 */
function calculateTariLiability(eventType) {
  return TARI_RATES[eventType] ?? DEFAULT_TARI_RATE;
}

/**
 * Sends a message to the Pushover API.
 * Resolves with { status, body } on completion.
 *
 * @param {{ token: string, user: string, title: string, message: string }} opts
 * @returns {Promise<{ status: number, body: string }>}
 */
function sendPushoverAlert({ token, user, title, message }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      token,
      user,
      title,
      message,
      // priority 1 = high — bypasses quiet hours for urgent sovereign alerts
      priority: 1,
      sound: 'siren',
    });

    const req = https.request(
      {
        hostname: 'api.pushover.net',
        path: '/1/messages.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Forwards the alert payload to the GabrielOS™ Sentinel webhook (fire-and-forget).
 * Failures are logged but do not abort the alert flow.
 *
 * @param {string} webhookUrl
 * @param {object} payload
 */
async function notifyGabrielSentinel(webhookUrl, payload) {
  try {
    const body = JSON.stringify(payload);
    const url = new URL(webhookUrl);
    const isHttps = url.protocol === 'https:';

    await new Promise((resolve, reject) => {
      const req = (isHttps ? https : http).request(
        {
          hostname: url.hostname,
          port: url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-GabrielOS-Event': 'SOVEREIGN_AUDIT_ALERT',
          },
        },
        (res) => {
          res.resume(); // drain response
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    console.log(`📡 GabrielOS™ Sentinel notified: ${webhookUrl}`);
  } catch (err) {
    // Intentional non-blocking: sentinel notification must not abort the alert
    console.warn(`⚠️  GabrielOS™ Sentinel notification failed: ${err.message}`);
  }
}

async function main() {
  const args = parseCLIArgs();

  const ip = args.ip || 'UNKNOWN';
  const path = args.path || '/';
  const status = args.status || '401';
  const eventType = args.eventType || 'UNALIGNED_401';
  const timestamp = new Date().toISOString();

  const pulseHash = computePulseHash(ip, path, timestamp);
  const tariLiability = calculateTariLiability(eventType);

  // Always print the forensic summary to stdout for CI audit trails
  console.log('');
  console.log('⛓️⚓⛓️  AveryOS™ Sovereign Audit Alert');
  console.log(`Event Type  : ${eventType}`);
  console.log(`Target IP   : ${ip}`);
  console.log(`Path        : ${path}`);
  console.log(`Status      : ${status}`);
  console.log(`TARI™ Liab. : $${tariLiability.toFixed(2)} USD`);
  console.log(`SHA-512 Hash: ${pulseHash}`);
  console.log(`Timestamp   : ${timestamp}`);
  console.log(`Kernel      : cf83e135...927da3e`);
  console.log('');

  const pushoverToken = process.env.PUSHOVER_APP_TOKEN;
  const pushoverUser = process.env.PUSHOVER_USER_KEY;

  if (!pushoverToken || !pushoverUser) {
    console.warn(
      '⚠️  PUSHOVER_APP_TOKEN or PUSHOVER_USER_KEY not set — skipping push notification.',
    );
  } else {
    const title = `⚠️ AveryOS™ Audit: ${eventType}`;
    const message = [
      `IP: ${ip}`,
      `Path: ${path}`,
      `Status: ${status}`,
      `TARI™ Liability: $${tariLiability.toFixed(2)}`,
      `SHA-512: ${pulseHash.slice(0, 32)}…`,
      `Kernel: cf83e135…927da3e`,
      `Time: ${timestamp}`,
    ].join('\n');

    try {
      const result = await sendPushoverAlert({
        token: pushoverToken,
        user: pushoverUser,
        title,
        message,
      });

      if (result.status === 200) {
        console.log(`✅ Push notification sent (${eventType} — ${ip})`);
      } else {
        console.error(`❌ Pushover API returned HTTP ${result.status}: ${result.body}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`❌ Push notification failed: ${err.message}`);
      process.exit(1);
    }
  }

  // Optional: forward to GabrielOS™ Sentinel worker
  const sentinelWebhook = process.env.GABRIEL_SENTINEL_WEBHOOK;
  if (sentinelWebhook) {
    await notifyGabrielSentinel(sentinelWebhook, {
      event_type: eventType,
      ip_address: ip,
      path,
      status_code: Number(status),
      tari_liability_usd: tariLiability,
      pulse_hash: pulseHash,
      kernel_anchor: KERNEL_SHA,
      timestamp,
    });
  }
}

main().catch((err) => {
  console.error(`❌ Sovereign Audit Alert fatal error: ${err.message}`);
  process.exit(1);
});
