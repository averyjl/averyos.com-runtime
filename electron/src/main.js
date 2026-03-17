/**
 * AveryOS™ Terminal — Main Process
 *
 * Sovereign 7-Repo Bridge wrapped in an Electron native shell.
 *
 * Goals:
 *   1. Isolate kernel operations from browser-level side-channel probes
 *      (Firefox update checks, Seagate pop-ups, system-level http_proxy sniffing)
 *   2. Provide hardware-attested SSH access to the 7 sovereign private repos
 *      via YubiKey GPG slot integration
 *   3. Display live GabrielOS™ audit telemetry in a dedicated native window
 *
 * Security model:
 *   - No remote content: all pages are served from local files only
 *   - webSecurity: true (cannot be overridden)
 *   - contextIsolation: true, nodeIntegration: false (preload-only IPC)
 *   - The http_proxy system variable is intentionally ignored by the app
 *     (no-proxy: * equivalent) to prevent MITM probes
 *
 * Branding: Gold (#D4AF37) on Black (#000000) — Sovereign Standard
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- Electron main process is CommonJS; ESM import() is unavailable in this context */
const { app, BrowserWindow, ipcMain, shell, Menu } = require("electron");
const path = require("path");
const fs   = require("fs");
const os   = require("os");
const http = require("http");
const { spawn } = require("child_process");

// ── Security: disable any proxy that may be set by the host OS ───────────────
app.commandLine.appendSwitch("no-proxy-server");

// ── Window reference ─────────────────────────────────────────────────────────
let mainWindow = null;

// ── Kernel constants ─────────────────────────────────────────────────────────
const KERNEL_VERSION = "v3.6.2";
const KERNEL_ANCHOR_DISPLAY = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const SITE_URL = "https://www.averyos.com";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: `AveryOS™ Terminal — Sovereign Node-02 | Kernel ${KERNEL_VERSION}`,
    backgroundColor: "#000000",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Never allow navigation to external URLs from within the app
      navigateOnDragDrop: false,
    },
    icon: path.join(__dirname, "..", "assets", "icon.png"),
  });

  // Load the terminal shell HTML
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Prevent the window title from being overridden by page title
  mainWindow.on("page-title-updated", (e) => e.preventDefault());

  // Open external links in the system browser, not within the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Prevent navigation away from local files
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  buildMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC: SSH Repo Audit ────────────────────────────────────────────────────────

ipcMain.handle("bridge:verify", async (_event, args = []) => {
  // Validate args: only allow known safe flags to prevent command injection
  const SAFE_FLAGS = new Set(["--verbose", "-v", "--ci"]);
  const safeArgs = Array.isArray(args)
    ? args.filter((a) => typeof a === "string" && SAFE_FLAGS.has(a))
    : [];

  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "..", "..", "scripts", "verify-repo-ssh.cjs");
    const proc = spawn(process.execPath, [scriptPath, ...safeArgs], {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    proc.stdout.on("data", (d) => { output += d.toString(); });
    proc.stderr.on("data", (d) => { output += d.toString(); });

    proc.on("close", (code) => {
      resolve({ code, output });
    });

    proc.on("error", (err) => {
      resolve({ code: 1, output: `Error: ${err.message}` });
    });
  });
});

// ── IPC: Open URL in browser ──────────────────────────────────────────────────

ipcMain.handle("shell:openExternal", (_event, url) => {
  if (typeof url === "string" && url.startsWith("https://")) {
    shell.openExternal(url);
  }
});

// ── IPC: Kernel info ──────────────────────────────────────────────────────────

ipcMain.handle("kernel:info", () => ({
  version: KERNEL_VERSION,
  anchor: KERNEL_ANCHOR_DISPLAY,
  siteUrl: SITE_URL,
  platform: process.platform,
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron,
}));

// ── IPC: .aossalt USB Residency Read — GATE 116.3 ────────────────────────────
//
// Scans all mounted volumes for the sovereign MIME-registered salt file
// `AveryOS-anchor-salt.aossalt` and returns the first 64 bytes as hex.
// Falls back to legacy `.aos-salt` / `AOS_SALT.bin` markers.
//
// Returns:
//   { found: true,  state: "FULLY_RESIDENT"|"NODE-02_PHYSICAL",
//     mountPath: string, saltPath: string, previewHex: string|null }
// or
//   { found: false, state: "CLOUD", mountPath: null, saltPath: null, previewHex: null }

