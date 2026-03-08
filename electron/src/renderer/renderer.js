/**
 * AveryOS™ Terminal — Renderer Process
 *
 * Handles UI interactions for the 7-Repo Bridge, Kernel Info, and Links panels.
 * All Node.js / Electron APIs are accessed through the preload contextBridge
 * (`window.aosTerminal`) — no direct Node.js access from this script.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

/* ── Panel navigation ────────────────────────────────────────────────────── */

const panels = {
  bridge: document.getElementById("panel-bridge"),
  kernel: document.getElementById("panel-kernel"),
  links:  document.getElementById("panel-links"),
};

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.panel;
    Object.entries(panels).forEach(([key, el]) => {
      el.classList.toggle("hidden", key !== target);
    });

    if (target === "kernel") loadKernelInfo();
  });
});

/* ── Kernel Info ─────────────────────────────────────────────────────────── */

async function loadKernelInfo() {
  try {
    const info = await window.aosTerminal.kernelInfo();
    document.getElementById("ki-version").textContent   = info.version ?? "—";
    document.getElementById("ki-anchor").textContent    = info.anchor ?? "—";
    document.getElementById("ki-site").textContent      = info.siteUrl ?? "—";
    document.getElementById("ki-platform").textContent  = info.platform ?? "—";
    document.getElementById("ki-node").textContent      = info.nodeVersion ?? "—";
    document.getElementById("ki-electron").textContent  = info.electronVersion ?? "—";
    document.getElementById("kernelTag").textContent    = `Kernel ${info.version ?? "?"}`;
  } catch (err) {
    console.error("kernelInfo error:", err);
  }
}

// Load kernel tag on startup
loadKernelInfo();

/* ── SSH Audit ────────────────────────────────────────────────────────────── */

const btnAudit   = document.getElementById("btnAudit");
const auditOutput = document.getElementById("auditOutput");
const pulseDot   = document.getElementById("pulseDot");
const statusLabel = document.getElementById("statusLabel");

async function runAudit() {
  btnAudit.disabled = true;
  pulseDot.classList.add("busy");
  statusLabel.textContent = "AUDITING…";
  auditOutput.textContent = "⛓️⚓⛓️  AveryOS™ 7-Repo SSH Audit started…\n\n";

  try {
    const { code, output } = await window.aosTerminal.bridgeVerify(["--verbose"]);
    auditOutput.textContent = output;
    statusLabel.textContent = code === 0 ? "VERIFIED ✅" : code === 2 ? "⚠️ BREACH" : "⚠️ WARN";
  } catch (err) {
    auditOutput.textContent = `Error running audit: ${err.message ?? err}`;
    statusLabel.textContent = "ERROR";
  } finally {
    btnAudit.disabled = false;
    pulseDot.classList.remove("busy");
  }
}

btnAudit.addEventListener("click", runAudit);

// Handle menu-triggered audit
const unsubAudit = window.aosTerminal.onRunAudit(runAudit);
window.addEventListener("unload", unsubAudit);

/* ── External Links ──────────────────────────────────────────────────────── */

document.querySelectorAll(".link-card").forEach((card) => {
  card.addEventListener("click", () => {
    const url = card.dataset.url;
    if (url) window.aosTerminal.openExternal(url);
  });
});
