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

function getUsbMountCandidates() {
  if (process.platform === "win32") {
    const letters = [];
    for (let c = 68; c <= 90; c++) letters.push(String.fromCharCode(c) + ":\\");
    return letters;
  }
  if (process.platform === "darwin") {
    try { return fs.readdirSync("/Volumes").map((v) => path.join("/Volumes", v)); }
    catch { return []; }
  }
  // Linux
  const user = os.userInfo().username;
  const expanded = [];
  for (const base of [`/media/${user}`, "/mnt", `/run/media/${user}`]) {
    try {
      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        fs.readdirSync(base).forEach((c) => expanded.push(path.join(base, c)));
      }
    } catch { /* skip */ }
  }
  return expanded;
}

function readSaltPreview(saltPath) {
  try {
    const buf = Buffer.alloc(64);
    const fd  = fs.openSync(saltPath, "r");
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
      const aossaltPath = path.join(mount, AOS_SALT_AOSSALT);
      if (fs.existsSync(aossaltPath)) {
        return {
          found:      true,
          state:      "FULLY_RESIDENT",
          mountPath:  mount,
          saltPath:   aossaltPath,
          previewHex: readSaltPreview(aossaltPath),
          mimeType:   "application/x-averyos-sovereign-salt",
        };
      }
      // Priority 2: legacy markers
      for (const legacyName of [AOS_SALT_MARKER_LEG, AOS_SALT_BLOCK_LEG]) {
        const legPath = path.join(mount, legacyName);
        if (fs.existsSync(legPath)) {
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
    } catch { /* skip inaccessible */ }
  }
  return { found: false, state: "CLOUD", mountPath: null, saltPath: null, previewHex: null, mimeType: null };
});

// ── IPC: Local Avery-LOM Sync — GATE 116.3 ───────────────────────────────────
//
// Forwards a JSON-RPC request to the local Avery-LOM (Ollama-compatible) API
// running on Node-02.  Default endpoint: http://localhost:11434
//
// Security:
//   • Only connects to loopback (127.0.0.1 / localhost) — never external.
//   • Request body is validated: must be a plain object with a `model` string.
//   • Response is returned verbatim to the renderer via IPC.

const LOM_HOST    = "127.0.0.1";
const LOM_PORT    = 11434;
const LOM_TIMEOUT = 10_000; // 10 s

ipcMain.handle("lom:generate", (_event, requestBody) => {
  return new Promise((resolve) => {
    // Validate input — only accept well-formed Ollama-style request objects
    if (
      !requestBody ||
      typeof requestBody !== "object" ||
      typeof requestBody.model !== "string" ||
      !requestBody.model.trim()
    ) {
      resolve({ ok: false, error: "Invalid LOM request body: 'model' string is required." });
      return;
    }

    const bodyStr = JSON.stringify(requestBody);
    const options = {
      hostname: LOM_HOST,
      port:     LOM_PORT,
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

    req.setTimeout(LOM_TIMEOUT, () => {
      if (settled) return;
      settled = true;
      req.destroy();
      resolve({ ok: false, error: `LOM request timed out after ${LOM_TIMEOUT}ms` });
    });

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: `LOM unavailable: ${err.message}` });
    });

    req.write(bodyStr);
    req.end();
  });
});

// ── IPC: LOM health ping — GATE 116.3 ────────────────────────────────────────

ipcMain.handle("lom:ping", () => {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: LOM_HOST, port: LOM_PORT, path: "/api/tags", timeout: 3000 },
      (res) => { resolve({ alive: res.statusCode === 200 }); }
    );
    req.on("error",   () => resolve({ alive: false }));
    req.on("timeout", () => { req.destroy(); resolve({ alive: false }); });
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
