/**
 * AveryOS™ Terminal — Preload Script
 *
 * Bridges the Electron main process to the renderer via a typed contextBridge.
 * No raw Node.js APIs are exposed to the renderer — only the specific IPC
 * channels needed by the AveryOS™ Terminal UI.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aosTerminal", {
  /** Run the 7-repo SSH audit and return { code, output }. */
  bridgeVerify: (args) => ipcRenderer.invoke("bridge:verify", args ?? []),

  /** Get kernel info (version, anchor, platform, etc.). */
  kernelInfo: () => ipcRenderer.invoke("kernel:info"),

  /** Open a URL in the system browser. Only https:// URLs are allowed. */
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),

  /** Listen for menu-triggered "run audit" events. */
  onRunAudit: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("run:audit", handler);
    return () => ipcRenderer.removeListener("run:audit", handler);
  },
});