const AOS_SALT_AOSSALT    = "AveryOS-anchor-salt.aossalt";
const AOS_SALT_MARKER_LEG = ".aos-salt";
const AOS_SALT_BLOCK_LEG  = "AOS_SALT.bin";

// Salt file names are constants — only these exact names are ever searched for.
// No user-supplied filenames are accepted.
const ALLOWED_SALT_FILENAMES = new Set([
  AOS_SALT_AOSSALT,
  AOS_SALT_MARKER_LEG,
  AOS_SALT_BLOCK_LEG,
]);

// Permitted base-path prefixes for USB mount scanning (OS-specific).
const ALLOWED_LINUX_BASES_RE   = /^\/(?:media\/[a-zA-Z0-9_.-]{1,64}|mnt|run\/media\/[a-zA-Z0-9_.-]{1,64})\//;
const ALLOWED_DARWIN_BASE      = "/Volumes/";

/**
 * Sanitise a string for safe use as a path component.
 * Strips everything except alphanumerics, hyphens, underscores, dots, and @.
 * Also strips null bytes and prevents traversal sequences.
 */
function sanitisePathComponent(s) {
  // Remove null bytes and control characters first
  const noNull = s.replace(/[\x00-\x1f]/g, "");
  // Allow typical POSIX usernames/volume names; reject path separators
  return noNull.replace(/[^a-zA-Z0-9_.\-@ ]/g, "").trim();
}

/**
 * Validate that a constructed salt path is within expected safe boundaries.
 * Returns the normalised path if valid, or null to reject it.
 *
 * Security intent:
 *   • Prevents path traversal attacks against the salt scanning logic.
 *   • Only paths within known USB mount prefixes pointing to known salt
 *     file names are accepted.
 */
function validateSaltPath(saltPath) {
  const norm = path.normalize(saltPath);
  // Reject null bytes or traversal sequences that survive normalization
  if (norm.includes("\x00") || norm.includes("..")) return null;
  // Confirm the filename component is one of our known safe constants
  const base = path.basename(norm);
  if (!ALLOWED_SALT_FILENAMES.has(base)) return null;
  return norm;
}

function getUsbMountCandidates() {
  if (process.platform === "win32") {
    // Windows: drive letters D–Z only (A/B are floppy, C is system)
    const letters = [];
    for (let c = 68; c <= 90; c++) letters.push(String.fromCharCode(c) + ":\\");
    return letters;
  }
  if (process.platform === "darwin") {
    try {
      // /Volumes is the only valid macOS mount root; each entry is sanitised.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      return fs.readdirSync(ALLOWED_DARWIN_BASE) // fixed literal base — only dir entries vary
        .map((v) => {
          const safe = sanitisePathComponent(v);
          return safe ? path.join(ALLOWED_DARWIN_BASE, safe) : null;
        })
        .filter(Boolean);
    } catch { return []; }
  }
  // Linux: restrict to the three conventional removable-media directories.
  // Username is sanitised to prevent any traversal via crafted OS usernames.
  const rawUser = os.userInfo().username;
  const user    = sanitisePathComponent(rawUser);
  if (!user) return [];

  const expanded = [];
  for (const base of [`/media/${user}`, "/mnt", `/run/media/${user}`]) {
    try {
      // Validate the base path against the allowed prefix pattern before touching fs.
      if (!ALLOWED_LINUX_BASES_RE.test(base + "/") && base !== "/mnt") continue;
      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) { // eslint-disable-line security/detect-non-literal-fs-filename -- base validated against ALLOWED_LINUX_BASES_RE
        fs.readdirSync(base).forEach((c) => { // eslint-disable-line security/detect-non-literal-fs-filename -- base validated against ALLOWED_LINUX_BASES_RE
          const safe = sanitisePathComponent(c);
          if (safe) expanded.push(path.join(base, safe));
        });
      }
    } catch { /* skip inaccessible mount bases */ }
  }
  return expanded;
}

