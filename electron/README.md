# AveryOS™ Terminal — Electron App

> Sovereign 7-Repo Bridge with GabrielOS™ Kernel Isolation

## What This Does

The AveryOS™ Terminal is a native Electron wrapper that:

1. **Isolates** the sovereign kernel operations from browser-level side-channel probes (Firefox update checks, Seagate pop-ups, system-level `http_proxy` sniffing)
2. **Provides** hardware-attested SSH access to the 7 sovereign private repositories via YubiKey GPG slot integration
3. **Displays** live GabrielOS™ audit telemetry in a dedicated native window

## Branding

Gold (`#D4AF37`) on Black (`#000000`) — Sovereign Standard

## Security Model

- No remote content loaded — all pages served from local files only (`file://`)
- `webSecurity: true` — cannot be overridden
- `contextIsolation: true`, `nodeIntegration: false` — preload-only IPC bridge
- `no-proxy-server` flag — system `http_proxy` is intentionally ignored to prevent MITM probes

## Setup

```bash
cd electron
npm install
npm start
```

## Build for Distribution

```bash
cd electron
npm run dist:win    # Windows NSIS installer
npm run dist:mac    # macOS DMG
npm run dist:linux  # Linux AppImage
```

## 7-Repo Bridge SSH Audit

From the app: click **7-Repo Bridge** → **Run Audit**

Or via keyboard: `Cmd/Ctrl+Shift+A`

The audit runs `scripts/verify-repo-ssh.cjs` which:
- Detects YubiKey GPG card (hardware-attested auth)
- Confirms each repo is PRIVATE via GitHub REST API
- Probes SSH connectivity via `git ls-remote`

## Structure

```
electron/
├── package.json          # Electron app config + builder
├── README.md             # This file
└── src/
    ├── main.js           # Main process (window, IPC handlers, menu)
    ├── preload.js        # contextBridge — secure IPC to renderer
    └── renderer/
        ├── index.html    # Terminal UI shell
        ├── style.css     # Gold/Black sovereign branding
        └── renderer.js   # Renderer process — panel logic
```

---

*⛓️⚓⛓️ CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻*
*© 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.*
