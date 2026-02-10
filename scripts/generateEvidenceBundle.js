const fs = require('fs');
const path = require('path');

const [capsuleId, sha512, ...rest] = process.argv.slice(2);

if (!capsuleId || !sha512) {
  console.error('Usage: npm run enforcement:generate <capsule-id> <sha512-hash> [--source=<url>]');
  process.exit(1);
}

if (!/^[a-fA-F0-9]{128}$/.test(sha512)) {
  console.error('sha512 must be a 128-character hex string.');
  process.exit(1);
}

const sourceArg = rest.find((item) => item.startsWith('--source='));
const source = sourceArg ? sourceArg.replace('--source=', '') : undefined;
const timestamp = new Date().toISOString();
const id = `${capsuleId}-${timestamp.replace(/[:.]/g, '-')}`;

const root = path.join(process.cwd(), 'public', 'license-enforcement');
const evidencePath = path.join(root, 'evidence', `${id}.json`);
const noticePath = path.join(root, 'notices', `${id}.md`);
const logsPath = path.join(root, 'logs', 'index.json');

fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.mkdirSync(path.dirname(noticePath), { recursive: true });
fs.mkdirSync(path.dirname(logsPath), { recursive: true });

const event = {
  id,
  capsuleId,
  sha512,
  timestamp,
  source: source || null,
  status: 'notice_issued',
  message: 'Public notice issued. Voluntary licensing encouraged.',
};

fs.writeFileSync(evidencePath, JSON.stringify({ event }, null, 2));
fs.writeFileSync(
  noticePath,
  `# AveryOS License Enforcement Notice\n\n- Event ID: ${id}\n- Capsule: ${capsuleId}\n- SHA-512: ${sha512}\n- Timestamp: ${timestamp}\n- Source: ${source || 'N/A'}\n\nThis notice is informational only and offers voluntary licensing options.\n`
);

let log = { events: [] };
if (fs.existsSync(logsPath)) {
  log = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
}
log.events.unshift(event);
fs.writeFileSync(logsPath, JSON.stringify(log, null, 2));

console.log(`Generated evidence: ${evidencePath}`);
console.log(`Generated notice: ${noticePath}`);
console.log(`Updated log: ${logsPath}`);