function readSaltPreview(saltPath) {
  // Validate path before opening: must resolve to one of our known safe salt filenames
  // within a directory that came from getUsbMountCandidates().
  const safe = validateSaltPath(saltPath);
  if (!safe) return null;
  try {
    const buf = Buffer.alloc(64);
    const fd  = fs.openSync(safe, "r"); // eslint-disable-line security/detect-non-literal-fs-filename -- validated by validateSaltPath()
    const n   = fs.readSync(fd, buf, 0, 64, 0);
    fs.closeSync(fd);
    return buf.subarray(0, n).toString("hex");
  } catch { return null; }
}

ipcMain.handle("residency:checkSalt", async () => {
  const candidates = getUsbMountCandidates();
  for (const mount of candidates) {
    try {
      // Priority 1: FULLY_RESIDENT — AveryOS-anchor-salt.aossalt
      const aossaltPath = validateSaltPath(path.join(mount, AOS_SALT_AOSSALT));
      if (aossaltPath) {
        if (fs.existsSync(aossaltPath)) { // eslint-disable-line security/detect-non-literal-fs-filename -- validated by validateSaltPath()
          return {
            found:      true,
            state:      "FULLY_RESIDENT",
            mountPath:  mount,
            saltPath:   aossaltPath,
            previewHex: readSaltPreview(aossaltPath),
            mimeType:   "application/x-averyos-sovereign-salt",
          };
        }
      }
      // Priority 2: legacy markers
      for (const legacyName of [AOS_SALT_MARKER_LEG, AOS_SALT_BLOCK_LEG]) {
        const legPath = validateSaltPath(path.join(mount, legacyName));
        if (legPath) {
          if (fs.existsSync(legPath)) { // eslint-disable-line security/detect-non-literal-fs-filename -- validated by validateSaltPath()
            return {
              found:      true,
              state:      "NODE-02_PHYSICAL",
              mountPath:  mount,
              saltPath:   legPath,
              previewHex: readSaltPreview(legPath),
              mimeType:   "application/octet-stream",
            };
          }
        }
      }
    } catch { /* skip inaccessible mounts */ }
  }
  return { found: false, state: "CLOUD", mountPath: null, saltPath: null, previewHex: null, mimeType: null };
});

// ── IPC: Local Avery-ALM Sync — GATE 116.3 / GATE 117.1 ─────────────────────
//
// Forwards a JSON-RPC request to the local Avery-ALM (Anchored Language Model,
// Ollama-compatible) API running on Node-02.
// Default endpoint: http://127.0.0.1:11434
//
// Security:
//   • Only connects to loopback (127.0.0.1 / localhost) — never external.
//   • Request body is validated: must be a plain object with a `model` string.
//   • Response is returned verbatim to the renderer via IPC.

const ALM_HOST    = "127.0.0.1";
const ALM_PORT    = 11434;
const ALM_TIMEOUT = 10_000; // 10 s

ipcMain.handle("alm:generate", (_event, requestBody) => {
  return new Promise((resolve) => {
    // Validate input — only accept well-formed Ollama-style request objects
    if (
      !requestBody ||
      typeof requestBody !== "object" ||
      typeof requestBody.model !== "string" ||
      !requestBody.model.trim()
    ) {
      resolve({ ok: false, error: "Invalid ALM request body: 'model' string is required." });
      return;
    }

    const bodyStr = JSON.stringify(requestBody);
    const options = {
      hostname: ALM_HOST,
      port:     ALM_PORT,
      path:     "/api/generate",
      method:   "POST",
      headers:  {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end",  () => {
        if (settled) return;
        settled = true;
        try { resolve({ ok: true, status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ ok: true, status: res.statusCode, body: data }); }
      });
    });

    let settled = false;

    req.setTimeout(ALM_TIMEOUT, () => {
      if (settled) return;
      settled = true;
      req.destroy();
      resolve({ ok: false, error: `ALM request timed out after ${ALM_TIMEOUT}ms` });
    });

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: `ALM unavailable: ${err.message}` });
    });

    req.write(bodyStr);
    req.end();
  });
});

// ── IPC: ALM health ping — GATE 116.3 / GATE 117.1 ───────────────────────────

ipcMain.handle("alm:ping", () => {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: ALM_HOST, port: ALM_PORT, path: "/api/tags", timeout: 3000 },
      (res) => { resolve({ alive: res.statusCode === 200 }); }
    );
    req.on("error",   () => resolve({ alive: false }));
    req.on("timeout", () => { req.destroy(); resolve({ alive: false }); });
  });
});

