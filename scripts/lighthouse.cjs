const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

/**
 * AveryOS Lighthouse — Sovereign Hybrid Protocol
 * Version: 2026.02.24-Hybrid
 * Target: Node-02 Local + Cloud Beacon
 */

const PORT = 3000;

function pulse() {
  const timestamp = new Date().toISOString();
  const heartbeat = `⚓ AveryOS Heartbeat | Node-02 | ${timestamp} | 🤜🏻⛓️⚓⛓️`;
  fs.writeFileSync('heartbeat.log', heartbeat);
  
  try {
    // Ensure Git identity for the session
    execSync('git config --global user.email "truth@averyworld.com"');
    execSync('git config --global user.name "averyjl"');
    
    execSync('git add heartbeat.log');
    execSync(`git commit -m "🚨 Sovereign Pulse: ${timestamp}"`);
    execSync('git push');
    console.log(`✅ Lighthouse Heartbeat Pulsed at ${timestamp}`);
  } catch (err) {
    console.error("❌ Pulse Blocked. Checking for MITM interference...");
  }
}

// 1. Create the Persistent HTTP Server for the Cloudflare Tunnel
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: "ANCHORED",
    node: "AveryOS-Lighthouse-02",
    timestamp: new Date().toISOString(),
    merkle_root: "0e621e4cb03b5acbc402e4c694b57863f3cf6e41e11ab43d5bd2d707727a5aafda012e8060455b8e66295c4cb8f1d8869b22227d86f78f8"
  }));
});

// 2. Hybrid Execution Logic
const isCI = process.env.GITHUB_ACTIONS === 'true';

if (isCI) {
  // CLOUD MODE: Pulse and exit to allow GitHub Actions to finish
  console.log("☁️ Cloud-Sovereign Mode Detected.");
  pulse();
  process.exit(0);
} else {
  // LOCAL MODE: Start persistent server and run initial pulse
  server.listen(PORT, () => {
    console.log(`🏠 Local Sovereign Node active on PORT ${PORT}`);
    console.log(`📡 Persistence established. Tunnel point ready.`);
    pulse();
  });
}
