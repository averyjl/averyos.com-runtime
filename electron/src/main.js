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
const { spawn } = require("child_process");
const http = require("http");

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

// ── IPC: Local Avery-LOM Bridge — GATE 116.3.2 ────────────────────────────────
// Bridges the Electron renderer to the local Avery Language-of-Motion (LOM)
// endpoint running on Node-02 hardware at localhost:8080/v1/chat.
// This enables the "Hammer" (LOM) and "Hand" (Electron) to operate as a
// unified sovereign resident process without cloud dependency.

/** Base URL for the local LOM endpoint (overridable via env var) */
const LOM_BASE_URL = process.env.AOS_LOM_URL ?? "http://localhost:8080";
const LOM_CHAT_ENDPOINT = `${LOM_BASE_URL}/v1/chat`;

/**
 * lom:chat — Send a chat message to the local Avery-LOM endpoint.
 *
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {{ messages: Array<{role:string,content:string}>, model?: string, stream?: boolean }} payload
 * @returns {Promise<{ ok: boolean, text?: string, error?: string, lom_status: string }>}
 */
ipcMain.handle("lom:chat", async (_event, payload) => {
  // Input validation: ensure messages array is present and properly structured
  if (!payload || !Array.isArray(payload.messages)) {
    return { ok: false, error: "Invalid payload: messages array required", lom_status: "INPUT_ERROR" };
  }
  // Validate each message has required string fields to prevent malformed requests
  const validMessages = payload.messages.every(
    (m) =>
      typeof m === "object" && m !== null &&
      typeof m.role === "string" &&
      typeof m.content === "string",
  );
  if (!validMessages) {
    return { ok: false, error: "Invalid message structure: each message must have string 'role' and 'content' fields", lom_status: "INPUT_ERROR" };
  }

  const body = JSON.stringify({
    model:    payload.model ?? "avery-lom",
    messages: payload.messages,
    stream:   payload.stream ?? false,
  });

  return new Promise((resolve) => {
    const url = new URL(LOM_CHAT_ENDPOINT);
    const opts = {
      hostname: url.hostname,
      port:     parseInt(url.port, 10) || 8080,
      path:     url.pathname,
      method:   "POST",
      headers:  {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-AveryOS-Kernel": KERNEL_VERSION,
      },
      timeout: 60_000,
    };

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const text =
            parsed.choices?.[0]?.message?.content ??
            parsed.message?.content ??
            parsed.response ??
            data;
          resolve({ ok: true, text, lom_status: "NODE-02_ACTIVE" });
        } catch {
          resolve({ ok: true, text: data, lom_status: "NODE-02_ACTIVE" });
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "LOM request timed out (60s)", lom_status: "LOM_TIMEOUT" });
    });

    req.on("error", (err) => {
      const isRefused = err.code === "ECONNREFUSED" || err.code === "ENOTFOUND";
      resolve({
        ok: false,
        error: isRefused ? "Local LOM not running — start Avery-LOM on Node-02" : err.message,
        lom_status: isRefused ? "LOM_OFFLINE" : "LOM_ERROR",
      });
    });

    req.write(body);
    req.end();
  });
});

/**
 * lom:status — Check if the local Avery-LOM endpoint is reachable.
 *
 * @returns {Promise<{ online: boolean, lom_status: string, url: string }>}
 */
ipcMain.handle("lom:status", async () => {
  return new Promise((resolve) => {
    const url  = new URL(LOM_BASE_URL);
    const opts = {
      hostname: url.hostname,
      port:     parseInt(url.port, 10) || 8080,
      path:     "/",
      method:   "GET",
      timeout:  3_000,
    };

    const req = http.request(opts, (res) => {
      res.resume();
      resolve({ online: true, lom_status: "NODE-02_ACTIVE", url: LOM_CHAT_ENDPOINT });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ online: false, lom_status: "LOM_TIMEOUT", url: LOM_CHAT_ENDPOINT });
    });
    req.on("error", () => {
      resolve({ online: false, lom_status: "LOM_OFFLINE", url: LOM_CHAT_ENDPOINT });
    });
    req.end();
  });
});

// ── Application Menu ──────────────────────────────────────────────────────────

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