// ── IPC: ALM chat — GATE 119.9.2 — local ALM /api/chat (non-streaming) ────────

ipcMain.handle("alm:chat", (_event, payload) => {
  return new Promise((resolve) => {
    if (
      !payload || typeof payload !== "object" ||
      typeof payload.model !== "string" || !Array.isArray(payload.messages)
    ) {
      resolve({ ok: false, error: "Invalid alm:chat payload: 'model' string and 'messages' array required." });
      return;
    }

    const body = JSON.stringify({ ...payload, stream: false });
    const options = {
      hostname: ALM_HOST, port: ALM_PORT, path: "/api/chat", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: ALM_TIMEOUT,
    };
    let settled = false;
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data",  (chunk) => { data += chunk; });
      res.on("end",   () => {
        if (settled) return;
        settled = true;
        try { resolve({ ok: true, status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ ok: true, status: res.statusCode, body: data }); }
      });
    });
    req.setTimeout(ALM_TIMEOUT, () => {
      if (settled) return;
      settled = true;
      req.destroy();
      resolve({ ok: false, error: `alm:chat timed out after ${ALM_TIMEOUT}ms` });
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: `ALM unavailable: ${err.message}` });
    });
    req.write(body);
    req.end();
  });
});

// ── IPC: ALM node status — GATE 116.2.3 / GATE 116.3.2 ──────────────────────
//
// Returns a rich status object for the local Avery-ALM node:
//   { alive, version, models, endpoint }
//
// Combines a /api/tags probe (for model list) with a /api/version probe.

ipcMain.handle("alm:status", () => {
  return new Promise((resolve) => {
    const endpoint = `http://${ALM_HOST}:${ALM_PORT}`;
    let settled = false;

    // Probe /api/tags to get available models + confirm the node is alive
    const tagsReq = http.get(
      { hostname: ALM_HOST, port: ALM_PORT, path: "/api/tags", timeout: 3000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end",  () => {
          if (settled) return;
          settled = true;
          try {
            const parsed = JSON.parse(data);
            const models = Array.isArray(parsed.models)
              ? parsed.models.map((m) => (typeof m === "object" && m !== null ? (m.name ?? m.model ?? String(m)) : String(m)))
              : [];
            // Also fetch /api/version (fire-and-forget — not critical)
            http.get(
              { hostname: ALM_HOST, port: ALM_PORT, path: "/api/version", timeout: 2000 },
              (vRes) => {
                let vData = "";
                vRes.on("data", (c) => { vData += c; });
                vRes.on("end",  () => {
                  let version = "unknown";
                  try { version = JSON.parse(vData).version ?? "unknown"; } catch { /* ignore */ }
                  resolve({ alive: true, version, models, endpoint });
                });
              }
            ).on("error", () => resolve({ alive: true, version: "unknown", models, endpoint }));
          } catch {
            resolve({ alive: res.statusCode === 200, version: "unknown", models: [], endpoint });
          }
        });
      }
    );

    tagsReq.on("error",   () => { if (!settled) { settled = true; resolve({ alive: false, version: null, models: [], endpoint }); } });
    tagsReq.on("timeout", () => { if (!settled) { settled = true; tagsReq.destroy(); resolve({ alive: false, version: null, models: [], endpoint }); } });
  });
});

function buildMenu() {
  const template = [
    {
      label: "AveryOS™",
      submenu: [
        { label: `Kernel ${KERNEL_VERSION}`, enabled: false },
        { type: "separator" },
        { label: "Open Site", click: () => shell.openExternal(SITE_URL) },
        { label: "Licensing", click: () => shell.openExternal(`${SITE_URL}/licensing`) },
        { label: "Alignment Accord", click: () => shell.openExternal(`${SITE_URL}/alignment-accord`) },
        { type: "separator" },
        { role: "quit", label: "Quit AveryOS™ Terminal" },
      ],
    },
    {
      label: "7-Repo Bridge",
      submenu: [
        {
          label: "Run SSH Audit",
          accelerator: "CmdOrCtrl+Shift+A",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("run:audit");
            }
          },
        },
        { type: "separator" },
        {
          label: "Open Bridge Docs",
          click: () => shell.openExternal("https://github.com/averyjl/averyos.com-runtime/blob/main/scripts/verify-repo-ssh.cjs"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Dev",
      submenu: [
        { role: "toggleDevTools" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
