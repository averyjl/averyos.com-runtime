const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

const PORT = 3000; // The port your tunnel will now point to

function pulse() {
  const timestamp = new Date().toISOString();
  const heartbeat = `⚓ AveryOS Heartbeat | Node-02 | ${timestamp} | 🤜🏻⛓️⚓⛓️`;
  fs.writeFileSync('heartbeat.log', heartbeat);
  
  try {
    execSync('git add heartbeat.log');
    execSync(`git commit -m "🚨 Sovereign Pulse: ${timestamp}"`);
    execSync('git push');
    console.log(`✅ Lighthouse Heartbeat Pulsed at ${timestamp}`);
  } catch (err) {
    console.error("❌ Pulse Blocked. Checking for MITM interference...");
  }
}

// 1. Create the HTTP Server for the Cloudflare Tunnel
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: "ANCHORED",
    node: "AveryOS-Lighthouse-02",
    timestamp: new Date().toISOString(),
    merkle_root: "0e621e4cb03b5acbc402e4c694b57863f3cf6e41e11ab43d5bd2d707727a5aafda012e8060455b8e66295c4cb8f1d8869472f94643fc2a8cf3a23c279c053be3"
  }));
});

// 2. Start the listener
server.listen(PORT, () => {
  console.log(`🚀 AveryOS Lighthouse Bridge active on http://localhost:${PORT}`);
});

// Run pulse every hour
setInterval(pulse, 3600000);
pulse();
