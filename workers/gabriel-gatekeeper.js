// GabrielOS Gatekeeper v1.1 - Unified Sync & Ledger
export default {
  async fetch(request, env) {
    const { DB, GITHUB_PAT, VAULT_PASSPHRASE } = env;
    const url = new URL(request.url);

    // 1. GITHUB WEBHOOK (Commit Logging)
    if (request.method === "POST" && url.pathname === "/webhook/github") {
      const payload = await request.json();
      if (payload.repository.full_name !== "averyjl/averyos.com-runtime") {
        return new Response("USI_DETECTED", { status: 403 });
      }
      await DB.prepare(
        "INSERT INTO vaultchain_ledger (timestamp, event, sha, status) VALUES (?, ?, ?, ?)"
      ).bind(Date.now(), "GITHUB_COMMIT", payload.after, "SEALED").run();
      return new Response("ANCHORED", { status: 200 });
    }

    // 2. HARDWARE SYNC (Ollama/YubiKey Handshake)
    if (url.pathname === "/api/gatekeeper/sync") {
      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${GITHUB_PAT}`) {
        return new Response("USI_DETECTED", { status: 403 });
      }
      await DB.prepare(
        "INSERT INTO sync_logs (event_type, timestamp, kernel_anchor) VALUES (?, ?, ?)"
      ).bind("HARDWARE_PERSISTENCE_SYNC", Date.now(), "cf83...da3e").run();
      return new Response("⛓️⚓⛓️ SYNC_LOCKED", { status: 200 });
    }

    return new Response("GabrielOS Active.");
  }
};
